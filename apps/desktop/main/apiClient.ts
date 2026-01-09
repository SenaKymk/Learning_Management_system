import { getToken } from "./authStore";

const resolvedApiUrl = (process.env.LMS_API_URL ?? "").trim() || "http://localhost:4000";
const API_URL = resolvedApiUrl.replace(/\/+$/, "");

export type ApiRequestOptions = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  withAuth?: boolean;
};

export type ApiResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

function normalizePath(path: string) {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

function isPlainObject(value: unknown) {
  return value !== null && typeof value === "object" && value.constructor === Object;
}

export async function apiRequest(options: ApiRequestOptions): Promise<ApiResult> {
  const headers = new Headers(options.headers ?? {});
  const withAuth = options.withAuth !== false;

  if (withAuth) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let body: string | Buffer | Uint8Array | undefined;
  if (options.body !== undefined) {
    if (typeof options.body === "string") {
      body = options.body;
    } else if (isPlainObject(options.body) || Array.isArray(options.body)) {
      body = JSON.stringify(options.body);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else {
      return { ok: false, status: 0, error: "Unsupported request body type" };
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${normalizePath(options.path)}`, {
      method: options.method ?? "GET",
      headers,
      body
    });
  } catch {
    return { ok: false, status: 0, error: "Backend unreachable" };
  }

  const status = response.status;

  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const data = (await response.json()) as { error?: string };
      message = data?.error ?? message;
    } catch {
      message = response.statusText || message;
    }
    return { ok: false, status, error: message };
  }

  if (status === 204) {
    return { ok: true, status, data: null };
  }

  try {
    const data = await response.json();
    return { ok: true, status, data };
  } catch {
    const text = await response.text();
    return { ok: true, status, data: text };
  }
}

export async function uploadFileToApi(file: { name: string; type: string; data: ArrayBuffer }): Promise<ApiResult> {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const formData = new FormData();
  const blob = new Blob([file.data], { type: file.type || "application/octet-stream" });
  formData.append("file", blob, file.name || "upload.bin");

  let response: Response;
  try {
    response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      headers,
      body: formData
    });
  } catch {
    return { ok: false, status: 0, error: "Backend unreachable" };
  }

  const status = response.status;
  if (!response.ok) {
    let message = response.statusText || "Upload failed";
    try {
      const data = (await response.json()) as { error?: string };
      message = data?.error ?? message;
    } catch {
      message = response.statusText || message;
    }
    return { ok: false, status, error: message };
  }

  try {
    const data = await response.json();
    return { ok: true, status, data };
  } catch {
    const text = await response.text();
    return { ok: true, status, data: text };
  }
}
