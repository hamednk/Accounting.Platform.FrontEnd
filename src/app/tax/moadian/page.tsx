"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";

type Status = {
  enabled: boolean;
  mode: string;
  client: string;
  autoQueue: boolean;
  privateKeyConfigured: boolean;
  memoryIdConfigured: string | null;
};

type Row = {
  id: string;
  salesInvoiceId: string;
  documentNumber: string;
  invoiceDateJalali: string;
  status: string;
  statusFa: string;
  externalUid?: string | null;
  taxId?: string | null;
  lastError?: string | null;
  attempts: number;
};

function pick<T>(r: Record<string, unknown>, k: string): T {
  return (r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)]) as T;
}

function mapRow(r: Record<string, unknown>): Row {
  return {
    id: String(pick(r, "id")),
    salesInvoiceId: String(pick(r, "salesInvoiceId")),
    documentNumber: String(pick(r, "documentNumber") ?? ""),
    invoiceDateJalali: String(pick(r, "invoiceDateJalali") ?? ""),
    status: String(pick(r, "status") ?? ""),
    statusFa: String(pick(r, "statusFa") ?? pick(r, "status") ?? ""),
    externalUid: pick(r, "externalUid") as string | null,
    taxId: pick(r, "taxId") as string | null,
    lastError: pick(r, "lastError") as string | null,
    attempts: Number(pick(r, "attempts") ?? 0),
  };
}

export default function MoadianPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (filter) q.set("status", filter);
    const [sRes, list] = await Promise.all([
      apiGet<Record<string, unknown>>("/api/v1/moadian/status"),
      apiGetPaged<Record<string, unknown>>(`/api/v1/moadian/submissions?${q}`),
    ]);
    if (sRes.error) setError(sRes.error);
    if (list.error) setError(list.error);
    if (sRes.data) {
      setStatus({
        enabled: pick<boolean>(sRes.data, "enabled") === true,
        mode: String(pick(sRes.data, "mode") ?? ""),
        client: String(pick(sRes.data, "client") ?? ""),
        autoQueue: pick<boolean>(sRes.data, "autoQueue") === true,
        privateKeyConfigured: pick<boolean>(sRes.data, "privateKeyConfigured") === true,
        memoryIdConfigured: (pick(sRes.data, "memoryIdConfigured") as string | null) ?? null,
      });
    }
    setRows((list.data?.items ?? []).map(mapRow));
    setTotal(list.data?.totalCount ?? 0);
    setLoading(false);
  }, [page, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id: string) {
    const res = await apiSend(`/api/v1/moadian/submissions/${id}/retry`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("دوباره در صف ارسال قرار گرفت.");
    await load();
  }

  async function processDue() {
    const res = await apiSend<{ processed: number }>("/api/v1/moadian/process-due", "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk(`${res.data?.processed ?? 0} مورد پردازش شد.`);
    await load();
  }

  const columns: GridColumn<Row>[] = [
    { key: "d", header: "شماره", ltr: true, render: (r) => r.documentNumber },
    { key: "dt", header: "تاریخ", ltr: true, render: (r) => r.invoiceDateJalali },
    { key: "s", header: "وضعیت", render: (r) => r.statusFa },
    { key: "t", header: "شناسه مالیاتی", ltr: true, render: (r) => r.taxId ?? "—" },
    { key: "e", header: "خطا", render: (r) => r.lastError ?? "—" },
    { key: "a", header: "تلاش", ltr: true, render: (r) => String(r.attempts) },
    {
      key: "x",
      header: "اقدام",
      render: (r) =>
        r.status === "Accepted" || r.status === "Cancelled" ? null : (
          <button type="button" className="btn-ghost" onClick={() => void retry(r.id)}>
            ارسال دوباره
          </button>
        ),
    },
  ];

  return (
    <AppShell title="سامانه مودیان">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>وضعیت اتصال</h2>
          {status ? (
            <ul style={{ margin: 0, paddingInlineStart: "1.2rem" }}>
              <li>فعال: {status.enabled ? "بله" : "خیر"}</li>
              <li>
                حالت: <span className="ltr">{status.mode}</span> / کلاینت: <span className="ltr">{status.client}</span>
              </li>
              <li>صف خودکار پس از فاکتور فروش: {status.autoQueue ? "بله" : "خیر"}</li>
              <li>شناسه حافظه مالیاتی: {status.memoryIdConfigured ?? "پیکربندی نشده"}</li>
              <li>کلید خصوصی: {status.privateKeyConfigured ? "پیکربندی شده" : "نیست (sandbox نیاز ندارد)"}</li>
            </ul>
          ) : (
            <p className="muted">در حال بارگذاری…</p>
          )}
          <div className="page-actions">
            <button type="button" className="btn-secondary" onClick={() => void processDue()}>
              پردازش صف
            </button>
          </div>
        </section>

        <section className="panel form-grid">
          <label>
            فیلتر وضعیت
            <select
              value={filter}
              onChange={(e) => {
                setPage(1);
                setFilter(e.target.value);
              }}
            >
              <option value="">همه</option>
              <option value="Pending">در انتظار</option>
              <option value="Submitted">ارسال‌شده</option>
              <option value="Accepted">پذیرفته‌شده</option>
              <option value="Rejected">ردشده</option>
              <option value="Cancelled">لغو‌شده</option>
            </select>
          </label>
        </section>

        <div className="panel">
          <DataGrid columns={columns} rows={rows} totalCount={total} page={page} pageSize={20} onPageChange={setPage} rowKey={(r) => r.id} loading={loading} emptyTitle="ارسالی ثبت نشده" />
        </div>
      </div>
    </AppShell>
  );
}
