"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { useCan } from "@/components/auth/AuthGate";

type Account = { id: string; code: string; name: string };
type LineDraft = { accountId: string; description: string; debit: string; credit: string };
type TemplateLine = { accountId: string; description: string; debit: number; credit: number };
type Template = {
  id: string;
  code: string;
  name: string;
  description: string;
  frequency: string;
  dayOfMonth: number;
  nextRunJalali: string;
  endJalali: string | null;
  isActive: boolean;
  lastRunJalali: string | null;
  generatedCount: number;
  totalDebit: number;
  lines: TemplateLine[];
};

const FREQUENCIES: { value: string; label: string }[] = [
  { value: "Monthly", label: "ماهانه" },
  { value: "Quarterly", label: "فصلی" },
  { value: "Yearly", label: "سالانه" },
];

const frequencyFa = (v: string) => FREQUENCIES.find((f) => f.value === v)?.label ?? v;

const emptyLines = (): LineDraft[] => [
  { accountId: "", description: "بدهکار", debit: "0", credit: "0" },
  { accountId: "", description: "بستانکار", debit: "0", credit: "0" },
];

function mapTemplate(r: Record<string, unknown>): Template {
  const rawLines = (r.lines ?? r.Lines ?? []) as Record<string, unknown>[];
  return {
    id: String(r.id ?? r.Id),
    code: String(r.code ?? r.Code ?? ""),
    name: String(r.name ?? r.Name ?? ""),
    description: String(r.description ?? r.Description ?? ""),
    frequency: String(r.frequency ?? r.Frequency ?? "Monthly"),
    dayOfMonth: Number(r.dayOfMonth ?? r.DayOfMonth ?? 1),
    nextRunJalali: String(r.nextRunJalali ?? r.NextRunJalali ?? ""),
    endJalali: (r.endJalali ?? r.EndJalali ?? null) as string | null,
    isActive: Boolean(r.isActive ?? r.IsActive),
    lastRunJalali: (r.lastRunJalali ?? r.LastRunJalali ?? null) as string | null,
    generatedCount: Number(r.generatedCount ?? r.GeneratedCount ?? 0),
    totalDebit: Number(r.totalDebit ?? r.TotalDebit ?? 0),
    lines: rawLines.map((l) => ({
      accountId: String(l.accountId ?? l.AccountId ?? ""),
      description: String(l.description ?? l.Description ?? ""),
      debit: Number(l.debit ?? l.Debit ?? 0),
      credit: Number(l.credit ?? l.Credit ?? 0),
    })),
  };
}

