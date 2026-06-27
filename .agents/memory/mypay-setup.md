---
name: MyPay project setup
description: Stack, seed credentials, route layout, port configuration, and key gotchas for the MyPay fintech app.
---

## Project structure (restored from ZIP)
- Frontend: `client/` — React 19 + Vite 7 + TailwindCSS v4
- Backend: `artifacts/api-server/` — Express 5 + Drizzle ORM on port 8080
- Shared libs: `lib/db`, `lib/api-zod`, `lib/api-client-react`, `lib/api-spec`
- Android: `client/android/` — Capacitor 8 project (run `npx cap sync android` from `client/` after APK build)

## Seed admin credentials
- Username: `aslambhai`, Password: `aslambhai123098` (seeded by seed.ts, never expose in UI)

## Port configuration (CRITICAL — do not change)
- Frontend dev: port 5173 (or `$PORT` if set in environment)
- API server: always port 8080 (hardcoded in dev script to avoid env var conflicts)
- Do NOT set a shared PORT env var — Replit injects per-workflow

**Why:** Shared PORT env var causes api-server to bind to the wrong port.

## Build system
- `pnpm run build:apk` — builds APK web assets to `client/dist/apk/` with `base: "./"`
- `pnpm run sync:apk` — build:apk + `npx cap sync android`
- Vite config split: `vite.config.ts` (web, base="/") vs `vite.config.apk.ts` (Capacitor, base="./")
- Replit plugins (cartographer, dev-banner, runtime-error-modal) load conditionally on `REPL_ID` presence — safe to build outside Replit

## Routes
- User GET sell requests: `GET /api/sell-requests`
- Admin create/approve/reject: `POST /api/admin/sell-requests`, `PATCH /api/admin/sell-requests/:id/approve`
- Wallet adjust: `POST /api/admin/users/:id/wallet-adjust`
- UPI add requires `provider` field: one of `phonepe|paytm|mobikwik|airtel|freecharge`

## Auth system
- 3-tab login page: login (mobile+password), register (OTP→details), forgot password (OTP→new password)
- `src/lib/firebaseOtp.ts` — tries Firebase Phone Auth, auto-falls back to DEV MODE on `auth/billing-not-enabled`
- DEV MODE auto-accepts any OTP — no Firebase billing needed for development
- `POST /api/auth/reset-password` — takes `{mobile, newPassword, confirmPassword}`

## GitHub Actions
- `.github/workflows/build-apk.yml` — builds debug + release APK on push to main
- Required secrets: `VITE_API_BASE_URL`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- Release APK only built when keystore secret is set; falls back to debug APK otherwise

## Key gotchas
- After schema changes: run `pnpm --filter @workspace/db run push` before restarting API
- `npx cap sync android` MUST be run from `client/` directory (capacitor.config.ts lives there)
- `client/tsconfig.json` extends `../tsconfig.base.json` (one level up, not two)
- `client/tsconfig.json` references `../lib/api-client-react` (one level up)
- Do NOT add `client` to root `tsconfig.json` references (leaf packages are not composite)
