"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, readSession, type AuthSession } from "@/lib/auth";
import { apiGet } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/register"];
const ADMIN = "IDENTITY.ADMIN";

type AuthCtx = {
  session: AuthSession | null;
  /** Effective permission codes from the server (null while loading). UI hint only — server enforces. */
  permissions: string[] | null;
  can: (permission: string) => boolean;
  logout: () => void;
  refresh: () => void;
};

const AuthSessionContext = createContext<AuthCtx>({
  session: null,
  permissions: null,
  can: () => false,
  logout: () => undefined,
  refresh: () => undefined,
});

export function useAuthSession() {
  return useContext(AuthSessionContext);
}

/** Convenience hook: `const can = useCan(); can("ACCOUNTING.JOURNAL.POST")`. */
export function useCan() {
  return useContext(AuthSessionContext).can;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!s && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (s && (pathname === "/login" || pathname === "/register")) {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  const token = session?.accessToken;
  useEffect(() => {
    if (!token) {
      setPermissions(null);
      return;
    }
    let cancelled = false;
    void apiGet<{ permissions?: string[]; Permissions?: string[] }>("/api/v1/auth/me/permissions").then((res) => {
      if (cancelled) return;
      setPermissions(res.data?.permissions ?? res.data?.Permissions ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!ready && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="state-box" style={{ margin: "2rem" }}>
        در حال بررسی نشست…
      </div>
    );
  }

  const can = (permission: string) => !!permissions && (permissions.includes(ADMIN) || permissions.includes(permission));

  return (
    <AuthSessionContext.Provider
      value={{
        session,
        permissions,
        can,
        logout: () => {
          clearSession();
          setSession(null);
          setPermissions(null);
          router.replace("/login");
        },
        refresh: () => setSession(readSession()),
      }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
}
