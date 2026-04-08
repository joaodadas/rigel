import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import {
  ac,
  adminRole,
  comercialRole,
  financeiroRole,
  rhRole,
} from "./permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles: {
        admin: adminRole,
        comercial: comercialRole,
        financeiro: financeiroRole,
        rh: rhRole,
      },
    }),
  ],
});
