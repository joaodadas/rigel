import type { NextRequest } from "next/server";

/**
 * Validates that the request is authorized to invoke a cron / ops endpoint.
 *
 * Vercel Cron automatically injects `Authorization: Bearer ${CRON_SECRET}`
 * on every cron invocation. Manual ops calls (curl, Postman) must send the
 * same header. Without `CRON_SECRET` configured server-side this fails closed.
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
