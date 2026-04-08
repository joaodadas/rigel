# Rigel Phase 1: Setup + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap Next.js 15 project with Better Auth (email+senha), 4 roles (admin, comercial, financeiro, rh), shadcn/ui with dark/light mode, and polished login page.

**Architecture:** Next.js 15 App Router with Better Auth handling authentication via Supabase Postgres. Role-based access control via Better Auth admin plugin. shadcn/ui for all components with next-themes for dark/light toggle.

**Tech Stack:** Next.js 15, Better Auth 1.6+, shadcn/ui, Tailwind CSS, next-themes, Supabase (Postgres), TypeScript

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout: fonts, theme provider, antialiased
│   ├── (auth)/
│   │   ├── layout.tsx                      # Auth layout: centered card
│   │   └── login/
│   │       └── page.tsx                    # Login page
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # Dashboard layout: sidebar + header + theme toggle
│   │   └── page.tsx                        # Redirect by role
│   └── api/
│       └── auth/
│           └── [...all]/
│               └── route.ts                # Better Auth handler
├── components/
│   ├── ui/                                 # shadcn/ui components (auto-generated)
│   ├── theme-provider.tsx                  # next-themes provider
│   ├── theme-toggle.tsx                    # Dark/light toggle button
│   └── login-form.tsx                      # Login form component
├── lib/
│   ├── auth.ts                             # Better Auth server instance
│   ├── auth-client.ts                      # Better Auth client instance
│   └── permissions.ts                      # Roles & access control definitions
├── middleware.ts                            # Route protection
.env.local                                  # Environment variables
```

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`

- [ ] **Step 1: Create Next.js 15 project**

Run:
```bash
cd /Users/joaovitordadas/Developer/Rigel
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes
```

Expected: Project scaffolded with `src/app/` structure, Tailwind configured.

- [ ] **Step 2: Verify project runs**

Run:
```bash
cd /Users/joaovitordadas/Developer/Rigel
npm run dev
```

Expected: Dev server starts at http://localhost:3000

- [ ] **Step 3: Initialize git and commit**

Run:
```bash
cd /Users/joaovitordadas/Developer/Rigel
git init
git add -A
git commit -m "chore: initialize Next.js 15 project with Tailwind and TypeScript"
```

---

### Task 2: Configure Environment Variables

**Files:**
- Modify: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Create .env.local with all required variables**

```env
# Better Auth
BETTER_AUTH_SECRET=  # generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Supabase
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# VHSys (already exists in .env, move to .env.local)
VHSYS_ACCESS_TOKEN=MXgdFJSdfOBUgeLbCfEeVDeGFOgTKE
VHSYS_SECRET_ACCESS_TOKEN=kNubSaHy1DsEz7k1Dono0sx93t1teoS

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 2: Ensure .gitignore covers env files**

Verify `.gitignore` includes:
```
.env
.env.*
.env.local
```

- [ ] **Step 3: Generate BETTER_AUTH_SECRET**

Run:
```bash
openssl rand -base64 32
```

Copy output into `.env.local` as `BETTER_AUTH_SECRET` value.

- [ ] **Step 4: Commit**

Run:
```bash
git add .gitignore
git commit -m "chore: configure environment variables structure"
```

Note: Do NOT commit `.env.local`.

---

### Task 3: Install Better Auth + Setup Permissions

**Files:**
- Create: `src/lib/permissions.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Install Better Auth and pg driver**

Run:
```bash
cd /Users/joaovitordadas/Developer/Rigel
npm install better-auth pg
npm install -D @types/pg
```

- [ ] **Step 2: Create permissions file**

Create `src/lib/permissions.ts`:

```typescript
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access";

const statement = {
  ...defaultStatements,
  clientes: ["read", "create", "update", "delete"],
  pedidos: ["read", "create", "update", "delete"],
  orcamentos: ["read", "create", "update", "delete"],
  nfe: ["read", "create", "update", "emit"],
  produtos: ["read", "create", "update", "delete"],
  financeiro: ["read", "create", "update", "delete", "liquidar"],
  vendedores: ["read", "create", "update", "delete"],
  usuarios: ["read", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const adminRole = ac.newRole({
  clientes: ["read", "create", "update", "delete"],
  pedidos: ["read", "create", "update", "delete"],
  orcamentos: ["read", "create", "update", "delete"],
  nfe: ["read", "create", "update", "emit"],
  produtos: ["read", "create", "update", "delete"],
  financeiro: ["read", "create", "update", "delete", "liquidar"],
  vendedores: ["read", "create", "update", "delete"],
  usuarios: ["read", "create", "update", "delete"],
  ...adminAc.statements,
});

export const comercialRole = ac.newRole({
  clientes: ["read", "create", "update"],
  pedidos: ["read", "create", "update", "delete"],
  orcamentos: ["read", "create", "update", "delete"],
  nfe: ["read", "create", "update", "emit"],
  produtos: ["read"],
});

export const financeiroRole = ac.newRole({
  financeiro: ["read", "create", "update", "delete", "liquidar"],
  clientes: ["read"],
});

export const rhRole = ac.newRole({
  vendedores: ["read", "create", "update", "delete"],
});
```

- [ ] **Step 3: Create auth server instance**

Create `src/lib/auth.ts`:

```typescript
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
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // update session every 24h
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
    nextCookies(), // must be last
  ],
});
```

- [ ] **Step 4: Create auth client instance**

Create `src/lib/auth-client.ts`:

```typescript
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
```

- [ ] **Step 5: Create API route handler**

