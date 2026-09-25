"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged } from "@/lib/api";

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  correlationId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  occurredAtUtc: string;
  occurredAtJalali: string;
};

type Filters = { action: string; entityType: string; entityId: string; actor: string; fromJalali: string; toJalali: string };

const EMPTY: Filters = { action: "", entityType: "", entityId: "", actor: "", fromJalali: "", toJalali: "" };

const tehranTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatWhen(utc: string, fallback: string): string {
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? fallback : tehranTime.format(d);
}

function mapRow(r: Record<string, unknown>): AuditRow {
  return {
    id: String(r.id ?? r.Id),
    actor: String(r.actor ?? r.Actor ?? ""),
    action: String(r.action ?? r.Action ?? ""),
    entityType: String(r.entityType ?? r.EntityType ?? ""),
    entityId: String(r.entityId ?? r.EntityId ?? ""),
    reason: (r.reason ?? r.Reason ?? null) as string | null,
    correlationId: (r.correlationId ?? r.CorrelationId ?? null) as string | null,
    beforeJson: (r.beforeJson ?? r.BeforeJson ?? null) as string | null,
    afterJson: (r.afterJson ?? r.AfterJson ?? null) as string | null,
    occurredAtUtc: String(r.occurredAtUtc ?? r.OccurredAtUtc ?? ""),
    occurredAtJalali: String(r.occurredAtJalali ?? r.OccurredAtJalali ?? ""),
  };
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
    (Object.keys(applied) as (keyof Filters)[]).forEach((k) => {
      if (applied[k]) qs.set(k, applied[k]);
    });
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/audit?${qs}`);
    if (res.error) {
      setError(res.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows((res.data?.items ?? []).map(mapRow));
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof Filters) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const columns: GridColumn<AuditRow>[] = [
    { key: "when", header: "زمان (تهران)", render: (r) => formatWhen(r.occurredAtUtc, r.occurredAtJalali) },
    { key: "actor", header: "کاربر", ltr: true, render: (r) => r.actor },
    { key: "action", header: "رویداد", ltr: true, render: (r) => r.action },
    { key: "type", header: "نوع موجودیت", ltr: true, render: (r) => r.entityType },
    { key: "id", header: "شناسه", ltr: true, render: (r) => r.entityId.slice(0, 13) },
    { key: "reason", header: "دلیل", render: (r) => r.reason ?? "—" },
    {
      key: "detail",
      header: "جزئیات",
      render: (r) => (
        <button type="button" className="btn-ghost" onClick={() => setSelected(r)}>
          مشاهده
        </button>
      ),
    },
  ];

  return (
    <AppShell title="رویدادهای ممیزی">
      <div className="stack">
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        <p className="muted">
          رکوردهای ممیزی فقط‌خواندنی و غیرقابل حذف هستند. عملیات ثبت، برگشت، بستن دوره، حذف پیش‌نویس و مدیریت کلید API در این
          فهرست ثبت می‌شود.
        </p>

        <form
          className="panel form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
            setPage(1);
          }}
        >
          <label>
            رویداد
            <input className="ltr" value={draft.action} onChange={(e) => set("action")(e.target.value)} placeholder="JOURNAL_POST" />
          </label>
          <label>
            نوع موجودیت
            <input className="ltr" value={draft.entityType} onChange={(e) => set("entityType")(e.target.value)} placeholder="JournalBatch" />
          </label>
          <label>
            شناسه موجودیت
            <input className="ltr" value={draft.entityId} onChange={(e) => set("entityId")(e.target.value)} />
          </label>
          <label>
            کاربر
            <input className="ltr" value={draft.actor} onChange={(e) => set("actor")(e.target.value)} />
          </label>
          <label>
            از تاریخ
            <JalaliDatePicker value={draft.fromJalali} onChange={set("fromJalali")} />
          </label>
          <label>
            تا تاریخ
            <JalaliDatePicker value={draft.toJalali} onChange={set("toJalali")} />
          </label>
          <div style={{ alignSelf: "end" }} className="page-actions">
            <button type="submit" className="btn-secondary">
              اعمال فیلتر
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(EMPTY);
                setApplied(EMPTY);
                setPage(1);
              }}
            >
              حذف فیلترها
            </button>
          </div>
        </form>

        <div className="panel">
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={25}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="رویدادی ثبت نشده"
          />
        </div>

        {selected ? (
          <section className="panel stack" aria-label="جزئیات رویداد">
            <div className="page-actions" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>
                <span className="ltr">{selected.action}</span> · {formatWhen(selected.occurredAtUtc, selected.occurredAtJalali)}
              </h2>
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
                بستن
              </button>
            </div>
            <p className="muted ltr">
              {selected.entityType} / {selected.entityId}
              {selected.correlationId ? ` · correlation ${selected.correlationId}` : ""}
            </p>
            {selected.beforeJson ? (
              <>
                <strong>قبل</strong>
                <pre className="ltr" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.beforeJson}</pre>
              </>
            ) : null}
            {selected.afterJson ? (
              <>
                <strong>بعد</strong>
                <pre className="ltr" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.afterJson}</pre>
              </>
            ) : null}
            {!selected.beforeJson && !selected.afterJson ? <p className="muted">اطلاعات تکمیلی ثبت نشده است.</p> : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
