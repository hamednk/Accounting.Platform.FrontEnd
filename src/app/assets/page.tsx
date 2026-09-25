"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { statusFa } from "@/lib/labels";
import { StatusChip } from "@/components/ui/StatusChip";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";

type Named = { id: string; code: string; name: string };
type Asset = {
  id: string;
  code: string;
  name: string;
  status: string;
  acquisitionCost: number;
  bookValue: number;
};

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

export default function AssetsPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [classes, setClasses] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [classCode, setClassCode] = useState("AC01");
  const [className, setClassName] = useState("تجهیزات اداری");
  const [lifeMonths, setLifeMonths] = useState("60");
  const [assetAccountId, setAssetAccountId] = useState("");
  const [accumAccountId, setAccumAccountId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [lastClassId, setLastClassId] = useState("");

  const [assetCode, setAssetCode] = useState("FA01");
  const [assetName, setAssetName] = useState("لپ‌تاپ");
  const [acqDate, setAcqDate] = useState("1405/01/01");
  const [acqCost, setAcqCost] = useState("45000000");
  const [clearingAccountId, setClearingAccountId] = useState("");
  const [runDate, setRunDate] = useState("1405/01/29");

  const loadAccounts = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
    const next = (res.data?.items ?? []).map(mapNamed);
    setAccounts(next);
    const pick = (prefix: string) => next.find((a) => a.code.startsWith(prefix))?.id ?? next[0]?.id ?? "";
    setAssetAccountId((prev) => prev || pick("15"));
    setAccumAccountId((prev) => prev || pick("15"));
    setExpenseAccountId((prev) => prev || pick("52"));
    setClearingAccountId((prev) => prev || pick("11"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/fixed-assets?page=${page}&pageSize=20`);
    if (res.error) {
      setError(res.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows(
        (res.data?.items ?? []).map((r) => ({
          id: String(r.id ?? r.Id),
          code: String(r.code ?? r.Code ?? ""),
          name: String(r.name ?? r.Name ?? ""),
          status: String(r.status ?? r.Status ?? ""),
          acquisitionCost: Number(r.acquisitionCost ?? r.AcquisitionCost ?? 0),
          bookValue: Number(r.bookValue ?? r.BookValue ?? 0),
        })),
      );
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
    void loadAccounts();
  }, [load, loadAccounts]);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/asset-classes", "POST", {
      code: classCode,
      name: className,
      method: 0,
      usefulLifeMonths: Number(lifeMonths),
      salvagePercent: 0,
      assetAccountId,
      accumDepAccountId: accumAccountId,
      expenseAccountId,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    const id = String(res.data.id ?? res.data.Id);
    setLastClassId(id);
    setClasses((prev) => [...prev, { id, code: classCode, name: className }]);
    setOk("طبقه دارایی ایجاد شد.");
  }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!lastClassId) {
      setError("ابتدا طبقه دارایی بسازید.");
      return;
    }
    setOk(null);
    const res = await apiSend("/api/v1/fixed-assets", "POST", {
      assetClassId: lastClassId,
      code: assetCode,
      name: assetName,
      acquisitionDateJalali: acqDate,
      acquisitionCost: Number(acqCost),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("دارایی ایجاد شد.");
    await load();
  }

  async function capitalize(id: string) {
    if (!workspace.periodId) {
      setError("دوره مالی را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      `/api/v1/fixed-assets/${id}/capitalize`,
      "POST",
      { fiscalPeriodId: workspace.periodId, clearingAccountId },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سرمایه‌گذاری (ثبت) انجام شد.");
    await load();
  }

  async function runDepreciation() {
    if (!workspace.periodId) {
      setError("دوره مالی را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      "/api/v1/fixed-assets/depreciation-runs",
      "POST",
      { fiscalPeriodId: workspace.periodId, runDateJalali: runDate },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("استهلاک دوره اجرا شد.");
    await load();
  }

  const columns: GridColumn<Asset>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => r.name },
    { key: "status", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    { key: "cost", header: "بهای تمام‌شده", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.acquisitionCost) },
    { key: "bv", header: "ارزش دفتری", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.bookValue) },
    {
      key: "act",
      header: "عملیات",
      render: (r) =>
        r.status === "Draft" ? (
          <button type="button" className="btn-primary" onClick={() => void capitalize(r.id)}>
            ثبت سرمایه
          </button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <AppShell title="دارایی ثابت">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>طبقه دارایی</h2>
          <form className="form-grid" onSubmit={createClass}>
            <label>
              کد
              <input className="ltr" value={classCode} onChange={(e) => setClassCode(e.target.value)} required />
            </label>
            <label>
              نام
              <input value={className} onChange={(e) => setClassName(e.target.value)} required />
            </label>
            <label>
              عمر مفید (ماه)
              <input className="ltr" value={lifeMonths} onChange={(e) => setLifeMonths(e.target.value)} required />
            </label>
            <label>
              حساب دارایی
              <select value={assetAccountId} onChange={(e) => setAssetAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب استهلاک انباشته
              <select value={accumAccountId} onChange={(e) => setAccumAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              هزینه استهلاک
              <select value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد طبقه
              </button>
            </div>
          </form>
          {lastClassId ? <p className="muted">طبقه فعال برای دارایی جدید انتخاب شد ({classes.at(-1)?.name}).</p> : null}
        </section>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>دارایی جدید</h2>
          <form className="form-grid" onSubmit={createAsset}>
            <label>
              کد
              <input className="ltr" value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required />
            </label>
            <label>
              نام
              <input value={assetName} onChange={(e) => setAssetName(e.target.value)} required />
            </label>
            <label>
              تاریخ تحصیل
              <JalaliDatePicker value={acqDate} onChange={setAcqDate} required />
            </label>
            <label>
              بهای تحصیل
              <input className="ltr" value={acqCost} onChange={(e) => setAcqCost(e.target.value)} required />
            </label>
            <label>
              طرف حساب ثبت سرمایه
              <select value={clearingAccountId} onChange={(e) => setClearingAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ایجاد دارایی
              </button>
            </div>
          </form>
          <div className="page-actions">
            <label>
              تاریخ اجرای استهلاک
              <JalaliDatePicker value={runDate} onChange={setRunDate} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => void runDepreciation()}>
              اجرای استهلاک دوره
            </button>
          </div>
        </section>

        <div className="panel">
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="دارایی ثبت نشده"
            savedViewKey="fixed-assets"
          />
        </div>
      </div>
    </AppShell>
  );
}
