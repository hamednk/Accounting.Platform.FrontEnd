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
import { formatMoneyIrr, formatQuantity } from "@/lib/format";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { useCan } from "@/components/auth/AuthGate";

type CloseRow = {
  id: string;
  code: string;
  status: string;
  totalWip: number;
  totalFinished: number;
  totalVariance: number;
  journalId: string | null;
};

function mapClose(r: Record<string, unknown>): CloseRow {
  return {
    id: String(r.id ?? r.Id),
    code: String(r.code ?? r.Code ?? ""),
    status: String(r.status ?? r.Status ?? ""),
    totalWip: Number(r.totalWip ?? r.TotalWip ?? 0),
    totalFinished: Number(r.totalFinished ?? r.TotalFinished ?? 0),
    totalVariance: Number(r.totalVariance ?? r.TotalVariance ?? 0),
    journalId: (r.journalId ?? r.JournalId ?? null) as string | null,
  };
}

type Named = { id: string; code: string; name: string };
type PoRow = {
  id: string;
  number: string;
  status: string;
  plannedQuantity: number;
  completedQuantity: number;
  wipBalance: number;
  finishedGoodsCost: number;
};

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

export default function ManufacturingPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Named[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [wcCode, setWcCode] = useState("WC01");
  const [wcName, setWcName] = useState("کارگاه مونتاژ");
  const [fgItemId, setFgItemId] = useState("");
  const [compItemId, setCompItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [wipAccountId, setWipAccountId] = useState("");
  const [fgAccountId, setFgAccountId] = useState("");
  const [poNumber, setPoNumber] = useState("PO-1405-001");
  const [plannedQty, setPlannedQty] = useState("10");
  const [dateJalali, setDateJalali] = useState("1405/01/15");

  const [workCenterId, setWorkCenterId] = useState("");
  const [bomId, setBomId] = useState("");
  const [routingId, setRoutingId] = useState("");

  const can = useCan();
  const [closes, setCloses] = useState<CloseRow[]>([]);
  const [closesTotal, setClosesTotal] = useState(0);
  const [closesPage, setClosesPage] = useState(1);
  const [closesLoading, setClosesLoading] = useState(true);
  const [closeCode, setCloseCode] = useState("MC-1405-01");
  const [varianceAccountId, setVarianceAccountId] = useState("");
  const [closeDateJalali, setCloseDateJalali] = useState("1405/01/31");

  const loadCloses = useCallback(async () => {
    setClosesLoading(true);
    const qs = new URLSearchParams({ page: String(closesPage), pageSize: "10" });
    if (workspace.periodId) qs.set("fiscalPeriodId", workspace.periodId);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/manufacturing-closes?${qs}`);
    if (!res.error) {
      setCloses((res.data?.items ?? []).map(mapClose));
      setClosesTotal(res.data?.totalCount ?? 0);
    }
    setClosesLoading(false);
  }, [closesPage, workspace.periodId]);

  useEffect(() => {
    void loadCloses();
  }, [loadCloses]);

  async function startClose(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (!workspace.periodId) {
      setError("دوره مالی را از نوار بالا انتخاب کنید.");
      return;
    }
    const res = await apiSend("/api/v1/manufacturing-closes", "POST", { code: closeCode, fiscalPeriodId: workspace.periodId });
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setOk(`بستن دوره ${closeCode} شروع شد؛ مانده WIP سفارش‌های فعال قفل شد.`);
    await loadCloses();
  }

  async function completeClose(row: CloseRow) {
    if (!varianceAccountId) throw new Error("حساب انحراف تولید را انتخاب کنید.");
    const res = await apiSend<Record<string, unknown>>(
      `/api/v1/manufacturing-closes/${row.id}/complete`,
      "POST",
      { varianceAccountId, documentDateJalali: closeDateJalali },
      `mfg-close-${row.id}`,
    );
    if (res.error) throw new Error(res.error);
    const variance = Number(res.data?.totalVariance ?? res.data?.TotalVariance ?? 0);
    setError(null);
    setOk(`بستن دوره ${row.code} تکمیل شد؛ انحراف ${formatMoneyIrr(variance)}.`);
    await Promise.all([loadCloses(), load()]);
  }

  const loadLookups = useCallback(async () => {
    const [iRes, wRes, aRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>("/api/v1/items?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/warehouses?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true"),
    ]);
    const nextI = (iRes.data?.items ?? []).map(mapNamed);
    const nextW = (wRes.data?.items ?? []).map(mapNamed);
    const nextA = (aRes.data?.items ?? []).map(mapNamed);
    setItems(nextI);
    setWarehouses(nextW);
    setAccounts(nextA);
    const inventoryAcc = nextA.find((a) => a.code.startsWith("14"))?.id ?? nextA[0]?.id ?? "";
    setFgItemId((prev) => prev || nextI[0]?.id || "");
    setCompItemId((prev) => prev || nextI[1]?.id || nextI[0]?.id || "");
    setWarehouseId((prev) => prev || nextW[0]?.id || "");
    setWipAccountId((prev) => prev || inventoryAcc);
    setFgAccountId((prev) => prev || inventoryAcc);
    setVarianceAccountId((prev) => prev || nextA.find((a) => a.code.startsWith("5") || a.code.startsWith("6"))?.id || "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/production-orders?page=${page}&pageSize=20`);
    if (res.error) {
      setError(res.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows(
        (res.data?.items ?? []).map((r) => ({
          id: String(r.id ?? r.Id),
          number: String(r.number ?? r.Number ?? ""),
          status: String(r.status ?? r.Status ?? ""),
          plannedQuantity: Number(r.plannedQuantity ?? r.PlannedQuantity ?? 0),
          completedQuantity: Number(r.completedQuantity ?? r.CompletedQuantity ?? 0),
          wipBalance: Number(r.wipBalance ?? r.WipBalance ?? 0),
          finishedGoodsCost: Number(r.finishedGoodsCost ?? r.FinishedGoodsCost ?? 0),
        })),
      );
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
    void loadLookups();
  }, [load, loadLookups]);

  async function setupMasters(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);

    const wc = await apiSend<Record<string, unknown>>("/api/v1/work-centers", "POST", {
      code: wcCode,
      name: wcName,
      laborRatePerHour: 500000,
      machineRatePerHour: 300000,
    });
    if (wc.error || !wc.data) {
      setError(wc.error ?? "خطای مرکز کار");
      return;
    }
    const wcId = String(wc.data.id ?? wc.data.Id);
    setWorkCenterId(wcId);

    const bom = await apiSend<Record<string, unknown>>("/api/v1/boms", "POST", {
      code: `BOM-${Date.now().toString().slice(-4)}`,
      finishedItemId: fgItemId,
      version: 1,
      effectiveFromJalali: dateJalali,
      outputQuantity: 1,
    });
    if (bom.error || !bom.data) {
      setError(bom.error ?? "خطای BOM");
      return;
    }
    const bId = String(bom.data.id ?? bom.data.Id);
    await apiSend(`/api/v1/boms/${bId}/components`, "POST", {
      componentItemId: compItemId,
      quantityPerOutput: 1,
      isByProduct: false,
    });
    await apiSend(`/api/v1/boms/${bId}/approve`, "POST");
    setBomId(bId);

    const routing = await apiSend<Record<string, unknown>>("/api/v1/routings", "POST", {
      code: `RT-${Date.now().toString().slice(-4)}`,
      finishedItemId: fgItemId,
      version: 1,
      effectiveFromJalali: dateJalali,
    });
    if (routing.error || !routing.data) {
      setError(routing.error ?? "خطای مسیر ساخت");
      return;
    }
    const rId = String(routing.data.id ?? routing.data.Id);
    await apiSend(`/api/v1/routings/${rId}/operations`, "POST", {
      sequence: 10,
      workCenterId: wcId,
      setupHours: 0.5,
      runHoursPerUnit: 0.2,
    });
    await apiSend(`/api/v1/routings/${rId}/approve`, "POST");
    setRoutingId(rId);
    setOk("مرکز کار، فهرست مواد و مسیر ساخت آماده شد.");
  }

  async function createPo(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.periodId || !bomId || !routingId) {
      setError("ابتدا ساختار تولید را بسازید و دوره مالی را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend("/api/v1/production-orders", "POST", {
      number: poNumber,
      finishedItemId: fgItemId,
      plannedQuantity: Number(plannedQty),
      warehouseId,
      fiscalPeriodId: workspace.periodId,
      bomId,
      routingId,
      costingMode: 1,
      wipAccountId,
      fgAccountId,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش تولید ایجاد شد.");
    await load();
  }

  async function release(id: string) {
    setOk(null);
    const res = await apiSend(`/api/v1/production-orders/${id}/release`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش آزاد شد.");
    await load();
  }

  async function close(id: string) {
    setOk(null);
    const res = await apiSend(`/api/v1/production-orders/${id}/close`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش بسته شد.");
    await load();
  }

  const columns: GridColumn<PoRow>[] = [
    { key: "num", header: "شماره", ltr: true, render: (r) => r.number },
    { key: "st", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    { key: "plan", header: "برنامه", align: "end", ltr: true, render: (r) => formatQuantity(r.plannedQuantity) },
    { key: "done", header: "تکمیل", align: "end", ltr: true, render: (r) => formatQuantity(r.completedQuantity) },
    { key: "wip", header: "کالای در جریان ساخت", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.wipBalance) },
    { key: "fg", header: "کالای ساخته", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.finishedGoodsCost) },
    {
      key: "act",
      header: "عملیات",
      render: (r) => (
        <div className="page-actions">
          {r.status === "Draft" || r.status === "Planned" ? (
            <button type="button" className="btn-ghost" onClick={() => void release(r.id)}>
              آزادسازی
            </button>
          ) : null}
          {r.status !== "Closed" ? (
            <button type="button" className="btn-danger" onClick={() => void close(r.id)}>
              بستن
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AppShell title="تولید">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>۱) ساختار تولید (مرکز کار / فهرست مواد / مسیر ساخت)</h2>
          <form className="form-grid" onSubmit={setupMasters}>
            <label>
              کد مرکز کار
              <input className="ltr" value={wcCode} onChange={(e) => setWcCode(e.target.value)} />
            </label>
            <label>
              نام مرکز کار
              <input value={wcName} onChange={(e) => setWcName(e.target.value)} />
            </label>
            <label>
              کالای ساخته
              <select value={fgItemId} onChange={(e) => setFgItemId(e.target.value)}>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              کالای مصرفی
              <select value={compItemId} onChange={(e) => setCompItemId(e.target.value)}>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تاریخ مؤثر
              <JalaliDatePicker value={dateJalali} onChange={setDateJalali} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                آماده‌سازی ساختار
              </button>
            </div>
          </form>
          {bomId ? (
            <p className="muted">
              BOM و مسیر آماده است · مرکز کار: <span className="ltr">{workCenterId.slice(0, 8)}</span>
            </p>
          ) : null}
        </section>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>۲) سفارش تولید</h2>
          <form className="form-grid" onSubmit={createPo}>
            <label>
              شماره
              <input className="ltr" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </label>
            <label>
              مقدار برنامه‌ای
              <input className="ltr" value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} />
            </label>
            <label>
              انبار
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب WIP
              <select value={wipAccountId} onChange={(e) => setWipAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب کالای ساخته
              <select value={fgAccountId} onChange={(e) => setFgAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ایجاد سفارش
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
            emptyTitle="سفارش تولیدی ثبت نشده"
            savedViewKey="production-orders"
          />
        </div>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>۳) بستن دوره تولید و انحرافات</h2>
          <p className="muted">
            شروع بستن، مانده کالای در جریان ساخت سفارش‌های دوره جاری را قفل می‌کند. تکمیل، مانده باقی‌ماندهٔ سفارش‌های تکمیل‌شده را
            به حساب انحراف منتقل و سند آن را ثبت می‌کند.
          </p>
          {can("MFG.MANAGE") ? (
            <form className="form-grid" onSubmit={startClose}>
              <label>
                کد بستن
                <input className="ltr" value={closeCode} onChange={(e) => setCloseCode(e.target.value)} required />
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-secondary">
                  شروع بستن دوره
                </button>
              </div>
            </form>
          ) : null}
          {can("MFG.POST") ? (
            <div className="form-grid">
              <label>
                حساب انحراف تولید
                <select value={varianceAccountId} onChange={(e) => setVarianceAccountId(e.target.value)}>
                  <option value="">انتخاب…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                تاریخ سند انحراف
                <JalaliDatePicker value={closeDateJalali} onChange={setCloseDateJalali} />
              </label>
            </div>
          ) : null}
          <DataGrid
            columns={[
              { key: "code", header: "کد", ltr: true, render: (r: CloseRow) => r.code },
              { key: "st", header: "وضعیت", render: (r: CloseRow) => <StatusChip status={r.status} /> },
              { key: "wip", header: "WIP قفل‌شده", align: "end", ltr: true, render: (r: CloseRow) => formatMoneyIrr(r.totalWip) },
              { key: "fg", header: "کالای ساخته", align: "end", ltr: true, render: (r: CloseRow) => formatMoneyIrr(r.totalFinished) },
              { key: "var", header: "انحراف", align: "end", ltr: true, render: (r: CloseRow) => formatMoneyIrr(r.totalVariance) },
              {
                key: "doc",
                header: "سند",
                render: (r: CloseRow) =>
                  r.journalId ? (
                    <a className="btn-ghost" href={`/print/journal/${r.journalId}`} target="_blank" rel="noreferrer">
                      چاپ سند
                    </a>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "act",
                header: "عملیات",
                render: (r: CloseRow) =>
                  r.status === "Frozen" && can("MFG.POST") ? (
                    <ConfirmAction
                      title="تکمیل بستن دوره تولید"
                      reference={r.code}
                      consequences={[
                        "انحراف مانده WIP سفارش‌های تکمیل‌شده به حساب انحراف ثبت نهایی می‌شود.",
                        `تاریخ سند: ${closeDateJalali}`,
                        "اصلاح بعدی فقط با برگشت سند امکان‌پذیر است.",
                      ]}
                      confirmLabel="تکمیل و ثبت"
                      onConfirm={() => completeClose(r)}
                    >
                      {(open) => (
                        <button type="button" className="btn-danger" onClick={open}>
                          تکمیل بستن
                        </button>
                      )}
                    </ConfirmAction>
                  ) : null,
              },
            ]}
            rows={closes}
            totalCount={closesTotal}
            page={closesPage}
            pageSize={10}
            onPageChange={setClosesPage}
            rowKey={(r) => r.id}
            loading={closesLoading}
            emptyTitle="بستن دوره‌ای برای این دوره مالی ثبت نشده"
          />
        </section>
      </div>
    </AppShell>
  );
}