export default function RecurringJournalsPage() {
  const can = useCan();
  const canEdit = can("ACCOUNTING.JOURNAL.DRAFT");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("RENT");
  const [name, setName] = useState("اجاره ماهانه");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("Monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [nextRun, setNextRun] = useState("1405/02/01");
  const [endDate, setEndDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(emptyLines);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (activeFilter) qs.set("isActive", activeFilter);
    if (search) qs.set("search", search);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/recurring-journals?${qs}`);
    if (res.error) {
      setError(res.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows((res.data?.items ?? []).map(mapTemplate));
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page, activeFilter, search]);

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
  }, [load]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const balance = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, ok: d === c && d > 0 };
  }, [lines]);

  function resetForm() {
    setEditingId(null);
    setCode("RENT");
    setName("اجاره ماهانه");
    setDescription("");
    setFrequency("Monthly");
    setDayOfMonth("1");
    setEndDate("");
    setLines(emptyLines());
  }

  function startEdit(t: Template) {
    setOk(null);
    setEditingId(t.id);
    setCode(t.code);
    setName(t.name);
    setDescription(t.description);
    setFrequency(t.frequency);
    setDayOfMonth(String(t.dayOfMonth));
    setNextRun(t.nextRunJalali);
    setEndDate(t.endJalali ?? "");
    setLines(
      t.lines.map((l) => ({
        accountId: l.accountId,
        description: l.description,
        debit: String(l.debit),
        credit: String(l.credit),
      })),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (!balance.ok) {
      setError("سطرهای سند تکراری باید تراز و مبلغ‌دار باشند.");
      return;
    }
    const payload = {
      code,
      name,
      description,
      frequency,
      dayOfMonth: Number(dayOfMonth),
      nextRunJalali: nextRun,
      endJalali: endDate || null,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        description: l.description,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
    };
    const res = editingId
      ? await apiSend(`/api/v1/recurring-journals/${editingId}`, "PUT", payload)
      : await apiSend("/api/v1/recurring-journals", "POST", payload);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setOk(editingId ? "سند تکراری به‌روزرسانی شد." : "سند تکراری تعریف شد.");
    resetForm();
    await load();
  }

  async function toggleActive(t: Template) {
    setOk(null);
    const res = await apiSend(`/api/v1/recurring-journals/${t.id}/active`, "POST", { isActive: !t.isActive });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk(t.isActive ? "سند تکراری غیرفعال شد." : "سند تکراری فعال شد.");
    await load();
  }

  async function generate(t: Template) {
    setOk(null);
    const res = await apiSend<Record<string, unknown>>(
      `/api/v1/recurring-journals/${t.id}/generate`,
      "POST",
      {},
      `recurring-${t.id}-${t.nextRunJalali.split("/").join("")}`,
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    const journal = (res.data?.journal ?? res.data?.Journal ?? {}) as Record<string, unknown>;
    const number = String(journal.documentNumber ?? journal.DocumentNumber ?? "");
    const created = Boolean(res.data?.created ?? res.data?.Created);
    setError(null);
    setOk(
      created
        ? `پیش‌نویس ${number} برای ${t.nextRunJalali} ساخته شد؛ ثبت نهایی از صفحه اسناد انجام می‌شود.`
        : `این اجرا قبلاً پیش‌نویس ${number} را ساخته است.`,
    );
    await load();
  }

  const columns: GridColumn<Template>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "عنوان", render: (r) => r.name },
    { key: "freq", header: "تکرار", render: (r) => `${frequencyFa(r.frequency)} · روز ${r.dayOfMonth}` },
    { key: "next", header: "اجرای بعدی", render: (r) => r.nextRunJalali },
    { key: "last", header: "آخرین اجرا", render: (r) => r.lastRunJalali ?? "—" },
    { key: "cnt", header: "تعداد", align: "end", ltr: true, render: (r) => r.generatedCount },
    { key: "amt", header: "مبلغ", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.totalDebit) },
    { key: "st", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "act",
      header: "اقدام",
      render: (r) =>
        canEdit ? (
          <div className="page-actions">
            {r.isActive ? (
              <button type="button" className="btn-secondary" onClick={() => void generate(r)}>
                ساخت پیش‌نویس
              </button>
            ) : null}
            <button type="button" className="btn-ghost" onClick={() => startEdit(r)}>
              ویرایش
            </button>
            <button type="button" className="btn-ghost" onClick={() => void toggleActive(r)}>
              {r.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <AppShell
      title="اسناد تکراری"
      actions={
        <Link className="btn-ghost" href="/journals">
          بازگشت به اسناد
        </Link>
      }
    >
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        <p className="muted">
          هر اجرا فقط یک <strong>پیش‌نویس</strong> سند می‌سازد؛ ارسال، تأیید و ثبت نهایی مانند سایر اسناد انجام می‌شود. اجرای
          تکراری برای یک تاریخ، پیش‌نویس قبلی را برمی‌گرداند.
        </p>

        {canEdit ? (
          <form className="panel stack" onSubmit={save}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{editingId ? "ویرایش سند تکراری" : "تعریف سند تکراری"}</h2>
            <div className="form-grid">
              <label>
                کد
                <input className="ltr" value={code} onChange={(e) => setCode(e.target.value)} required disabled={!!editingId} />
              </label>
              <label>
                عنوان
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                شرح
                <textarea className="field-control" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label>
                دوره تکرار
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                روز ماه (۱ تا ۳۱)
                <input
                  className="ltr"
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  required
                />
              </label>
              <label>
                اجرای بعدی
                <JalaliDatePicker value={nextRun} onChange={setNextRun} required />
              </label>
              <label>
                تاریخ پایان (اختیاری)
                <JalaliDatePicker value={endDate} onChange={setEndDate} />
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
                    <button type="button" className="btn-ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
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
                onClick={() => setLines([...lines, { accountId: "", description: "", debit: "0", credit: "0" }])}
              >
                سطر جدید
              </button>
              <button type="submit" className="btn-primary">
                {editingId ? "ذخیره تغییرات" : "ذخیره سند تکراری"}
              </button>
              {editingId ? (
                <button type="button" className="btn-ghost" onClick={resetForm}>
                  انصراف
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        <div className="panel stack">
          <div className="form-grid">
            <label>
              وضعیت
              <select
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه</option>
                <option value="true">فعال</option>
                <option value="false">غیرفعال</option>
              </select>
            </label>
          </div>
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            filterValue={search}
            onFilterChange={setSearch}
            filterPlaceholder="جستجو در کد یا عنوان"
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="سند تکراری تعریف نشده"
          />
        </div>
      </div>
    </AppShell>
  );
}
