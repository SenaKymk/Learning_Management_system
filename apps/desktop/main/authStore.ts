import { app, safeStorage } from "electron";
import fs from "fs";
import path from "path";

export type UserRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

type AuthState = {
  token: string | null;
  role: UserRole | null;
};

type PersistedState = {
  token: string | null;
  role: UserRole | null;
};

const EMPTY_STATE: AuthState = { token: null, role: null };
let cachedState: AuthState | null = null;
let warnedAboutStorage = false;

function getStorePath() {
  return path.join(app.getPath("userData"), "auth.json");
}

function canEncrypt() {
  return safeStorage.isEncryptionAvailable();
}

function warnStorageUnavailable() {
  if (warnedAboutStorage) {
    return;
  }
  warnedAboutStorage = true;
  console.warn("safeStorage is unavailable; auth state will not persist on disk.");
}

function readPersistedState(): AuthState {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return { ...EMPTY_STATE };
  }

  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedState;

    if (!parsed?.token || !parsed.role) {
      return { ...EMPTY_STATE };
    }

    if (!canEncrypt()) {
      warnStorageUnavailable();
      return { ...EMPTY_STATE };
    }

    const decrypted = safeStorage.decryptString(Buffer.from(parsed.token, "base64"));
    return { token: decrypted, role: parsed.role };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writePersistedState(state: AuthState) {
  const storePath = getStorePath();

  if (!state.token || !state.role) {
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath);
    }
    return;
  }

  if (!canEncrypt()) {
    warnStorageUnavailable();
    return;
  }

  const encrypted = safeStorage.encryptString(state.token).toString("base64");
  const payload: PersistedState = { token: encrypted, role: state.role };
  fs.writeFileSync(storePath, JSON.stringify(payload), "utf8");
}

function ensureLoaded() {
  if (!cachedState) {
    cachedState = readPersistedState();
  }
}

export function getToken() {
  ensureLoaded();
  return cachedState?.token ?? null;
}

export function getRole() {
  ensureLoaded();
  return cachedState?.role ?? null;
}

export function setSession(token: string, role: UserRole) {
  cachedState = { token, role };
  writePersistedState(cachedState);
}

export function clearSession() {
  cachedState = { ...EMPTY_STATE };
  writePersistedState(cachedState);
}
