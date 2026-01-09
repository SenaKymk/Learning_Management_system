# SEB Config Template (Web)

This template describes how to create a .seb file that opens the web exam
endpoint and enforces Safe Exam Browser restrictions. Use the SEB Config Tool
to apply these settings and export the .seb file.

## Required inputs
- Start URL: http://localhost:3000/seb
- Allowed URLs:
  - http://localhost:3000/*
  - http://localhost:4000/*
  - https://*.your-cdn.example/*
  - https://*.your-domain.example/*
- Blocked URLs:
  - *

## Kiosk and window settings
- Kiosk Mode: enabled (fullscreen)
- Always on top: enabled
- Allow switching applications: disabled

## Browser restrictions
- Disable context menu: enabled
- Disable navigation bar: enabled
- Disable address bar: enabled
- Disable reload: enabled
- Disable downloads/uploads: enabled (except your exam upload endpoints)
- Disable printing: enabled
- Disable screen capture: enabled (OS dependent)
- Disable clipboard: enabled
- Disable spell check: enabled
- Disable DevTools: enabled

## Security / SEB keys
- Enable Browser Exam Key (BEK): enabled
- Allow reconfiguring: disabled
- Allow quitting: disabled (or password-protected)
- Client configuration password: set (optional)

## Prohibited processes (Windows)
- taskmgr.exe
- cmd.exe
- powershell.exe
- mmc.exe
- regedit.exe
- chrome.exe
- msedge.exe
- firefox.exe
- opera.exe
- teams.exe
- discord.exe
- obs64.exe

## Notes
- The server checks for SEB request headers. If SEB does not send a request hash,
  the check will fail.
- Replace localhost entries with your production domains before release.
