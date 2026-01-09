declare global {
  interface Window {
    lms: {
      app: {
        getVersion: () => Promise<string>;
        ping: () => Promise<string>;
      };
      auth: {
        login: (email: string, password: string) => Promise<
          | {
              ok: true;
              status: number;
              data: { user: { id: string; email: string; role: "ADMIN" | "INSTRUCTOR" | "STUDENT" }; role: "ADMIN" | "INSTRUCTOR" | "STUDENT" };
            }
          | { ok: false; status: number; error: string }
        >;
        logout: () => Promise<{ ok: true }>;
        getToken: () => string | null;
        getRole: () => "ADMIN" | "INSTRUCTOR" | "STUDENT" | null;
      };
      api: {
        request: (options: {
          path: string;
          method?: string;
          headers?: Record<string, string>;
          body?: unknown;
          withAuth?: boolean;
        }) => Promise<{ ok: true; status: number; data: unknown } | { ok: false; status: number; error: string }>;
        uploadFile: (file: { name: string; type: string; data: ArrayBuffer }) => Promise<
          { ok: true; status: number; data: unknown } | { ok: false; status: number; error: string }
        >;
      };
      download: {
        start: (payload: { url: string; filename?: string }) => Promise<
          { ok: true; downloadId: string } | { ok: false; error: string }
        >;
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
  }
}

export {};
