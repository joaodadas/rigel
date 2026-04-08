import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh">
      <main className="flex-1 p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Logado como: {session.user.email} ({session.user.role})
        </p>
        {children}
      </main>
    </div>
  );
}
