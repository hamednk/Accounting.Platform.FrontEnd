"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { SendToAssistant } from "@/components/ai/SendToAssistant";
import { actionFa, journalKindFa, statusFa } from "@/lib/labels";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { StatusChip } from "@/components/ui/StatusChip";
import { ErrorState, Panel, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useCan } from "@/components/auth/AuthGate";

type Journal = {
  id: string;
  documentNumber: string;
  documentDateJalali: string;
  description: string;
  status: string;
  kind: string;
  totalDebit: number;
};

type Account = { id: string; code: string; name: string };
type LineDraft = { accountId: string; description: string; debit: string; credit: string };

const JOURNAL_STATUSES = ["Draft", "Submitted", "Approved", "Posted", "Reversed"] as const;

const emptyLines = (): LineDraft[] => [
  { accountId: "", description: "بدهکار", debit: "0", credit: "0" },
  { accountId: "", description: "بستانکار", debit: "0", credit: "0" },
];

export default function JournalsPage() {
  const { workspace } = useWorkspace();
  const can = useCan();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [docFilter, setDocFilter] = useState("");
  const [docInput, setDocInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const [rows, setRows] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [desc, setDesc] = useState("سند دستی");
  const [dateJalali, setDateJalali] = useState("1405/01/15");
  const [lines, setLines] = useState<LineDraft[]>(emptyLines);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (filter) qs.set("status", filter);
    if (docFilter) qs.set("documentNumber", docFilter);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/journal-batches?${qs}`);
    if (res.error) {
      setError(res.error);
      setRows([]);
    } else {
      setError(null);
      setRows(
        (res.data?.items ?? []).map((r) => ({
          id: String(r.id ?? r.Id),
          documentNumber: String(r.documentNumber ?? r.DocumentNumber ?? ""),
          documentDateJalali: String(r.documentDateJalali ?? r.DocumentDateJalali ?? ""),
          description: String(r.description ?? r.Description ?? ""),
          status: String(r.status ?? r.Status ?? ""),
          kind: String(r.kind ?? r.Kind ?? "Normal"),
          totalDebit: Number(r.totalDebit ?? r.TotalDebit ?? 0),
        })),
      );
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page, filter, docFilter]);

  const loadAccounts = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
    setAccounts(
      (res.data?.items ?? []).map((r) => ({
        id: String(r.id ?? r.Id),
        code: String(r.code ?? r.Code ?? ""),
        name: String(r.name ?? r.Name ?? ""),
      })),
    );
  }, []);

  useEffect(() => {
    void load();
    void loadAccounts();
  }, [load, loadAccounts]);

  const balance = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, ok: d === c && d > 0 };
  }, [lines]);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (!workspace.periodId) {
      setError("دوره مالی را از نوار بالا انتخاب کنید.");
      return;
    }
    if (!balance.ok) {
      setError("سند باید تراز و مبلغ‌دار باشد.");
      return;
    }
    const payload = {
      fiscalPeriodId: workspace.periodId,
      documentDateJalali: dateJalali,
      description: desc,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        description: l.description,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
    };
    const res = editingId
      ? await apiSend<Record<string, unknown>>(`/api/v1/journal-batches/${editingId}`, "PUT", payload)
      : await apiSend<Record<string, unknown>>("/api/v1/journal-batches", "POST", payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    const number = String(res.data?.documentNumber ?? res.data?.DocumentNumber ?? "");
    setOk(editingId ? `پیش‌نویس ${number} به‌روزرسانی شد.` : `پیش‌نویس ${number} ساخته شد.`);
    resetForm();
    await load();
  }

  function resetForm() {
    setEditingId(null);
    setEditingNumber("");
    setDesc("سند دستی");
    setLines(emptyLines());
  }

  async function startEdit(row: Journal) {
    setOk(null);
    const res = await apiGet<Record<string, unknown>>(`/api/v1/journal-batches/${row.id}`);
    if (res.error || !res.data) {
      setError(res.error ?? "سند یافت نشد.");
      return;
    }
    const d = res.data;
    const rawLines = (d.lines ?? d.Lines ?? []) as Record<string, unknown>[];
    setEditingId(row.id);
    setEditingNumber(row.documentNumber);
    setDesc(String(d.description ?? d.Description ?? ""));
    setDateJalali(String(d.documentDateJalali ?? d.DocumentDateJalali ?? dateJalali));
    setLines(
      rawLines.map((l) => ({
        accountId: String(l.accountId ?? l.AccountId ?? ""),
        description: String(l.description ?? l.Description ?? ""),
        debit: String(l.debit ?? l.Debit ?? 0),
        credit: String(l.credit ?? l.Credit ?? 0),
      })),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteDraft(row: Journal) {
    setOk(null);
    const res = await apiSend(`/api/v1/journal-batches/${row.id}`, "DELETE");
    if (res.error) throw new Error(res.error);
    if (editingId === row.id) resetForm();
    setOk(`پیش‌نویس ${row.documentNumber} حذف شد.`);
    await load();
  }

  async function workflow(id: string, action: "submit" | "approve" | "post" | "reverse") {
    setOk(null);
    const path =
      action === "post"
        ? `/api/v1/journal-batches/${id}/post`
        : `/api/v1/journal-batches/${id}/${action}`;
    const res = await apiSend(path, "POST", undefined, action === "post" ? `post-${id}` : undefined);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk(`عملیات «${actionFa(action)}» انجام شد.`);
    await load();
  }

  const columns: GridColumn<Journal>[] = [
    { key: "num", header: "شماره", ltr: true, render: (r) => r.documentNumber },
    { key: "date", header: "تاریخ", render: (r) => r.documentDateJalali },
    { key: "desc", header: "شرح", render: (r) => r.description },
    { key: "kind", header: "نوع سند", render: (r) => journalKindFa(r.kind) },
    { key: "st", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    {
      key: "amt",
      header: "جمع",
      align: "end",
      ltr: true,
      render: (r) => formatMoneyIrr(r.totalDebit),
    },
    {
      key: "act",
      header: "اقدام",
      render: (r) => (
        <div className="page-actions">
          {r.status === "Draft" ? (
            <>
              <button type="button" className="btn-ghost" onClick={() => void workflow(r.id, "submit")}>
                ارسال
              </button>
              {can("ACCOUNTING.JOURNAL.DRAFT") ? (
                <>
                  <button type="button" className="btn-ghost" onClick={() => void startEdit(r)}>
                    ویرایش
                  </button>
                  <ConfirmAction
                    title="حذف پیش‌نویس سند"
                    reference={r.documentNumber}
                    consequences={["فقط پیش‌نویس حذف می‌شود و در رویدادهای ممیزی ثبت می‌گردد.", "سند ثبت‌شده هرگز حذف نمی‌شود؛ فقط برگشت می‌خورد."]}
                    confirmLabel="حذف پیش‌نویس"
                    onConfirm={() => deleteDraft(r)}
                  >
                    {(open) => (
                      <button type="button" className="btn-danger" onClick={open}>
                        حذف
                      </button>
                    )}
                  </ConfirmAction>
                </>
              ) : null}
            </>
          ) : null}
          {r.status === "Submitted" && can("ACCOUNTING.JOURNAL.APPROVE") ? (
            <button type="button" className="btn-ghost" onClick={() => void workflow(r.id, "approve")}>
              تأیید
            </button>
          ) : null}
          {r.status === "Approved" && can("ACCOUNTING.JOURNAL.POST") ? (
            <ConfirmAction
              title="ثبت نهایی سند در دفترکل"
              reference={r.documentNumber}
              consequences={["پس از ثبت قابل ویرایش نیست.", "اصلاح فقط با برگشت/تعدیل."]}
              confirmLabel="ثبت نهایی"
              onConfirm={() => workflow(r.id, "post")}
            >
              {(open) => (
                <button type="button" className="btn-danger" onClick={open}>
                  ثبت
                </button>
              )}
            </ConfirmAction>
          ) : null}
          {r.status === "Posted" && can("ACCOUNTING.JOURNAL.REVERSE") ? (
            <ConfirmAction
              title="برگشت سند"
              reference={r.documentNumber}
              consequences={["سند برگشت جدید صادر می‌شود.", "سند اصلی تغییر محتوا نمی‌کند."]}
              confirmLabel="برگشت"
              onConfirm={() => workflow(r.id, "reverse")}
            >
              {(open) => (
                <button type="button" className="btn-ghost" onClick={open}>
                  برگشت
                </button>
              )}
            </ConfirmAction>
          ) : null}
          <Link className="btn-ghost" href={`/print/journal/${r.id}`} target="_blank">
            چاپ
          </Link>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="اسناد حسابداری"
      actions={
        <>
          <Link className="btn-ghost" href="/journals/recurring">
            اسناد تکراری
          </Link>
          <SendToAssistant title="اسناد حسابداری" prompt="این اسناد را بررسی کن و موارد غیرعادی یا ناتراز را بگو" data={rows.slice(0, 40)} />
        </>
      }
    >
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <form className="panel stack" onSubmit={createDraft}>
          <div className="panel-head">
            <div>
              <h2 className="panel-title">
                {editingId ? (
                  <>
                    ویرایش پیش‌نویس <span className="ltr">{editingNumber}</span>
                  </>
                ) : (
                  "ایجاد پیش‌نویس سند"
                )}
              </h2>
              <p className="panel-desc muted">فقط پیش‌نویس ذخیره می‌شود؛ ثبت نهایی از جدول زیر انجام می‌شود.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              تاریخ شمسی
              <JalaliDatePicker value={dateJalali} onChange={setDateJalali} required />
            </label>
            <label>
              شرح
              <textarea className="field-control" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} required />
            </label>
            <div style={{ alignSelf: "end" }} className={balance.ok ? "muted" : "state-error"}>
              بدهکار {formatMoneyIrr(balance.d)} / بستانکار {formatMoneyIrr(balance.c)}
            </div>
          </div>

          {lines.map((line, idx) => (
            <div className="form-grid" key={idx}>
              <label>
                حساب
                <select
                  value={line.accountId}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, accountId: e.target.value };
                    setLines(next);
                  }}
                  required
                >
                  <option value="">انتخاب…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                شرح سطر
                <textarea
                  className="field-control"
                  rows={2}
                  value={line.description}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, description: e.target.value };
                    setLines(next);
                  }}
                />
              </label>
              <label>
                بدهکار
                <input
                  className="ltr"
                  value={line.debit}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, debit: e.target.value, credit: "0" };
                    setLines(next);
                  }}
                />
              </label>
              <label>
                بستانکار
                <input
                  className="ltr"
                  value={line.credit}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, credit: e.target.value, debit: "0" };
                    setLines(next);
                  }}
                />
              </label>
              {lines.length > 2 ? (
                <div style={{ alignSelf: "end" }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  >
                    حذف سطر
                  </button>
                </div>
              ) : null}
            </div>
          ))}

          <div className="page-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                setLines([...lines, { accountId: "", description: "", debit: "0", credit: "0" }])
              }
            >
              سطر جدید
            </button>
            <button type="submit" className="btn-primary">
              {editingId ? "ذخیره تغییرات پیش‌نویس" : "ذخیره پیش‌نویس"}
            </button>
            {editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                انصراف از ویرایش
              </button>
            ) : null}
          </div>
        </form>

        <div className="panel stack">
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              setDocFilter(docInput.trim());
              setPage(1);
            }}
          >
            <label>
              وضعیت
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه</option>
                {JOURNAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusFa(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              شماره سند
              <input className="ltr" value={docInput} onChange={(e) => setDocInput(e.target.value)} placeholder="JV-" />
            </label>
            <div style={{ alignSelf: "end" }} className="page-actions">
              <button type="submit" className="btn-secondary">
                اعمال فیلتر
              </button>
              {filter || docFilter ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setFilter("");
                    setDocFilter("");
                    setDocInput("");
                    setPage(1);
                  }}
                >
                  حذف فیلترها
                </button>
              ) : null}
            </div>
          </form>
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="سندی نیست"
            savedViewKey="journals"
          />
        </div>
      </div>
    </AppShell>
  );
}