Create `src/app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

- [ ] **Step 6: Run database migration**

Run:
```bash
npx auth@latest generate
```

Review the generated migration SQL, then:

```bash
npx auth@latest migrate
```

Expected: Tables `user`, `session`, `account`, `verification` created in Supabase.

- [ ] **Step 7: Commit**

Run:
```bash
git add src/lib/permissions.ts src/lib/auth.ts src/lib/auth-client.ts src/app/api/auth/
git commit -m "feat: configure Better Auth with 4 roles (admin, comercial, financeiro, rh)"
```

---

### Task 4: Setup shadcn/ui + Dark/Light Theme

**Files:**
- Create: `src/components/theme-provider.tsx`
- Create: `src/components/theme-toggle.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Initialize shadcn**

Run:
```bash
cd /Users/joaovitordadas/Developer/Rigel
npx shadcn@latest init -d
```

When prompted, select:
- Style: New York
- Base color: Zinc
- CSS variables: yes

- [ ] **Step 2: Install required shadcn components**

Run:
```bash
npx shadcn@latest add button card input label badge dropdown-menu separator avatar -y
npm install @tanstack/react-table
```

- [ ] **Step 3: Install next-themes**

Run:
```bash
npm install next-themes
```

- [ ] **Step 4: Create theme provider**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 5: Create theme toggle**

Create `src/components/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Rigel",
  description: "Dashboard de gestao empresarial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
        style={{ WebkitFontSmoothing: "antialiased" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify dark/light mode works**

Run:
```bash
npm run dev
```

Visit http://localhost:3000 -- should render with dark theme by default.

- [ ] **Step 8: Commit**

Run:
```bash
git add src/components/theme-provider.tsx src/components/theme-toggle.tsx src/app/layout.tsx src/app/globals.css src/components/ui/ src/lib/utils.ts components.json tailwind.config.ts
git commit -m "feat: setup shadcn/ui with dark/light theme toggle"
```

---

### Task 5: Build Login Page

**Files:**
- Create: `src/components/login-form.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login form component**

Create `src/components/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await authClient.signIn.email(
      {
        email,
        password,
      },
      {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
        onError: (ctx) => {
          setError(ctx.error.message);
        },
      }
    );

    if (authError) {
      setError(authError.message ?? "Erro ao fazer login");
    }

    setLoading(false);
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight text-center">
          Rigel
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          Entre com suas credenciais
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-10"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full h-10 active:scale-[0.96] transition-transform"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create auth layout**

Create `src/app/(auth)/layout.tsx`:

```tsx
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Rigel",
};

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 4: Verify login page renders**

Run:
```bash
npm run dev
```

Visit http://localhost:3000/login -- should show centered login card with dark theme.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/login-form.tsx src/app/\(auth\)/
git commit -m "feat: build login page with email/password form"
```

---

### Task 6: Route Protection Middleware

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Create middleware for route protection**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const publicRoutes = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));
  const sessionCookie = getSessionCookie(request);

  if (!isPublic && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublic && sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Create dashboard layout (placeholder)**

Create `src/app/(dashboard)/layout.tsx`:

```tsx
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
      {/* Sidebar will be added in Phase 3 */}
      <main className="flex-1 p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Logado como: {session.user.email} ({session.user.role})
        </p>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard redirect page**

Create `src/app/(dashboard)/page.tsx`:

```tsx
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
```

- [ ] **Step 4: Verify middleware redirects work**

Run:
```bash
npm run dev
```

Visit http://localhost:3000 -- should redirect to /login if not authenticated.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/middleware.ts src/app/\(dashboard\)/
git commit -m "feat: add route protection middleware with role-based redirect"
```

---

### Task 7: Create First Admin User (Seed)

**Files:**
- Create: `scripts/seed-admin.ts`

- [ ] **Step 1: Create seed script**

Create `scripts/seed-admin.ts`:

```typescript
const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

async function seedAdmin() {
  console.log("Creating admin user...");

  // First, sign up the user
  const signupRes = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin",
      email: "admin@rigel.com",
      password: "admin12345",
    }),
  });

  const signupData = await signupRes.json();
  console.log("Signup:", signupData);

  if (!signupRes.ok) {
    console.error("Failed to create user");
    process.exit(1);
  }

  console.log("Admin user created. Set role to admin via Supabase SQL:");
  console.log(`UPDATE "user" SET role = 'admin' WHERE email = 'admin@rigel.com';`);
}

seedAdmin().catch(console.error);
```

- [ ] **Step 2: Run the seed with dev server running**

In one terminal:
```bash
npm run dev
```

In another terminal:
```bash
cd /Users/joaovitordadas/Developer/Rigel
npx tsx scripts/seed-admin.ts
```

- [ ] **Step 3: Set admin role in Supabase**

Run this SQL in Supabase dashboard:
```sql
UPDATE "user" SET role = 'admin' WHERE email = 'admin@rigel.com';
```

- [ ] **Step 4: Test full login flow**

1. Visit http://localhost:3000/login
2. Enter email: admin@rigel.com, password: admin12345
3. Should redirect to /admin (or / then /admin)

- [ ] **Step 5: Commit**

Run:
```bash
git add scripts/seed-admin.ts
git commit -m "feat: add admin user seed script"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Test login flow end-to-end**

1. Visit /login -> see login form (dark mode)
2. Toggle to light mode -> theme persists
3. Enter admin credentials -> redirects to dashboard
4. Dashboard shows email and role
5. Visit /login while authenticated -> redirects to /

- [ ] **Step 2: Test unauthenticated access**

1. Clear cookies
2. Visit / -> redirects to /login
3. Visit /admin -> redirects to /login
4. API routes at /api/auth/* accessible

- [ ] **Step 3: Final commit**

Run:
```bash
git add -A
git commit -m "feat: complete Phase 1 - auth setup with Better Auth and shadcn/ui"
```
