import { app, BrowserWindow, ipcMain, Menu, nativeImage, session, shell, Tray, type DownloadItem } from "electron";
import path from "path";
import { apiRequest, uploadFileToApi } from "./apiClient";
import { clearSession, getRole, getToken, setSession, type UserRole } from "./authStore";

const isDev = !app.isPackaged;
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
const pendingDownloads = new Map<
  string,
  { resolvers: Array<(id: string) => void>; filename?: string; window: BrowserWindow | null }
>();
const downloadIds = new WeakMap<DownloadItem, string>();

function extractRole(token: string): UserRole | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const data = JSON.parse(decoded) as { role?: string };
    if (data.role === "ADMIN" || data.role === "INSTRUCTOR" || data.role === "STUDENT") {
      return data.role;
    }
    return null;
  } catch {
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const indexPath = path.join(__dirname, "..", "renderer", "index.html");
  mainWindow.loadFile(indexPath);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    mainWindow?.hide();
  });
}

function createTray() {
  if (tray) {
    return;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="#0f172a"/>
      <circle cx="32" cy="32" r="18" fill="#ef4444"/>
    </svg>
  `;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
  tray = new Tray(image);
  tray.setToolTip("LMS Desktop");
  const menu = Menu.buildFromTemplate([
    {
      label: "Show app",
      click: () => {
        if (!mainWindow) {
          createWindow();
        }
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.on("double-click", () => {
    if (!mainWindow) {
      createWindow();
    }
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

function getActiveWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }
  return mainWindow;
}

function safeSend(channel: string, payload: unknown) {
  const win = getActiveWindow();
  if (!win) {
    return;
  }
  const contents = win.webContents;
  if (!contents || contents.isDestroyed()) {
    return;
  }
  contents.send(channel, payload);
}

app.whenReady().then(() => {
  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:ping", () => "pong");

  ipcMain.on("auth:getTokenSync", (event) => {
    event.returnValue = getToken();
  });
  ipcMain.on("auth:getRoleSync", (event) => {
    event.returnValue = getRole();
  });
  ipcMain.handle("auth:getToken", () => getToken());
  ipcMain.handle("auth:getRole", () => getRole());
  ipcMain.handle("auth:logout", () => {
    clearSession();
    return { ok: true };
  });
  ipcMain.handle("auth:login", async (_event, payload: { email: string; password: string }) => {
    const result = await apiRequest({
      path: "/auth/login",
      method: "POST",
      body: payload,
      withAuth: false
    });

    if (!result.ok) {
      return result;
    }

    const data = result.data as { token: string; user: { role?: UserRole } };
    const role = extractRole(data.token) ?? data.user?.role ?? null;
    if (!role) {
      return { ok: false, status: 500, error: "Invalid auth payload" } as const;
    }

    setSession(data.token, role);
    return { ok: true, status: result.status, data: { user: data.user, role } } as const;
  });

  ipcMain.handle("api:request", (_event, options) => apiRequest(options));
  ipcMain.handle("files:upload", (_event, payload) => uploadFileToApi(payload));
  ipcMain.handle("download:start", (_event, payload: { url: string; filename?: string }) => {
    if (!payload?.url) {
      return { ok: false, error: "Missing URL" };
    }
    const url = payload.url;
    const entry = pendingDownloads.get(url) ?? { resolvers: [], filename: payload.filename, window: getActiveWindow() };
    entry.filename = payload.filename ?? entry.filename;
    entry.window = entry.window ?? getActiveWindow();
    const promise = new Promise<{ ok: true; downloadId: string }>((resolve) => {
      entry.resolvers.push((id) => resolve({ ok: true, downloadId: id }));
    });
    pendingDownloads.set(url, entry);
    session.defaultSession.downloadURL(url);
    return promise;
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "media") {
      callback(true);
      return;
    }
    callback(false);
  });

  createWindow();
  createTray();

  session.defaultSession.on("will-download", (event, item, webContents) => {
  const url = item.getURL();
  const pending = pendingDownloads.get(url);
  const targetWindow = pending?.window ?? getActiveWindow();
  const preferredName = pending?.filename;
  const filename = sanitizeFileName(preferredName ?? item.getFilename());
  const savePath = path.join(app.getPath("downloads"), filename);
  item.setSavePath(savePath);
  const downloadId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  downloadIds.set(item, downloadId);

    if (pending && pending.resolvers.length > 0) {
      const resolver = pending.resolvers.shift();
      resolver?.(downloadId);
      if (pending.resolvers.length === 0) {
        pendingDownloads.delete(url);
      } else {
        pendingDownloads.set(url, pending);
      }
    }

  if (targetWindow && !targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
    targetWindow.webContents.send("download:progress", {
      id: downloadId,
      url,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      status: "started",
      savePath
    });
  }

  item.on("updated", () => {
    const id = downloadIds.get(item) ?? downloadId;
    if (targetWindow && !targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send("download:progress", {
        id,
        url,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        status: item.isPaused() ? "paused" : "progress",
        savePath
      });
    }
  });

  item.once("done", (_event, state) => {
    const id = downloadIds.get(item) ?? downloadId;
    if (targetWindow && !targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
      targetWindow.webContents.send("download:progress", {
        id,
        url,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        status: state,
        savePath
      });
    }
  });
});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (!tray) {
      app.quit();
    }
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});
