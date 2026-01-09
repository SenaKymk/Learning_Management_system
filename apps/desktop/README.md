# LMS Desktop (Electron)

This app is the desktop client for the LMS backend. It uses the existing API as-is and stores JWTs securely via Electron safeStorage in the main process.

## Local development

Prereqs
- Node.js (18+ recommended) and npm
- LMS backend running (default `http://localhost:4000`)

Install
```bash
cd apps/desktop
npm install
```

Run (Windows PowerShell)
```powershell
$env:LMS_API_URL="http://localhost:4000"
npm run dev
```

Run (macOS/Linux)
```bash
export LMS_API_URL="http://localhost:4000"
npm run dev
```

Notes
- If `LMS_API_URL` is not set, the app defaults to `http://localhost:4000`.
- The renderer talks to the backend via IPC; the main process performs all HTTP requests.
- The camera & microphone test checks device availability for exam readiness; it does not record or store any audio/video.

## Production builds (electron-builder)

Build (all platforms on the current OS)
```bash
cd apps/desktop
npm run dist
```

Package directory build (no installer)
```bash
cd apps/desktop
npm run pack
```

Output
- `apps/desktop/dist/release` (configured in `electron-builder.json`)

## Backend connection

Environment variables
- `LMS_API_URL`: Base URL for the backend API (example: `http://localhost:4000`).

Behavior
- Login uses `POST /auth/login` and stores the returned JWT in the main process.
- All subsequent API requests attach `Authorization: Bearer <token>` from safeStorage.
