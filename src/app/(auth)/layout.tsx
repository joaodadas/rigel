import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,var(--color-muted)_0%,transparent_70%)] before:opacity-40 dark:before:opacity-20">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
