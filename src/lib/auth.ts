import { cache } from "react";
import { cookies, headers } from "next/headers";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import {
  ac,
  adminRole,
  comercialRole,
  financeiroRole,
  rhRole,
} from "./permissions";
import { cacheGet, cacheSet } from "./redis/client";

// ---------------------------------------------------------------------------
// Two-tier session cache: in-memory (60s) → Redis (5min) → DB
// ---------------------------------------------------------------------------

const SESSION_REDIS_TTL = 300; // 5 minutes
const SESSION_MEM_TTL = 60_000; // 1 minute

const memCache = new Map<string, { data: unknown; expiresAt: number }>();

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    admin({
      ac,
      roles: {
        admin: adminRole,
        comercial: comercialRole,
        financeiro: financeiroRole,
        rh: rhRole,
      },
      defaultRole: "comercial",
    }),
    nextCookies(),
  ],
});

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Deduplicated session getter with two-tier caching.
 * 1. React.cache — deduplicates within the same request
 * 2. In-memory Map (1 min) — avoids ANY network call
 * 3. Redis (5 min) — survives cold starts / new instances
 * 4. DB — source of truth (fallback)
 */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("better-auth.session_token")?.value ??
    cookieStore.get("__Secure-better-auth.session_token")?.value;

  if (token) {
    const cacheKey = `session:${token}`;

    // 1) In-memory cache (instant — no network)
    const mem = memCache.get(cacheKey);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.data as Session;
    }

    // 2) Redis cache (~50-100ms round-trip)
    try {
      const cached = await cacheGet<Session>(cacheKey);
      if (cached) {
        memCache.set(cacheKey, { data: cached, expiresAt: Date.now() + SESSION_MEM_TTL });
        return cached;
      }
    } catch {}

    // 3) DB — source of truth
    const session = await auth.api.getSession({ headers: await headers() });

    if (session) {
      memCache.set(cacheKey, { data: session, expiresAt: Date.now() + SESSION_MEM_TTL });
      try { await cacheSet(cacheKey, session, SESSION_REDIS_TTL); } catch {}
    }

    return session;
  }

  return auth.api.getSession({ headers: await headers() });
});
