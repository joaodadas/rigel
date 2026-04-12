import { cache } from "react";
import { headers } from "next/headers";
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

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
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

/**
 * Deduplicated session getter — safe to call from layout AND page
 * within the same request. React.cache ensures the DB is hit only once.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
