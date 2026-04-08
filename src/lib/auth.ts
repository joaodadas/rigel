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
