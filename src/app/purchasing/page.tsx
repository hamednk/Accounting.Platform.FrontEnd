"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { SendToAssistant } from "@/components/ai/SendToAssistant";
import { statusFa } from "@/lib/labels";
import { StatusChip } from "@/components/ui/StatusChip";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { PartyManager } from "@/components/parties/PartyManager";
import { apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";

type Named = { id: string; code: string; name: string };
type Order = {
  id: string;
  documentNumber: string;
  vendorLabel: string;
  status: string;
  totalAmount: number;
  orderDateJalali: string;
};
type LineDraft = { itemId: string; quantity: string; unitCost: string };

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

export default function PurchasingPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [vendors, setVendors] = useState<Named[]>([]);
  const [items, setItems] = useState<Named[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: "", quantity: "1", unitCost: "0" }]);
  const [warehouseId, setWarehouseId] = useState("");
  const [clearingAccountId, setClearingAccountId] = useState("");
  const [orderDate, setOrderDate] = useState("1405/01/15");
  const [desc, setDesc] = useState("سفارش خرید");

  const loadLookups = useCallback(async () => {
    const [vRes, iRes, wRes, aRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>("/api/v1/vendors?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/items?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/warehouses?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true"),
    ]);
    const nextV = (vRes.data?.items ?? []).map(mapNamed);
    const nextI = (iRes.data?.items ?? []).map(mapNamed);
    const nextW = (wRes.data?.items ?? []).map(mapNamed);
    const nextA = (aRes.data?.items ?? []).map(mapNamed);
    setVendors(nextV);
    setItems(nextI);
    setWarehouses(nextW);
    setAccounts(nextA);
    setVendorId((prev) => prev || nextV[0]?.id || "");
    setWarehouseId((prev) => prev || nextW[0]?.id || "");
    setClearingAccountId((prev) => prev || (nextA.find((a) => a.code.startsWith("21"))?.id ?? nextA[0]?.id ?? ""));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [oRes, vRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>(`/api/v1/purchase-orders?page=${page}&pageSize=20`),
      apiGetPaged<Record<string, unknown>>("/api/v1/vendors?page=1&pageSize=200"),
    ]);
    if (oRes.error) {
      setError(oRes.error);
      setRows([]);
      setTotal(0);
    } else {
      const vMap = new Map((vRes.data?.items ?? []).map(mapNamed).map((v) => [v.id, v]));
      setError(null);
      setRows(
        (oRes.data?.items ?? []).map((r) => {
          const vid = String(r.vendorId ?? r.VendorId ?? "");
          const v = vMap.get(vid);
          return {
            id: String(r.id ?? r.Id),
            documentNumber: String(r.documentNumber ?? r.DocumentNumber ?? ""),
            vendorLabel: v ? `${v.code} — ${v.name}` : vid.slice(0, 8),
            status: String(r.status ?? r.Status ?? ""),
            totalAmount: Number(r.totalAmount ?? r.TotalAmount ?? 0),
            orderDateJalali: String(r.orderDateJalali ?? r.OrderDateJalali ?? ""),
          };
        }),
      );
      setTotal(oRes.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
    void loadLookups();
  }, [load, loadLookups]);

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const orderTotal = lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * (Number(l.unitCost) || 0)), 0);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const valid = lines.filter((l) => l.itemId && Number(l.quantity) > 0);
    if (valid.length === 0) {
      setError("حداقل یک ردیف کالا با مقدار مثبت لازم است.");
      return;
    }
    const res = await apiSend("/api/v1/purchase-orders", "POST", {
      vendorId,
      orderDateJalali: orderDate,
      description: desc,
      lines: valid.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش خرید ایجاد شد.");
    setLines([{ itemId: "", quantity: "1", unitCost: "0" }]);
    await load();
  }

  async function confirmOrder(id: string) {
    setOk(null);
    const res = await apiSend(`/api/v1/purchase-orders/${id}/confirm`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش تأیید شد.");
    await load();
  }

  async function receiveOrder(id: string) {
    if (!workspace.periodId) {
      setError("دوره مالی را انتخاب کنید.");
      return;
    }
    if (!warehouseId || !clearingAccountId) {
      setError("انبار و طرف حساب را مشخص کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      `/api/v1/purchase-orders/${id}/receive`,
      "POST",
      {
        warehouseId,
        fiscalPeriodId: workspace.periodId,
        receiptDateJalali: orderDate,
        clearingAccountId,
      },
      `receive-${id}`,
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("رسید خرید ثبت شد.");
    await load();
  }

  const columns: GridColumn<Order>[] = [
    { key: "num", header: "شماره", ltr: true, render: (r) => r.documentNumber },
    { key: "date", header: "تاریخ", ltr: true, render: (r) => r.orderDateJalali },
    { key: "vendor", header: "تأمین‌کننده", render: (r) => r.vendorLabel },
    { key: "status", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    { key: "amt", header: "مبلغ", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.totalAmount) },
    {
      key: "act",
      header: "عملیات",
      render: (r) => (
        <div className="page-actions">
          {r.status === "Draft" ? (
            <button type="button" className="btn-ghost" onClick={() => void confirmOrder(r.id)}>
              تأیید
            </button>
          ) : null}
          {r.status !== "Received" && r.status !== "Cancelled" ? (
            <button type="button" className="btn-primary" onClick={() => void receiveOrder(r.id)}>
              رسید
            </button>
          ) : null}
          <Link className="btn-ghost" href={`/print/purchase-receipt/${r.id}`} target="_blank">
            چاپ
          </Link>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="خرید" actions={<SendToAssistant title="خرید" prompt="وضعیت سفارش‌های خرید را خلاصه کن" data={rows.slice(0, 40)} />}>
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <PartyManager kind="vendors" onError={setError} onOk={setOk} onChanged={() => void loadLookups()} />

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>سفارش خرید</h2>
          <form className="stack" onSubmit={createOrder}>
            <div className="form-grid">
              <label>
                تأمین‌کننده
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                  <option value="">انتخاب…</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                تاریخ
                <JalaliDatePicker value={orderDate} onChange={setOrderDate} required />
              </label>
              <label>
                شرح
                <textarea className="field-control" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </label>
            </div>
            <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>کالا</th>
                  <th>مقدار</th>
                  <th>بهای واحد (ریال)</th>
                  <th>مبلغ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <select value={l.itemId} onChange={(e) => updateLine(i, { itemId: e.target.value })} required>
                        <option value="">انتخاب…</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.code} — {it.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input className="ltr" inputMode="decimal" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                    </td>
                    <td>
                      <input className="ltr" inputMode="numeric" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} />
                    </td>
                    <td className="ltr">{formatMoneyIrr(Math.round((Number(l.quantity) || 0) * (Number(l.unitCost) || 0)))}</td>
                    <td>
                      {lines.length > 1 ? (
                        <button type="button" className="btn-ghost" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>
                          حذف
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>جمع سفارش</td>
                  <td className="ltr">{formatMoneyIrr(orderTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            </div>
            <div className="page-actions">
              <button type="button" className="btn-ghost" onClick={() => setLines((p) => [...p, { itemId: "", quantity: "1", unitCost: "0" }])}>
                افزودن ردیف
              </button>
              <button type="submit" className="btn-primary">
                ایجاد سفارش
              </button>
            </div>
          </form>
          <p className="muted">برای رسید انبار:</p>
          <div className="form-grid">
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
              طرف حساب
              <select value={clearingAccountId} onChange={(e) => setClearingAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
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
            emptyTitle="سفارش خریدی نیست"
            savedViewKey="purchase-orders"
          />
        </div>
      </div>
    </AppShell>
  );
}
