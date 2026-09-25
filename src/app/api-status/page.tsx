"use client";

import { AppShell } from "@/components/shell/AppShell";
import { formatJalali } from "@/lib/jalali";
import { apiGet } from "@/lib/api";

type Meta = {
  product: string;
  locale: string;
  calendar: string;
  currency: string;
  version: string;
};

export default async function SystemStatusPage() {
  const meta = await apiGet<Meta>("/api/v1/meta");
  const today = formatJalali(new Date());

  return (
    <AppShell title="وضعیت سامانه">
      <div className="panel stack">
        <p className="muted">تاریخ امروز: {today}</p>
        {meta.error ? (
          <p className="state-error">{meta.error}</p>
        ) : (
          <div className="kpi-grid">
            <div className="kpi">
              <strong>محصول</strong>
              <span>{meta.data?.product}</span>
            </div>
            <div className="kpi">
              <strong>نسخه</strong>
              <span className="ltr">{meta.data?.version}</span>
            </div>
            <div className="kpi">
              <strong>تقویم</strong>
              <span>{meta.data?.calendar}</span>
            </div>
            <div className="kpi">
              <strong>ارز</strong>
              <span className="ltr">{meta.data?.currency}</span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
