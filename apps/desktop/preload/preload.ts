import { contextBridge, ipcRenderer } from "electron";

type UserRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

type ApiResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

type AuthLoginResult =
  | {
      ok: true;
      status: number;
      data: { user: { id: string; email: string; role: UserRole }; role: UserRole };
    }
  | { ok: false; status: number; error: string };

type LmsApi = {
  app: {
    getVersion: () => Promise<string>;
    ping: () => Promise<string>;
  };
  auth: {
    login: (email: string, password: string) => Promise<AuthLoginResult>;
    logout: () => Promise<{ ok: true }>;
    getToken: () => string | null;
    getRole: () => UserRole | null;
  };
  api: {
    request: (options: {
      path: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      withAuth?: boolean;
    }) => Promise<ApiResult>;
    uploadFile: (file: { name: string; type: string; data: ArrayBuffer }) => Promise<ApiResult>;
  };
  download: {
    start: (payload: { url: string; filename?: string }) => Promise<{ ok: true; downloadId: string } | { ok: false; error: string }>;
    onProgress: (handler: (payload: {
      id: string;
      url: string;
      receivedBytes: number;
      totalBytes: number;
      status: string;
      savePath: string;
    }) => void) => () => void;
  };
};

const api: LmsApi = {
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
    ping: () => ipcRenderer.invoke("app:ping")
  },
  auth: {
    login: (email, password) => ipcRenderer.invoke("auth:login", { email, password }),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getToken: () => ipcRenderer.sendSync("auth:getTokenSync"),
    getRole: () => ipcRenderer.sendSync("auth:getRoleSync")
  },
  api: {
    request: (options) => ipcRenderer.invoke("api:request", options),
    uploadFile: (file) => ipcRenderer.invoke("files:upload", file)
  },
  download: {
    start: (payload) => ipcRenderer.invoke("download:start", payload),
    onProgress: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: {
        id: string;
        url: string;
        receivedBytes: number;
        totalBytes: number;
        status: string;
        savePath: string;
      }) => handler(payload);
      ipcRenderer.on("download:progress", listener);
      return () => ipcRenderer.removeListener("download:progress", listener);
    }
  }
};

contextBridge.exposeInMainWorld("lms", api);
