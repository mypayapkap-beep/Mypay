---
name: Artifact previewPath pitfall
description: Setting previewPath to a path with no handler causes the Replit preview pane to hang, showing a blank screen.
---

## Rule

`previewPath` in `artifact.toml` must point to a path that returns a quick HTTP response. For a full-stack app where the frontend is served at `/`, always set `previewPath = "/"`.

**Never set `previewPath = "/api"`** when the app serves a frontend at `/`, even if the artifact is "kind = api".

## Why

Replit's preview pane opens the `previewPath` URL in an iframe. If that URL hangs (e.g. `GET /api/` with no Express handler for the router root), the iframe waits indefinitely and shows a blank white screen. This also floods the server logs with hundreds of aborted `GET /api/` requests from Replit's health checker.

## How to apply

- When an Express API also proxies a frontend at `/`, set `previewPath = "/"` so the preview opens the frontend.
- The `paths` array in `[[services]]` can still include both `"/api"` and `"/"` for routing — that's separate from `previewPath`.
- If you ever see a flood of aborted requests to a specific path in the API server logs, check whether `previewPath` in `artifact.toml` points to that same path.
