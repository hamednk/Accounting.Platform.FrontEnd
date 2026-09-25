"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGet, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

type VatRow = {
  id: string;
  dateJalali: string;
  documentNumber: string;
  direction: string;
  baseAmount: number;
  taxAmount: number;
};

function pick(r: Record<string, unknown>, k: string): unknown {
  return r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)];
}

export default function TaxPage() {
  const { workspace } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [fromJalali, setFromJalali] = useState("1405/01/01");
  const [toJalali, setToJalali] = useState("1405/03/31");
  const [vatRows, setVatRows] = useState<VatRow[]>([]);
  const [netVat, setNetVat] = useState<number | null>(null);
  const [year, setYear] = useState("1405");
  const [season, setSeason] = useState("1");
  const [seasonalJson, setSeasonalJson] = useState<string | null>(null);

  const loadVat = useCallback(async () => {
    if (!workspace.companyId) return;
    setOk(null);
    const res = await apiGet<Record<string, unknown>>(
      `/api/v1/tax/vat-worksheet?companyId=${workspace.companyId}&fromJalali=${encodeURIComponent(fromJalali)}&toJalali=${encodeURIComponent(toJalali)}`,
    );
    if (res.error) {
      setError(res.error);
      setVatRows([]);
      return;
    }
    setError(null);
    const rows = (pick(res.data ?? {}, "rows") as Record<string, unknown>[] | undefined) ?? [];
    setVatRows(
      rows.map((r, i) => ({
        id: `${i}-${String(pick(r, "documentNumber"))}`,
        dateJalali: String(pick(r, "dateJalali") ?? ""),
        documentNumber: String(pick(r, "documentNumber") ?? ""),
        direction: String(pick(r, "direction") ?? ""),
        baseAmount: Number(pick(r, "baseAmount") ?? 0),
        taxAmount: Number(pick(r, "taxAmount") ?? 0),
      })),
    );
    setNetVat(Number(pick(res.data ?? {}, "netVatPayable") ?? 0));
    setOk("کاربرگ ارزش افزوده بارگذاری شد.");
  }, [workspace.companyId, fromJalali, toJalali]);

  async function seedVat() {
    const res = await apiSend("/api/v1/tax/seed-iran-vat", "POST");
    if (res.error) setError(res.error);
    else setOk("کد VAT ایران seeded شد.");
  }

  async function loadSeasonal() {
    if (!workspace.companyId) return;
    setOk(null);
    const res = await apiGet<Record<string, unknown>>(
      `/api/v1/tax/seasonal-report?companyId=${workspace.companyId}&year=${year}&season=${season}`,
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    const json = JSON.stringify(res.data, null, 2);
    setSeasonalJson(json);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seasonal-${year}-q${season}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOk("گزارش فصلی دانلود شد.");
  }

  const cols: GridColumn<VatRow>[] = [
    { key: "date", header: "تاریخ", ltr: true, render: (r) => r.dateJalali },
    { key: "doc", header: "شماره سند", ltr: true, render: (r) => r.documentNumber },
    { key: "dir", header: "نوع", render: (r) => (r.direction === "Sale" ? "فروش" : "خرید") },
    { key: "base", header: "پایه", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.baseAmount) },
    { key: "tax", header: "مالیات", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.taxAmount) },
  ];

  return (
    <AppShell title="مالیات و گزارش‌ها">
      {error ? <ErrorState message={error} /> : null}
      {ok ? <SuccessBanner message={ok} /> : null}

      <p className="muted">
        ارسال به سامانه مودیان: <Link href="/tax/moadian">صفحه مودیان</Link>
      </p>

      <section className="panel">
        <h2>کد مالیات ایران</h2>
        <button type="button" className="btn-secondary" onClick={() => void seedVat()}>
          Seed مالیات ارزش افزوده
        </button>
      </section>

      <section className="panel">
        <h2>کاربرگ ارزش افزوده</h2>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void loadVat();
          }}
        >
          <label>
            از تاریخ
            <JalaliDatePicker value={fromJalali} onChange={setFromJalali} required />
          </label>
          <label>
            تا تاریخ
            <JalaliDatePicker value={toJalali} onChange={setToJalali} required />
          </label>
          <button type="submit" className="btn-primary">
            بارگذاری
          </button>
        </form>
        {netVat !== null ? <p>خالص مالیات قابل پرداخت: {formatMoneyIrr(netVat)}</p> : null}
        <DataGrid
          columns={cols}
          rows={vatRows}
          totalCount={vatRows.length}
          page={1}
          pageSize={Math.max(vatRows.length, 1)}
          onPageChange={() => undefined}
          rowKey={(r) => r.id}
          emptyTitle="ردیف مالیاتی یافت نشد"
        />
      </section>

      <section className="panel">
        <h2>گزارش معاملات فصلی</h2>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void loadSeasonal();
          }}
        >
          <label>
            سال شمسی
            <input value={year} onChange={(e) => setYear(e.target.value)} required />
          </label>
          <label>
            فصل (۱–۴)
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="1">۱ — بهار</option>
              <option value="2">۲ — تابستان</option>
              <option value="3">۳ — پاییز</option>
              <option value="4">۴ — زمستان</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">
            دانلود JSON
          </button>
        </form>
        {seasonalJson ? (
          <pre className="code-block" style={{ maxHeight: 240, overflow: "auto" }}>
            {seasonalJson}
          </pre>
        ) : null}
      </section>
    </AppShell>
  );
}
