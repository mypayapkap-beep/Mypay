# MyPay

MyPay is a full-stack mobile-first fintech app for earning, saving, and transferring money — with task rewards, wallet management, UPI, buy/sell orders, referrals, and a full admin panel.

## Run & Operate

### Development
- `pnpm run dev:client` — run the frontend (port 5173)
- `pnpm run dev:server` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build:client` — build frontend for production

### Android APK
- `pnpm run build:apk` — build web assets for APK
- `pnpm run sync:apk` — build + sync to Android project (`client/android/`)
- Open `client/android/` in Android Studio to build/run the APK
- GitHub Actions automatically builds APKs on push to main

### Database
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 19 + Vite 7 + TailwindCSS v4 (in `client/`)
- **Backend**: Express 5 + Drizzle ORM (in `artifacts/api-server/`)
- **Mobile**: Capacitor 8 with Firebase Phone Auth (Android project at `client/android/`)
- **DB**: PostgreSQL + Drizzle ORM
- **Auth**: JWT-based with OTP (Fast2SMS DLT + Firebase fallback)
- Build: esbuild (server), Vite (frontend)

## Where things live

```
client/                    # React frontend
  src/
    pages/app/             # User-facing pages (dashboard, wallet, orders, etc.)
    pages/admin/           # Admin panel pages
    components/            # Shared UI components
    context/               # AuthContext, AdminAuthContext
    lib/                   # API client, firebase, auth helpers
  android/                 # Capacitor Android project (generated)
  capacitor.config.ts      # Capacitor configuration
  vite.config.ts           # Web build config
  vite.config.apk.ts       # APK build config (base: "./" for Capacitor)

artifacts/api-server/      # Express API server
  src/
    routes/                # API route handlers
    routes/admin/          # Admin-only routes
    routes/auth/           # Auth routes (login, register, OTP, reset)
    lib/                   # otp.ts, wallet.ts, telegram.ts, referral.ts
    middlewares/auth.ts    # JWT middleware

lib/db/                    # PostgreSQL schema (Drizzle ORM)
lib/api-zod/               # Zod schemas generated from OpenAPI
lib/api-client-react/      # React Query hooks generated from OpenAPI
lib/api-spec/              # OpenAPI specification source

.github/workflows/
  build-apk.yml            # GitHub Actions APK build workflow
```

## Architecture decisions

- Contract-first API: OpenAPI spec in `lib/api-spec/openapi.yaml` generates both Zod validators and React Query hooks
- Dual build targets: `vite.config.ts` (web, base="/") vs `vite.config.apk.ts` (Capacitor, base="./")
- Firebase Phone Auth integrated via `@capacitor-firebase/authentication` — disabled until Firebase billing is enabled; falls back to dev OTP mode automatically
- Admin panel is part of the same React SPA but only accessible via `/admin/*` routes (no separate deployment)
- Vite proxy in dev mode routes `/api` → `localhost:8080` so frontend and backend run separately

## Features

- **Registration** — mobile number + OTP + password
- **Login** — mobile + password with JWT sessions
- **Smart Dev OTP** — auto-accepts any OTP when Firebase billing is disabled
- **Firebase Phone Auth** — production OTP via Firebase (requires billing)
- **Wallet** — balance display, ledger history
- **Deposit** — initiate buy orders with UPI
- **Withdraw** — request withdrawals to UPI accounts
- **Buy Orders** — track deposit/buy order history
- **Sell Orders / Sell Requests** — user-initiated sell requests
- **Referral System** — referral tree, stats, and bonus tracking
- **Admin Panel** — full management: users, deposits, withdrawals, tasks, UPI, announcements, banners, support, diagnostics
- **Telegram configuration** — admin Telegram notification settings
- **User Management** — admin CRUD, wallet adjustments, device sessions
- **APK download page** — `/install` page with PWA install prompt

## User preferences

- Keep standard project structure (no Replit artifact folders for app code)
- Frontend lives in `client/`, backend in `artifacts/api-server/`
- Android project lives in `client/android/` (gitignore build artifacts, keep project files)
- Vite config must work without mandatory PORT/BASE_PATH env vars

## Gotchas

- API server dev script hardcodes `PORT=8080` — do NOT use a shared PORT env var
- Frontend dev server runs on port 5173 (or `$PORT` if set) and proxies `/api` to `localhost:8080`
- APK build uses `base: "./"` (relative paths) so Capacitor can load assets from the filesystem
- After any schema change: run `pnpm --filter @workspace/db run push` before restarting API
- `npx cap sync android` must be run from `client/` directory after every APK web build
- Seed admin credentials: username `aslambhai`, password `aslambhai123098`

## Pointers

- DB schema source of truth: `lib/db/src/schema/`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Run codegen after spec changes: `pnpm --filter @workspace/api-spec run codegen`
