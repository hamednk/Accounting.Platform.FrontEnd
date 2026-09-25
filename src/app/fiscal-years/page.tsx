"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { accountTypeFa, statusFa } from "@/lib/labels";
import { StatusChip } from "@/components/ui/StatusChip";

type Year = { id: string; jalaliYear: number; startJalali: string; endJalali: string; isClosed: boolean; closedBy: string | null };
type Period = { id: string; fiscalYearId: string; periodNumber: number; name: string; startJalali: string; endJalali: string; status: string };
type Preview = {
  netIncome: number;
  unpostedJournals: number;
  permanentBalanceCount: number;
  warnings: string[];
  canClose: boolean;
  temporaryAccounts: { accountId: string; accountCode: string; accountName: string; accountType: string; balance: number }[];
};
type EquityAccount = { id: string; label: string; code: string };

function str(r: Record<string, unknown>, k: string): string {
  return String(r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)] ?? "");
}

export default function FiscalYearsPage() {
  const { workspace, refresh } = useWorkspace();
  const companyId = workspace.companyId;
  const [years, setYears] = useState<Year[]>([]);
  const [yearTotal, setYearTotal] = useState(0);
  const [yearPage, setYearPage] = useState(1);
  const [selected, setSelected] = useState<Year | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [equity, setEquity] = useState<EquityAccount[]>([]);
  const [reAccount, setReAccount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadYears = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/companies/${companyId}/fiscal-years?page=${yearPage}&pageSize=10`);
    if (res.error) setError(res.error);
    else {
      const items = (res.data?.items ?? []).map((r) => ({
        id: str(r, "id"),
        jalaliYear: Number(r.jalaliYear ?? r.JalaliYear),
        startJalali: str(r, "startJalali"),
        endJalali: str(r, "endJalali"),
        isClosed: Boolean(r.isClosed ?? r.IsClosed),
        closedBy: (r.closedBy ?? r.ClosedBy ?? null) as string | null,
      }));
      setYears(items);
      setYearTotal(res.data?.totalCount ?? 0);
      setSelected((prev) => (prev ? items.find((y) => y.id === prev.id) ?? prev : items[0] ?? null));
    }
    setLoading(false);
  }, [companyId, yearPage]);

  const loadYearDetail = useCallback(async () => {
    if (!companyId || !selected) return;
    const [periodRes, previewRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>(`/api/v1/companies/${companyId}/fiscal-periods?page=1&pageSize=200`),
      apiGet<Preview>(`/api/v1/fiscal-years/${selected.id}/close-preview`),
    ]);
    if (periodRes.error) setError(periodRes.error);
    else
      setPeriods(
        (periodRes.data?.items ?? [])
          .map((r) => ({
            id: str(r, "id"),
            fiscalYearId: str(r, "fiscalYearId"),
            periodNumber: Number(r.periodNumber ?? r.PeriodNumber),
            name: str(r, "name"),
            startJalali: str(r, "startJalali"),
            endJalali: str(r, "endJalali"),
            status: str(r, "status"),
          }))
          .filter((p) => p.fiscalYearId === selected.id)
          .sort((a, b) => a.periodNumber - b.periodNumber),
      );
    if (previewRes.data) setPreview(previewRes.data);
    else if (previewRes.error) setError(previewRes.error);
  }, [companyId, selected]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  useEffect(() => {
    void loadYearDetail();
  }, [loadYearDetail]);

  useEffect(() => {
    if (!companyId) return;
    void apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true&accountType=Equity").then((res) => {
      const items = (res.data?.items ?? []).map((r) => ({ id: str(r, "id"), code: str(r, "code"), label: `${str(r, "code")} — ${str(r, "name")}` }));
      setEquity(items);
      setReAccount((prev) => prev || items.find((a) => a.code.startsWith("32"))?.id || items[0]?.id || "");
    });
  }, [companyId]);

  async function reloadAll(message: string) {
    setOk(message);
    setError(null);
    await loadYears();
    await loadYearDetail();
    await refresh();
  }

  async function periodAction(p: Period, action: "soft-close" | "close" | "reopen") {
    if (action === "reopen" && !reason.trim()) {
      setError("برای بازگشایی دوره، دلیل را در کادر «دلیل بازگشایی» بنویسید.");
      return;
    }
    const res = await apiSend(`/api/v1/fiscal-periods/${p.id}/${action}`, "POST", action === "reopen" ? { reason } : undefined);
    if (res.error) {
      setError(res.error);
      return;
    }
    await reloadAll(`دوره ${p.name}: ${action === "reopen" ? "بازگشایی شد" : action === "close" ? "بسته شد" : "نیمه‌بسته شد"}.`);
  }

  async function closeYear() {
    if (!selected) return;
    if (!reAccount) throw new Error("حساب سود و زیان انباشته را انتخاب کنید.");
    const key = `year-close-${selected.id}-${crypto.randomUUID()}`;
    const res = await apiSend(`/api/v1/fiscal-years/${selected.id}/close`, "POST", { retainedEarningsAccountId: reAccount }, key);
    if (res.error) throw new Error(res.error);
    await reloadAll(`سال ${selected.jalaliYear} بسته شد؛ اسناد بستن حساب‌های موقت، اختتامیه و افتتاحیه سال بعد ثبت شدند.`);
  }

  async function reopenYear() {
    if (!selected) return;
    if (!reason.trim()) throw new Error("دلیل بازگشایی الزامی است.");
    const res = await apiSend(`/api/v1/fiscal-years/${selected.id}/reopen`, "POST", { reason });
    if (res.error) throw new Error(res.error);
    setReason("");
    await reloadAll(`سال ${selected.jalaliYear} بازگشایی شد و اسناد پایان سال برگشت خوردند.`);
  }

  const yearColumns: GridColumn<Year>[] = [
    { key: "year", header: "سال", ltr: true, render: (y) => y.jalaliYear },
    { key: "range", header: "بازه", ltr: true, render: (y) => `${y.startJalali} — ${y.endJalali}` },
    { key: "status", header: "وضعیت", render: (y) => (y.isClosed ? `بسته${y.closedBy ? ` (${y.closedBy})` : ""}` : "باز") },
    {
      key: "select",
      header: "",
      render: (y) => (
        <button type="button" className={selected?.id === y.id ? "btn-primary" : "btn-ghost"} onClick={() => setSelected(y)}>
          {selected?.id === y.id ? "انتخاب‌شده" : "انتخاب"}
        </button>
      ),
    },
  ];

  const periodColumns: GridColumn<Period>[] = [
    { key: "n", header: "#", ltr: true, render: (p) => p.periodNumber },
    { key: "name", header: "دوره", render: (p) => p.name },
    { key: "range", header: "بازه", ltr: true, render: (p) => `${p.startJalali} — ${p.endJalali}` },
    { key: "status", header: "وضعیت", render: (p) => <StatusChip status={p.status} /> },
    {
      key: "actions",
      header: "عملیات",
      render: (p) =>
        selected?.isClosed ? (
          <span className="muted">سال بسته است</span>
        ) : (
          <div className="page-actions">
            {p.status === "Open" ? (
              <button type="button" className="btn-ghost" onClick={() => void periodAction(p, "soft-close")}>
                نیمه‌بسته
              </button>
            ) : null}
            {p.status !== "Closed" ? (
              <button type="button" className="btn-secondary" onClick={() => void periodAction(p, "close")}>
                بستن
              </button>
            ) : null}
            {p.status !== "Open" ? (
              <button type="button" className="btn-ghost" onClick={() => void periodAction(p, "reopen")}>
                بازگشایی
              </button>
            ) : null}
          </div>
        ),
    },
  ];

  const tempColumns: GridColumn<Preview["temporaryAccounts"][number]>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.accountCode },
    { key: "name", header: "حساب", render: (r) => r.accountName },
    { key: "type", header: "نوع", render: (r) => accountTypeFa(r.accountType) },
    { key: "bal", header: "مانده", align: "end", render: (r) => `${formatMoneyIrr(Math.abs(r.balance))} ${r.balance >= 0 ? "بد" : "بس"}` },
  ];

  return (
    <AppShell title="سال و دوره‌های مالی">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void loadYears()} /> : null}
        {!companyId ? <p className="panel">ابتدا شرکت را انتخاب کنید.</p> : null}

        <div className="panel">
          <DataGrid
            columns={yearColumns}
            rows={years}
            totalCount={yearTotal}
            page={yearPage}
            pageSize={10}
            onPageChange={setYearPage}
            rowKey={(y) => y.id}
            loading={loading}
            emptyTitle="سال مالی تعریف نشده — از صفحه راه‌اندازی بسازید"
          />
        </div>

        {selected ? (
          <>
            <section className="panel stack">
              <h2 className="section-title">
                پایان سال <span className="ltr">{selected.jalaliYear}</span>
              </h2>
              {preview ? (
                <>
                  <div className="summary-row">
                    <div>
                      <span className="muted">سود (زیان) خالص سال</span>
                      <strong>{formatMoneyIrr(preview.netIncome)}</strong>
                    </div>
                    <div>
                      <span className="muted">اسناد ثبت‌نشده</span>
                      <strong>{preview.unpostedJournals}</strong>
                    </div>
                    <div>
                      <span className="muted">حساب‌های دائمی با مانده</span>
                      <strong>{preview.permanentBalanceCount}</strong>
                    </div>
                  </div>
                  {preview.warnings.length > 0 ? (
                    <ul className="state-error">
                      {preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.temporaryAccounts.length > 0 ? (
                    <DataGrid
                      columns={tempColumns}
                      rows={preview.temporaryAccounts}
                      totalCount={preview.temporaryAccounts.length}
                      page={1}
                      pageSize={Math.max(preview.temporaryAccounts.length, 1)}
                      onPageChange={() => undefined}
                      rowKey={(r) => r.accountId}
                    />
                  ) : null}
                </>
              ) : null}

              <div className="form-grid">
                <label>
                  حساب سود و زیان انباشته
                  <select value={reAccount} onChange={(e) => setReAccount(e.target.value)} disabled={selected.isClosed}>
                    <option value="">— انتخاب —</option>
                    {equity.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  دلیل بازگشایی (برای بازگشایی دوره یا سال)
                  <textarea
                    className="field-control"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="دلیل بازگشایی را بنویسید"
                  />
                </label>
                <div className="page-actions" style={{ alignSelf: "end" }}>
                  {!selected.isClosed ? (
                    <ConfirmAction
                      title={`بستن سال مالی ${selected.jalaliYear}`}
                      reference={selected.id}
                      confirmLabel="بستن سال"
                      consequences={[
                        "سند بستن حساب‌های درآمد و هزینه به سود و زیان انباشته صادر و ثبت می‌شود.",
                        "سند اختتامیه حساب‌های دائمی در پایان سال و سند افتتاحیه در ابتدای سال بعد ثبت می‌شود.",
                        "سال بعد و دوره‌هایش در صورت نبود ساخته می‌شوند.",
                        "همه دوره‌های این سال بسته می‌شوند و ثبت سند جدید در آن ممکن نیست.",
                      ]}
                      onConfirm={closeYear}
                    >
                      {(open) => (
                        <button type="button" className="btn-danger" disabled={!preview?.canClose} onClick={open}>
                          بستن سال مالی
                        </button>
                      )}
                    </ConfirmAction>
                  ) : (
                    <ConfirmAction
                      title={`بازگشایی سال مالی ${selected.jalaliYear}`}
                      reference={selected.id}
                      confirmLabel="بازگشایی سال"
                      consequences={[
                        "اسناد بستن حساب‌های موقت، اختتامیه و افتتاحیه با سند برگشتی خنثی می‌شوند (سند ثبت‌شده حذف نمی‌شود).",
                        "همه دوره‌های سال باز می‌شوند.",
                        `دلیل ثبت‌شده در ممیزی: ${reason || "—"}`,
                      ]}
                      onConfirm={reopenYear}
                    >
                      {(open) => (
                        <button type="button" className="btn-secondary" onClick={open}>
                          بازگشایی سال مالی
                        </button>
                      )}
                    </ConfirmAction>
                  )}
                </div>
              </div>
            </section>

            <div className="panel">
              <DataGrid
                columns={periodColumns}
                rows={periods}
                totalCount={periods.length}
                page={1}
                pageSize={Math.max(periods.length, 1)}
                onPageChange={() => undefined}
                rowKey={(p) => p.id}
                emptyTitle="دوره‌ای برای این سال تعریف نشده"
              />
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
