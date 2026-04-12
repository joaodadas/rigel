import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();

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
