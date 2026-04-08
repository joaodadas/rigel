import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const role = session.user.role ?? "comercial";

  const roleRoutes: Record<string, string> = {
    admin: "/admin",
    comercial: "/comercial",
    financeiro: "/financeiro",
    rh: "/rh",
  };

  const target = roleRoutes[role] ?? "/comercial";
  redirect(target);
}
