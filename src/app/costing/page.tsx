"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { SendToAssistant } from "@/components/ai/SendToAssistant";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { statusFa } from "@/lib/labels";
import { StatusChip } from "@/components/ui/StatusChip";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";

type Named = { id: string; code: string; name: string };
type CostCenterRow = Named & { isActive: boolean };
type RunRow = {
  id: string;
  code: string;
  status: string;
  sourceAmount: number;
  allocatedTotal: number;
  reconciles: boolean;
};

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

export default function CostingPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [centers, setCenters] = useState<CostCenterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [editingCcId, setEditingCcId] = useState<string | null>(null);
  const [ccCode, setCcCode] = useState("CC01");
  const [ccName, setCcName] = useState("مرکز هزینه تولید");
  const [ccActive, setCcActive] = useState(true);
  const [poolCode, setPoolCode] = useState("POOL01");
  const [poolName, setPoolName] = useState("استخر سربار");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [clearingAccountId, setClearingAccountId] = useState("");
  const [driverCode, setDriverCode] = useState("DRV01");
  const [driverName, setDriverName] = useState("ساعت کار");
  const [ruleCode, setRuleCode] = useState("RULE01");
  const [runCode, setRunCode] = useState("RUN01");
  const [sourceAmount, setSourceAmount] = useState("10000000");
  const [dateJalali, setDateJalali] = useState("1405/01/15");
  const [driverQty, setDriverQty] = useState("100");

  const [costCenterId, setCostCenterId] = useState("");
  const [costPoolId, setCostPoolId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [ruleId, setRuleId] = useState("");

  const loadCenters = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/cost-centers?page=1&pageSize=100");
    const next = (res.data?.items ?? []).map((r) => ({
      id: String(r.id ?? r.Id),
      code: String(r.code ?? r.Code ?? ""),
      name: String(r.name ?? r.Name ?? ""),
      isActive: (r.isActive ?? r.IsActive ?? true) !== false,
    }));
    setCenters(next);
    setCostCenterId((prev) => prev || next[0]?.id || "");
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
    const next = (res.data?.items ?? []).map(mapNamed);
    setAccounts(next);
    setSourceAccountId((prev) => prev || (next.find((a) => a.code.startsWith("52"))?.id ?? next[0]?.id ?? ""));
    setClearingAccountId((prev) => prev || (next.find((a) => a.code.startsWith("21"))?.id ?? next[0]?.id ?? ""));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/costing-runs?page=${page}&pageSize=20`);
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
          status: String(r.status ?? r.Status ?? ""),
          sourceAmount: Number(r.sourceAmount ?? r.SourceAmount ?? 0),
          allocatedTotal: Number(r.allocatedTotal ?? r.AllocatedTotal ?? 0),
          reconciles: Boolean(r.reconciles ?? r.Reconciles),
        })),
      );
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
    void loadAccounts();
    void loadCenters();
  }, [load, loadAccounts, loadCenters]);

  function resetCcForm() {
    setEditingCcId(null);
    setCcCode("CC01");
    setCcName("مرکز هزینه تولید");
    setCcActive(true);
  }

  async function saveCenter(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (editingCcId) {
      const res = await apiSend(`/api/v1/cost-centers/${editingCcId}`, "PUT", { name: ccName, isActive: ccActive });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("مرکز هزینه ویرایش شد.");
    } else {
      const res = await apiSend<Record<string, unknown>>("/api/v1/cost-centers", "POST", { code: ccCode, name: ccName });
      if (res.error || !res.data) {
        setError(res.error ?? "خطا");
        return;
      }
      setCostCenterId(String(res.data.id ?? res.data.Id));
      setOk("مرکز هزینه ایجاد شد.");
    }
    resetCcForm();
    await loadCenters();
  }

  async function createPool(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/cost-pools", "POST", {
      code: poolCode,
      name: poolName,
      sourceAccountId,
      clearingAccountId,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setCostPoolId(String(res.data.id ?? res.data.Id));
    setOk("استخر هزینه ایجاد شد.");
  }

  async function createDriver(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/allocation-drivers", "POST", {
      code: driverCode,
      name: driverName,
      unit: "ساعت",
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setDriverId(String(res.data.id ?? res.data.Id));
    setOk("محرک تخصیص ایجاد شد.");
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!costPoolId || !driverId || !costCenterId) {
      setError("ابتدا مرکز هزینه، استخر و محرک را بسازید.");
      return;
    }
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/allocation-rules", "POST", {
      code: ruleCode,
      name: "قاعده تخصیص",
      policyVersion: 1,
      effectiveFromJalali: dateJalali,
      costPoolId,
      driverId,
      residualPolicy: 0,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    const id = String(res.data.id ?? res.data.Id);
    const recv = await apiSend(`/api/v1/allocation-rules/${id}/receivers`, "POST", {
      costCenterId,
      targetAccountId: clearingAccountId,
    });
    if (recv.error) {
      setError(recv.error);
      return;
    }
    setRuleId(id);
    setOk("قاعده تخصیص و گیرنده ثبت شد.");
  }

  async function createAndCalculateRun(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.periodId || !ruleId || !costCenterId) {
      setError("دوره مالی و قاعده تخصیص لازم است.");
      return;
    }
    setOk(null);
    const create = await apiSend<Record<string, unknown>>("/api/v1/costing-runs", "POST", {
      code: runCode,
      fiscalPeriodId: workspace.periodId,
      allocationRuleId: ruleId,
      documentDateJalali: dateJalali,
      sourceAmount: Number(sourceAmount),
    });
    if (create.error || !create.data) {
      setError(create.error ?? "خطا");
      return;
    }
    const runId = String(create.data.id ?? create.data.Id);
    const calc = await apiSend(`/api/v1/costing-runs/${runId}/calculate`, "POST", {
      driverQuantities: [{ costCenterId, quantity: Number(driverQty) }],
    });
    if (calc.error) {
      setError(calc.error);
      return;
    }
    setOk("اجرای بهایابی ساخته و محاسبه شد. می‌توانید ثبت کنید.");
    await load();
  }

  async function postRun(id: string) {
    setOk(null);
    const res = await apiSend(`/api/v1/costing-runs/${id}/post`, "POST", undefined, crypto.randomUUID());
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("اجرای بهایابی ثبت شد.");
    await load();
  }

  const columns: GridColumn<RunRow>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "status", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    { key: "src", header: "منبع", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.sourceAmount) },
    { key: "alloc", header: "تخصیص", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.allocatedTotal) },
    { key: "ok", header: "آشتی", render: (r) => (r.reconciles ? "بله" : "خیر") },
    {
      key: "act",
      header: "عملیات",
      render: (r) =>
        r.status !== "Posted" && r.status !== "Closed" ? (
          <button type="button" className="btn-primary" onClick={() => void postRun(r.id)}>
            ثبت
          </button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <AppShell title="بهایابی" actions={<SendToAssistant title="بهایابی" prompt="اجرای بهایابی و انحراف‌ها را تحلیل کن" data={rows.slice(0, 30)} />}>
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>۱) مراکز و قواعد</h2>
          <form className="form-grid" onSubmit={saveCenter}>
            <label>
              کد مرکز
              <input className="ltr" value={ccCode} onChange={(e) => setCcCode(e.target.value)} disabled={!!editingCcId} />
            </label>
            <label>
              نام مرکز
              <input value={ccName} onChange={(e) => setCcName(e.target.value)} />
            </label>
            {editingCcId ? (
              <label>
                <span>
                  <input type="checkbox" checked={ccActive} onChange={(e) => setCcActive(e.target.checked)} /> فعال
                </span>
              </label>
            ) : null}
            <div className="page-actions" style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                {editingCcId ? "ذخیره مرکز" : "ایجاد مرکز هزینه"}
              </button>
              {editingCcId ? (
                <button type="button" className="btn-ghost" onClick={resetCcForm}>
                  انصراف
                </button>
              ) : null}
            </div>
          </form>
          <DataGrid
            columns={[
              { key: "code", header: "کد", ltr: true, render: (r: CostCenterRow) => r.code },
              { key: "name", header: "نام", render: (r: CostCenterRow) => r.name },
              { key: "st", header: "وضعیت", render: (r: CostCenterRow) => (r.isActive ? "فعال" : "غیرفعال") },
              {
                key: "act",
                header: "اقدام",
                render: (r: CostCenterRow) => (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setEditingCcId(r.id);
                        setCcCode(r.code);
                        setCcName(r.name);
                        setCcActive(r.isActive);
                      }}
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        void (async () => {
                          const res = await apiSend(`/api/v1/cost-centers/${r.id}`, "PUT", { name: r.name, isActive: !r.isActive });
                          if (res.error) setError(res.error);
                          else {
                            setOk(r.isActive ? "مرکز هزینه غیرفعال شد." : "مرکز هزینه فعال شد.");
                            await loadCenters();
                          }
                        })();
                      }}
                    >
                      {r.isActive ? "غیرفعال" : "فعال"}
                    </button>
                    <ConfirmAction
                      title="حذف مرکز هزینه"
                      consequences={[`مرکز ${r.code} حذف می‌شود.`, "اگر در تخصیص استفاده شده باشد حذف مجاز نیست."]}
                      reference={r.code}
                      confirmLabel="حذف"
                      onConfirm={async () => {
                        const res = await apiSend(`/api/v1/cost-centers/${r.id}`, "DELETE");
                        if (res.error) throw new Error(res.error);
                        setOk("مرکز هزینه حذف شد.");
                        if (editingCcId === r.id) resetCcForm();
                        await loadCenters();
                      }}
                    >
                      {(open) => (
                        <button type="button" className="btn-danger btn-sm" onClick={open}>
                          حذف
                        </button>
                      )}
                    </ConfirmAction>
                  </div>
                ),
              },
            ]}
            rows={centers}
            totalCount={centers.length}
            page={1}
            pageSize={100}
            onPageChange={() => undefined}
            rowKey={(r) => r.id}
            emptyTitle="مرکز هزینه‌ای ثبت نشده"
          />
          <form className="form-grid" onSubmit={createPool}>
            <label>
              کد استخر
              <input className="ltr" value={poolCode} onChange={(e) => setPoolCode(e.target.value)} />
            </label>
            <label>
              نام
              <input value={poolName} onChange={(e) => setPoolName(e.target.value)} />
            </label>
            <label>
              حساب منبع
              <select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب طرف
              <select value={clearingAccountId} onChange={(e) => setClearingAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد استخر
              </button>
            </div>
          </form>
          <form className="form-grid" onSubmit={createDriver}>
            <label>
              کد محرک
              <input className="ltr" value={driverCode} onChange={(e) => setDriverCode(e.target.value)} />
            </label>
            <label>
              نام محرک
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد محرک
              </button>
            </div>
          </form>
          <form className="form-grid" onSubmit={createRule}>
            <label>
              کد قاعده
              <input className="ltr" value={ruleCode} onChange={(e) => setRuleCode(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد قاعده + گیرنده
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>۲) اجرای بهایابی</h2>
          <form className="form-grid" onSubmit={createAndCalculateRun}>
            <label>
              کد اجرا
              <input className="ltr" value={runCode} onChange={(e) => setRunCode(e.target.value)} />
            </label>
            <label>
              تاریخ
              <JalaliDatePicker value={dateJalali} onChange={setDateJalali} />
            </label>
            <label>
              مبلغ منبع
              <input className="ltr" value={sourceAmount} onChange={(e) => setSourceAmount(e.target.value)} />
            </label>
            <label>
              مقدار محرک
              <input className="ltr" value={driverQty} onChange={(e) => setDriverQty(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ایجاد و محاسبه
              </button>
            </div>
          </form>
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
            emptyTitle="اجرای بهایابی ثبت نشده"
            savedViewKey="costing-runs"
          />
        </div>
      </div>
    </AppShell>
  );
}
