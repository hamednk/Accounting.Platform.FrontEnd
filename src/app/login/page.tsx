"use client";

import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell">در حال بارگذاری…</div>}>
      <LoginForm />
    </Suspense>
  );
}
