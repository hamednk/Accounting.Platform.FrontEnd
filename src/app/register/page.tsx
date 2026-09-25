"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiSend } from "@/lib/api";
import { normalizeAuthResponse, saveSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/auth/register", "POST", {
      userName,
      displayName,
      email,
      password,
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "ثبت‌نام ناموفق بود.");
      return;
    }
    saveSession(normalizeAuthResponse(res.data));
    router.replace("/dashboard");
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>ثبت‌نام</h1>
        <p className="muted">ثبت‌نام آزاد فقط در صورت فعال بودن توسط مدیر سامانه ممکن است و کاربر جدید فقط دسترسی مشاهده دارد؛ در غیر این صورت از مدیر بخواهید برایتان کاربر بسازد.</p>
        <label>
          نام کاربری
          <input className="ltr" value={userName} onChange={(e) => setUserName(e.target.value)} required />
        </label>
        <label>
          نام نمایشی
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label>
          ایمیل
          <input className="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          رمز عبور
          <input
            className="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error ? (
          <p className="state-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "…" : "ایجاد حساب"}
        </button>
        <p className="muted">
          حساب دارید؟ <Link href="/login">ورود</Link>
        </p>
      </form>
    </main>
  );
}
