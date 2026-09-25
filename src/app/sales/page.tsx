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
  customerLabel: string;
  status: string;
  totalAmount: number;
  orderDateJalali: string;
};
type Invoice = {
  id: string;
  documentNumber: string;
  invoiceDateJalali: string;
  customerLabel: string;
  totalAmount: number;
  taxTotal: number;
};
type LineDraft = { itemId: string; quantity: string; unitPrice: string };

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

export default function SalesPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [invPage, setInvPage] = useState(1);
  const [invFilter, setInvFilter] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [customers, setCustomers] = useState<Named[]>([]);
  const [items, setItems] = useState<Named[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ itemId: "", quantity: "1", unitPrice: "0" }]);
  const [orderDate, setOrderDate] = useState("1405/01/15");
  const [desc, setDesc] = useState("سفارش فروش");
  const [arAccountId, setArAccountId] = useState("");
  const [revenueAccountId, setRevenueAccountId] = useState("");
  const [cogsAccountId, setCogsAccountId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const loadLookups = useCallback(async () => {
    const [cRes, iRes, wRes, aRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>("/api/v1/customers?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/items?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/warehouses?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true"),
    ]);
    const nextCust = (cRes.data?.items ?? []).map(mapNamed);
    const nextItems = (iRes.data?.items ?? []).map(mapNamed);
    const nextWh = (wRes.data?.items ?? []).map(mapNamed);
    const nextAcc = (aRes.data?.items ?? []).map(mapNamed);
    setCustomers(nextCust);
    setItems(nextItems);
    setWarehouses(nextWh);
    setAccounts(nextAcc);
    const pick = (prefix: string) => nextAcc.find((a) => a.code.startsWith(prefix))?.id ?? nextAcc[0]?.id ?? "";
    setCustomerId((prev) => prev || nextCust[0]?.id || "");
    setWarehouseId((prev) => prev || nextWh[0]?.id || "");
    setArAccountId((prev) => prev || pick("12"));
    setRevenueAccountId((prev) => prev || pick("41"));
    setCogsAccountId((prev) => prev || pick("51"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const invQs = new URLSearchParams({ page: String(invPage), pageSize: "10" });
    if (invFilter) invQs.set("documentNumber", invFilter);
    const [ordersRes, custRes, invRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>(`/api/v1/sales-orders?page=${page}&pageSize=20`),
      apiGetPaged<Record<string, unknown>>("/api/v1/customers?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>(`/api/v1/sales-invoices?${invQs.toString()}`),
    ]);
    const custMap = new Map((custRes.data?.items ?? []).map(mapNamed).map((c) => [c.id, c]));
    const custLabel = (id: string) => {
      const c = custMap.get(id);
      return c ? `${c.code} — ${c.name}` : id.slice(0, 8);
    };
    if (ordersRes.error) {
      setError(ordersRes.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows(
        (ordersRes.data?.items ?? []).map((r) => ({
          id: String(r.id ?? r.Id),
          documentNumber: String(r.documentNumber ?? r.DocumentNumber ?? ""),
          customerLabel: custLabel(String(r.customerId ?? r.CustomerId ?? "")),
          status: String(r.status ?? r.Status ?? ""),
          totalAmount: Number(r.totalAmount ?? r.TotalAmount ?? 0),
          orderDateJalali: String(r.orderDateJalali ?? r.OrderDateJalali ?? ""),
        })),
      );
      setTotal(ordersRes.data?.totalCount ?? 0);
    }
    setInvoices(
      (invRes.data?.items ?? []).map((r) => ({
        id: String(r.id ?? r.Id),
        documentNumber: String(r.documentNumber ?? r.DocumentNumber ?? ""),
        invoiceDateJalali: String(r.invoiceDateJalali ?? r.InvoiceDateJalali ?? ""),
        customerLabel: custLabel(String(r.customerId ?? r.CustomerId ?? "")),
        totalAmount: Number(r.totalAmount ?? r.TotalAmount ?? 0),
        taxTotal: Number(r.taxTotal ?? r.TaxTotal ?? 0),
      })),
    );
    setInvTotal(invRes.data?.totalCount ?? 0);
    setLoading(false);
  }, [page, invPage, invFilter]);

  useEffect(() => {
    void load();
    void loadLookups();
  }, [load, loadLookups]);

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const orderTotal = lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const valid = lines.filter((l) => l.itemId && Number(l.quantity) > 0);
    if (valid.length === 0) {
      setError("حداقل یک ردیف کالا با مقدار مثبت لازم است.");
      return;
    }
    const res = await apiSend("/api/v1/sales-orders", "POST", {
      customerId,
      orderDateJalali: orderDate,
      description: desc,
      lines: valid.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش فروش ایجاد شد.");
    setLines([{ itemId: "", quantity: "1", unitPrice: "0" }]);
    await load();
  }

  async function confirmOrder(id: string) {
    setOk(null);
    const res = await apiSend(`/api/v1/sales-orders/${id}/confirm`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("سفارش تأیید شد.");
    await load();
  }

  async function invoiceOrder(id: string) {
    if (!workspace.periodId) {
      setError("دوره مالی را از نوار بالا انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      `/api/v1/sales-orders/${id}/invoice`,
      "POST",
      {
        fiscalPeriodId: workspace.periodId,
        invoiceDateJalali: orderDate,
        arAccountId,
        revenueAccountId,
        warehouseId: warehouseId || null,
        cogsAccountId: cogsAccountId || null,
      },
      `invoice-${id}`,
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("فاکتور صادر و سند ثبت شد.");
    await load();
  }

  const columns: GridColumn<Order>[] = [
    { key: "num", header: "شماره", ltr: true, render: (r) => r.documentNumber },
    { key: "date", header: "تاریخ", ltr: true, render: (r) => r.orderDateJalali },
    { key: "cust", header: "مشتری", render: (r) => r.customerLabel },
    { key: "status", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    { key: "amt", header: "مبلغ", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.totalAmount) },
    {
      key: "actions",
      header: "عملیات",
      render: (r) => (
        <div className="page-actions">
          {r.status === "Draft" ? (
            <button type="button" className="btn-ghost" onClick={() => void confirmOrder(r.id)}>
              تأیید
            </button>
          ) : null}
          {r.status !== "Invoiced" && r.status !== "Cancelled" ? (
            <button type="button" className="btn-primary" onClick={() => void invoiceOrder(r.id)}>
              فاکتور
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const invoiceColumns: GridColumn<Invoice>[] = [
    { key: "num", header: "شماره فاکتور", ltr: true, render: (r) => r.documentNumber },
    { key: "date", header: "تاریخ", ltr: true, render: (r) => r.invoiceDateJalali },
    { key: "cust", header: "خریدار", render: (r) => r.customerLabel },
    { key: "tax", header: "مالیات و عوارض", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.taxTotal) },
    { key: "amt", header: "مبلغ کل", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.totalAmount) },
    {
      key: "print",
      header: "چاپ",
      render: (r) => (
        <Link className="btn-ghost" href={`/print/sales-invoice/${r.id}`} target="_blank">
          چاپ فاکتور
        </Link>
      ),
    },
  ];

  return (
    <AppShell title="فروش" actions={<SendToAssistant title="فروش" prompt="وضعیت سفارش‌های فروش را خلاصه کن و پیشنهاد بده" data={rows.slice(0, 40)} />}>
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <PartyManager kind="customers" onError={setError} onOk={setOk} onChanged={() => void loadLookups()} />

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>سفارش فروش</h2>
          <form className="stack" onSubmit={createOrder}>
            <div className="form-grid">
              <label>
                مشتری
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">انتخاب…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
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
                  <th>فی (ریال)</th>
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
                      <input className="ltr" inputMode="numeric" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
                    </td>
                    <td className="ltr">{formatMoneyIrr(Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)))}</td>
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
              <button type="button" className="btn-ghost" onClick={() => setLines((p) => [...p, { itemId: "", quantity: "1", unitPrice: "0" }])}>
                افزودن ردیف
              </button>
              <button type="submit" className="btn-primary">
                ایجاد سفارش
              </button>
            </div>
          </form>
          <p className="muted">برای فاکتور، حساب‌های دریافتنی/درآمد و در صورت نیاز انبار را مشخص کنید:</p>
          <div className="form-grid">
            <label>
              حساب دریافتنی
              <select value={arAccountId} onChange={(e) => setArAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب درآمد
              <select value={revenueAccountId} onChange={(e) => setRevenueAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              انبار (خروج کالا)
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">بدون خروج</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب بهای تمام‌شده
              <select value={cogsAccountId} onChange={(e) => setCogsAccountId(e.target.value)}>
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
            emptyTitle="سفارشی ثبت نشده است"
            savedViewKey="sales-orders"
          />
        </div>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>فاکتورهای فروش</h2>
          <DataGrid
            columns={invoiceColumns}
            rows={invoices}
            totalCount={invTotal}
            page={invPage}
            pageSize={10}
            onPageChange={setInvPage}
            filterValue={invFilter}
            onFilterChange={(v) => {
              setInvPage(1);
              setInvFilter(v);
            }}
            filterPlaceholder="شماره فاکتور…"
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="فاکتوری صادر نشده است"
          />
        </section>
      </div>
    </AppShell>
  );
}
