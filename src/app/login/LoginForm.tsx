"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiSend } from "@/lib/api";
import { normalizeAuthResponse, saveSession } from "@/lib/auth";
import { ErrorState } from "@/components/ui/StateViews";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/dashboard", [params]);
  const expired = params.get("reason") === "expired";
  const [userName, setUserName] = useState("admin");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/auth/login", "POST", {
      userName,
      password,
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "ورود ناموفق بود.");
      return;
    }
    saveSession(normalizeAuthResponse(res.data));
    router.replace(next);
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>ورود به سامانه</h1>
        {expired && !error ? (
          <div className="alert alert-info" role="status">
            <div className="alert-body">
              <strong className="alert-title">نشست شما پایان یافت</strong>
              <p className="alert-text">برای ادامه کار دوباره وارد شوید.</p>
            </div>
          </div>
        ) : null}
        <label>
          نام کاربری
          <input
            className="ltr"
            onChange={(e) => setUserName(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          رمز عبور
          <input
            className="ltr"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <ErrorState message={error} onDismiss={() => setError(null)} /> : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "در حال ورود…" : "ورود"}
        </button>
        <p className="muted">
          حساب ندارید؟ <Link href="/register">ثبت‌نام</Link>
        </p>
      </form>
    </main>
  );
}
