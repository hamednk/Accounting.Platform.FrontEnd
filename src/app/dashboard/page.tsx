"use client";

import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useAuthSession } from "@/components/auth/AuthGate";
import { formatMoneyIrr } from "@/lib/format";
import { Panel } from "@/components/ui/StateViews";

export default function DashboardPage() {
  const { session } = useAuthSession();
  const { workspace, companies, periods } = useWorkspace();
  const needsSetup = companies.length === 0;

  return (
    <AppShell title="داشبورد">
      <div className="stack">
        {needsSetup ? (
          <Panel title="شروع سریع" description="همه‌چیز از داخل وب انجام می‌شود؛ نیازی به فراخوانی دستی API نیست.">
            <Link className="btn-primary" href="/setup" style={{ width: "fit-content" }}>
              شروع راه‌اندازی
            </Link>
          </Panel>
        ) : null}

        <div className="kpi-grid">
          <div className="kpi">
            <strong>کاربر</strong>
            <span>{session?.user.displayName ?? "—"}</span>
          </div>
          <div className="kpi">
            <strong>شرکت فعال</strong>
            <span>{workspace.companyName ?? "انتخاب نشده"}</span>
          </div>
          <div className="kpi">
            <strong>دوره فعال</strong>
            <span>{workspace.periodName ?? "انتخاب نشده"}</span>
          </div>
          <div className="kpi">
            <strong>تعداد شرکت‌ها</strong>
            <span className="ltr">{companies.length}</span>
          </div>
        </div>

        <Panel title="میان‌برهای کاری" description="دسترسی سریع به پرکاربردترین بخش‌ها">
          <div className="module-list">
            <Link href="/journals">
              <strong>صدور و ثبت سند</strong>
              <div className="muted">پیش‌نویس، تأیید و ثبت دفترکل</div>
            </Link>
            <Link href="/accounts">
              <strong>سرفصل حساب‌ها</strong>
              <div className="muted">تعریف حساب‌های جدید</div>
            </Link>
            <Link href="/inventory">
              <strong>انبار</strong>
              <div className="muted">کالا، انبار و رسید موجودی</div>
            </Link>
            <Link href="/sales">
              <strong>فروش</strong>
              <div className="muted">سفارش و فاکتور</div>
            </Link>
            <Link href="/reports/trial-balance">
              <strong>تراز آزمایشی</strong>
              <div className="muted">با شرکت/دوره انتخاب‌شده</div>
            </Link>
          </div>
          <p className="muted" style={{ marginTop: "1rem", marginBottom: 0 }}>
            نمونه مبلغ نمایشی: <span className="ltr">{formatMoneyIrr(1_250_000)}</span> — دوره‌های موجود:{" "}
            <span className="ltr">{periods.length}</span>
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
