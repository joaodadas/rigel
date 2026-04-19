# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rigel is a Brazilian business management dashboard ("Dashboard de gestão empresarial") built with Next.js 15 (App Router). It syncs data from VHSys (a Brazilian ERP system) into Supabase (PostgreSQL) and provides role-based dashboards for admin, sales (comercial), finance (financeiro), and HR (RH) teams.

## Commands

```bash
npx portless rigel next dev --turbopack   # Dev server (use portless, NOT localhost:3000)
npm run build                              # Production build (uses Turbopack)
npm run lint                               # ESLint
```

**Important:** Always use `npx portless` for local development, never bare `next dev` or `localhost:3000`.

There is no unit test framework configured. Playwright is installed as a dev dependency but no test files exist yet.

## Architecture

### Data Flow

```
VHSys ERP API → Sync Layer → Supabase (PostgreSQL) → Query Layer → Redis Cache → Dashboard UI
```

- **VHSys client** (`src/lib/vhsys/`): Fetches data from the VHSys REST API using access tokens
- **Sync layer** (`src/lib/sync/`): Three sync modes — initial (full), incremental (cron every 30min via `vercel.json`), and webhook (real-time)
- **Query layer** (`src/lib/queries/`): Each entity (clientes, pedidos, produtos, etc.) has its own query module that reads from Supabase
- **Redis cache** (`src/lib/redis/client.ts`): SWR pattern via `cacheGetOrFetchSWR()` with 1h hard TTL. All cache keys are registered in `CACHE_KEYS`

### Authentication

Uses **Better-Auth** (not NextAuth/Auth.js) with email/password. Key files:
- `src/lib/auth.ts` — Server-side auth config with two-tier session caching (in-memory 1min → Redis 5min → PostgreSQL)
- `src/lib/auth-client.ts` — Browser-side auth client
- `src/lib/permissions.ts` — RBAC with four roles: `admin`, `comercial`, `financeiro`, `rh`
- `src/middleware.ts` — Route protection (redirects unauthenticated users to `/login`)
- `src/app/api/auth/[...all]/route.ts` — Better-Auth route handler

Auth database uses `pg` Pool (direct PostgreSQL), NOT the Supabase client.

### Route Groups

- `(auth)` — Public routes (`/login`)
- `(dashboard)` — Protected routes, all behind middleware auth check
  - `/admin/*` — Full access to all entities + user management + BI
  - `/comercial/*` — Sales: clientes, pedidos, orcamentos, NFe, produtos, BI
  - `/financeiro/*` — Finance: contas-pagar, contas-receber, extratos
  - `/rh/*` — HR: vendedores

### Database

- **Supabase** (PostgreSQL) accessed via `@supabase/supabase-js` PostgREST client — no ORM
- Server client created via `createSupabaseServer()` in `src/lib/supabase/client.ts` using the service role key
- Tables: vendedores, clientes, produtos, pedidos, contas_pagar, contas_receber, notas_fiscais, orcamentos, sync_log

### UI Stack

- **Tailwind CSS v4** with `tw-animate-css`
- **shadcn/ui** (base-nova style, configured in `components.json`) — components in `src/components/ui/`
- **TanStack React Table** for data grids (`src/components/data-table.tsx`)
- **Recharts** for BI visualizations
- **Lucide React** for icons
- **next-themes** for dark mode

### Key Patterns

- **Server Components by default** — pages fetch data server-side, minimal client state
- **`React.cache()`** wraps `getSession()` for per-request deduplication
- **Redis SWR cache** — use `cacheGetOrFetchSWR(key, fetcher)` for data queries, not raw `cacheGet`/`cacheSet`
- **Cache invalidation** — sync handlers call `invalidateAllCaches()` after data changes; keys are explicitly enumerated (no SCAN)
- **Lazy Redis** — Redis client initializes only if `KV_REST_API_URL` env vars are present; app works without Redis (cache miss → direct DB)

## Environment Variables

Required for full functionality:
- `DATABASE_URL` — PostgreSQL connection string (for Better-Auth)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase access
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — Auth configuration
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — Upstash Redis (optional, gracefully degrades)
- `VHSYS_ACCESS_TOKEN`, `VHSYS_SECRET_ACCESS_TOKEN` — VHSys ERP API

## External APIs

- **VHSys API V2** — Full reference at `docs/vhsys-api-reference.md`. Docs: https://developers.vhsys.com.br/api/

## Language

The application UI, entity names, and business logic are in **Brazilian Portuguese**. Code identifiers (variables, functions) mix English and Portuguese — follow the existing convention for each file.
