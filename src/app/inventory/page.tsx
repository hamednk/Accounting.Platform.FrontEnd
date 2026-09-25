"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { SendToAssistant } from "@/components/ai/SendToAssistant";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr, formatQuantity } from "@/lib/format";

type Named = { id: string; code: string; name: string };
type ItemRow = Named & {
  unitOfMeasure: string;
  inventoryAccountId: string;
  cogsAccountId: string;
  isActive: boolean;
};
type WarehouseRow = Named & { isActive: boolean };
type BalanceRow = {
  warehouseId: string;
  itemId: string;
  warehouseLabel: string;
  itemLabel: string;
  quantityOnHand: number;
  averageUnitCost: number;
  inventoryValue: number;
};

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

function mapItem(raw: Record<string, unknown>): ItemRow {
  return {
    ...mapNamed(raw),
    unitOfMeasure: String(raw.unitOfMeasure ?? raw.UnitOfMeasure ?? "PCS"),
    inventoryAccountId: String(raw.inventoryAccountId ?? raw.InventoryAccountId ?? ""),
    cogsAccountId: String(raw.cogsAccountId ?? raw.CogsAccountId ?? ""),
    isActive: (raw.isActive ?? raw.IsActive ?? true) !== false,
  };
}

function mapWarehouse(raw: Record<string, unknown>): WarehouseRow {
  return {
    ...mapNamed(raw),
    isActive: (raw.isActive ?? raw.IsActive ?? true) !== false,
  };
}

export default function InventoryPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whCode, setWhCode] = useState("WH01");
  const [whName, setWhName] = useState("انبار مرکزی");
  const [whActive, setWhActive] = useState(true);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemCode, setItemCode] = useState("ITM01");
  const [itemName, setItemName] = useState("کالای نمونه");
  const [uom, setUom] = useState("عدد");
  const [invAccountId, setInvAccountId] = useState("");
  const [cogsAccountId, setCogsAccountId] = useState("");
  const [itemActive, setItemActive] = useState(true);

  const [receiptWh, setReceiptWh] = useState("");
  const [receiptItem, setReceiptItem] = useState("");
  const [qty, setQty] = useState("10");
  const [unitCost, setUnitCost] = useState("100000");
  const [clearingAccountId, setClearingAccountId] = useState("");
  const [dateJalali, setDateJalali] = useState("1405/01/15");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferItem, setTransferItem] = useState("");
  const [transferQty, setTransferQty] = useState("10");
  const [transferDate, setTransferDate] = useState("1405/01/15");

  const loadLookups = useCallback(async () => {
    const [itemsRes, whRes, accRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>("/api/v1/items?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/warehouses?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true"),
    ]);
    const nextItems = (itemsRes.data?.items ?? []).map(mapItem);
    const nextWh = (whRes.data?.items ?? []).map(mapWarehouse);
    const nextAcc = (accRes.data?.items ?? []).map(mapNamed);
    setItems(nextItems);
    setWarehouses(nextWh);
    setAccounts(nextAcc);
    const pick = (prefix: string) => nextAcc.find((a) => a.code.startsWith(prefix))?.id ?? nextAcc[0]?.id ?? "";
    setReceiptItem((prev) => prev || nextItems[0]?.id || "");
    setReceiptWh((prev) => prev || nextWh[0]?.id || "");
    setTransferItem((prev) => prev || nextItems[0]?.id || "");
    setTransferFrom((prev) => prev || nextWh[0]?.id || "");
    setTransferTo((prev) => prev || nextWh[1]?.id || nextWh[0]?.id || "");
    setInvAccountId((prev) => prev || pick("14"));
    setCogsAccountId((prev) => prev || pick("51"));
    setClearingAccountId((prev) => prev || pick("21"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [balRes, itemsRes, whRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>(`/api/v1/stock/balances?page=${page}&pageSize=20`),
      apiGetPaged<Record<string, unknown>>("/api/v1/items?page=1&pageSize=200"),
      apiGetPaged<Record<string, unknown>>("/api/v1/warehouses?page=1&pageSize=200"),
    ]);
    if (balRes.error) {
      setError(balRes.error);
      setRows([]);
      setTotal(0);
    } else {
      const itemMap = new Map((itemsRes.data?.items ?? []).map(mapNamed).map((i) => [i.id, i]));
      const whMap = new Map((whRes.data?.items ?? []).map(mapNamed).map((w) => [w.id, w]));
      setError(null);
      setRows(
        (balRes.data?.items ?? []).map((r) => {
          const warehouseId = String(r.warehouseId ?? r.WarehouseId);
          const itemId = String(r.itemId ?? r.ItemId);
          const wh = whMap.get(warehouseId);
          const it = itemMap.get(itemId);
          return {
            warehouseId,
            itemId,
            warehouseLabel: wh ? `${wh.code} — ${wh.name}` : warehouseId.slice(0, 8),
            itemLabel: it ? `${it.code} — ${it.name}` : itemId.slice(0, 8),
            quantityOnHand: Number(r.quantityOnHand ?? r.QuantityOnHand ?? 0),
            averageUnitCost: Number(r.averageUnitCost ?? r.AverageUnitCost ?? 0),
            inventoryValue: Number(r.inventoryValue ?? r.InventoryValue ?? 0),
          };
        }),
      );
      setTotal(balRes.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
    void loadLookups();
  }, [load, loadLookups]);

  function resetWarehouseForm() {
    setEditingWhId(null);
    setWhCode("WH01");
    setWhName("انبار مرکزی");
    setWhActive(true);
  }

  function resetItemForm() {
    setEditingItemId(null);
    setItemCode("ITM01");
    setItemName("کالای نمونه");
    setUom("عدد");
    setItemActive(true);
  }

  async function saveWarehouse(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (editingWhId) {
      const res = await apiSend(`/api/v1/warehouses/${editingWhId}`, "PUT", { name: whName, isActive: whActive });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("انبار ویرایش شد.");
    } else {
      const res = await apiSend("/api/v1/warehouses", "POST", { code: whCode, name: whName });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("انبار ایجاد شد.");
    }
    resetWarehouseForm();
    await loadLookups();
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (editingItemId) {
      const res = await apiSend(`/api/v1/items/${editingItemId}`, "PUT", {
        name: itemName,
        unitOfMeasure: uom,
        inventoryAccountId: invAccountId,
        cogsAccountId,
        allowNegativeStock: false,
        isActive: itemActive,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("کالا ویرایش شد.");
    } else {
      const res = await apiSend("/api/v1/items", "POST", {
        code: itemCode,
        name: itemName,
        unitOfMeasure: uom,
        costingMethod: 0,
        inventoryAccountId: invAccountId,
        cogsAccountId,
        allowNegativeStock: false,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("کالا ایجاد شد.");
    }
    resetItemForm();
    await loadLookups();
  }

  async function receiveStock(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.companyId) {
      setError("ابتدا شرکت را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      "/api/v1/stock/receipts",
      "POST",
      {
        warehouseId: receiptWh,
        itemId: receiptItem,
        movementDateJalali: dateJalali,
        quantity: Number(qty),
        unitCost: Number(unitCost),
        reference: `RCV-${Date.now()}`,
        fiscalPeriodId: workspace.periodId,
        clearingAccountId: clearingAccountId || null,
      },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("رسید انبار ثبت شد.");
    await load();
  }

  async function transferStock(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.companyId) {
      setError("ابتدا شرکت را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      "/api/v1/stock/transfers",
      "POST",
      {
        fromWarehouseId: transferFrom,
        toWarehouseId: transferTo,
        itemId: transferItem,
        movementDateJalali: transferDate,
        quantity: Number(transferQty),
        reference: `XFER-${Date.now()}`,
        fiscalPeriodId: workspace.periodId,
      },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("انتقال بین انبارها ثبت شد.");
    await load();
  }

  const balanceColumns: GridColumn<BalanceRow>[] = [
    { key: "wh", header: "انبار", render: (r) => r.warehouseLabel },
    { key: "item", header: "کالا", render: (r) => r.itemLabel },
    { key: "qty", header: "موجودی", align: "end", ltr: true, render: (r) => formatQuantity(r.quantityOnHand) },
    { key: "avg", header: "میانگین بها", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.averageUnitCost) },
    { key: "val", header: "ارزش", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.inventoryValue) },
  ];

  const itemColumns: GridColumn<ItemRow>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => r.name },
    { key: "uom", header: "واحد", render: (r) => r.unitOfMeasure },
    { key: "st", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "act",
      header: "اقدام",
      render: (r) => (
        <div className="row-actions">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setEditingItemId(r.id);
              setItemCode(r.code);
              setItemName(r.name);
              setUom(r.unitOfMeasure);
              setInvAccountId(r.inventoryAccountId);
              setCogsAccountId(r.cogsAccountId);
              setItemActive(r.isActive);
            }}
          >
            ویرایش
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void (async () => {
                const res = await apiSend(`/api/v1/items/${r.id}`, "PUT", {
                  name: r.name,
                  unitOfMeasure: r.unitOfMeasure,
                  inventoryAccountId: r.inventoryAccountId,
                  cogsAccountId: r.cogsAccountId,
                  allowNegativeStock: false,
                  isActive: !r.isActive,
                });
                if (res.error) setError(res.error);
                else {
                  setOk(r.isActive ? "کالا غیرفعال شد." : "کالا فعال شد.");
                  await loadLookups();
                }
              })();
            }}
          >
            {r.isActive ? "غیرفعال" : "فعال"}
          </button>
          <ConfirmAction
            title="حذف کالا"
            consequences={[`کالای ${r.code} حذف می‌شود.`, "اگر حرکت انبار داشته باشد حذف مجاز نیست — غیرفعال کنید."]}
            reference={r.code}
            confirmLabel="حذف"
            onConfirm={async () => {
              const res = await apiSend(`/api/v1/items/${r.id}`, "DELETE");
              if (res.error) throw new Error(res.error);
              setOk("کالا حذف شد.");
              if (editingItemId === r.id) resetItemForm();
              await loadLookups();
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
  ];

  const warehouseColumns: GridColumn<WarehouseRow>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => r.name },
    { key: "st", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "act",
      header: "اقدام",
      render: (r) => (
        <div className="row-actions">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setEditingWhId(r.id);
              setWhCode(r.code);
              setWhName(r.name);
              setWhActive(r.isActive);
            }}
          >
            ویرایش
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void (async () => {
                const res = await apiSend(`/api/v1/warehouses/${r.id}`, "PUT", { name: r.name, isActive: !r.isActive });
                if (res.error) setError(res.error);
                else {
                  setOk(r.isActive ? "انبار غیرفعال شد." : "انبار فعال شد.");
                  await loadLookups();
                }
              })();
            }}
          >
            {r.isActive ? "غیرفعال" : "فعال"}
          </button>
          <ConfirmAction
            title="حذف انبار"
            consequences={[`انبار ${r.code} حذف می‌شود.`, "اگر حرکت یا مانده داشته باشد حذف مجاز نیست — غیرفعال کنید."]}
            reference={r.code}
            confirmLabel="حذف"
            onConfirm={async () => {
              const res = await apiSend(`/api/v1/warehouses/${r.id}`, "DELETE");
              if (res.error) throw new Error(res.error);
              setOk("انبار حذف شد.");
              if (editingWhId === r.id) resetWarehouseForm();
              await loadLookups();
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
  ];

  return (
    <AppShell title="انبار" actions={<SendToAssistant title="انبار" prompt="موجودی انبار را تحلیل کن؛ کالاهای کم‌موجودی یا راکد کدام‌اند؟" data={rows.slice(0, 60)} />}>
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <div className="kpi-grid">
          <section className="panel stack">
            <h2 style={{ margin: 0, fontSize: "1rem" }}>{editingWhId ? `ویرایش انبار ${whCode}` : "انبار جدید"}</h2>
            <form className="form-grid" onSubmit={saveWarehouse}>
              <label>
                کد
                <input className="ltr" value={whCode} onChange={(e) => setWhCode(e.target.value)} required disabled={!!editingWhId} />
              </label>
              <label>
                نام
                <input value={whName} onChange={(e) => setWhName(e.target.value)} required />
              </label>
              {editingWhId ? (
                <label>
                  <span>
                    <input type="checkbox" checked={whActive} onChange={(e) => setWhActive(e.target.checked)} /> فعال
                  </span>
                </label>
              ) : null}
              <div className="page-actions" style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-secondary">
                  {editingWhId ? "ذخیره" : "ایجاد انبار"}
                </button>
                {editingWhId ? (
                  <button type="button" className="btn-ghost" onClick={resetWarehouseForm}>
                    انصراف
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="panel stack">
            <h2 style={{ margin: 0, fontSize: "1rem" }}>{editingItemId ? `ویرایش کالا ${itemCode}` : "کالای جدید"}</h2>
            <form className="form-grid" onSubmit={saveItem}>
              <label>
                کد
                <input className="ltr" value={itemCode} onChange={(e) => setItemCode(e.target.value)} required disabled={!!editingItemId} />
              </label>
              <label>
                نام
                <input value={itemName} onChange={(e) => setItemName(e.target.value)} required />
              </label>
              <label>
                واحد
                <input value={uom} onChange={(e) => setUom(e.target.value)} required />
              </label>
              <label>
                حساب موجودی
                <select value={invAccountId} onChange={(e) => setInvAccountId(e.target.value)} required>
                  <option value="">انتخاب…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                حساب بهای تمام‌شده
                <select value={cogsAccountId} onChange={(e) => setCogsAccountId(e.target.value)} required>
                  <option value="">انتخاب…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              {editingItemId ? (
                <label>
                  <span>
                    <input type="checkbox" checked={itemActive} onChange={(e) => setItemActive(e.target.checked)} /> فعال
                  </span>
                </label>
              ) : null}
              <div className="page-actions" style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-secondary">
                  {editingItemId ? "ذخیره" : "ایجاد کالا"}
                </button>
                {editingItemId ? (
                  <button type="button" className="btn-ghost" onClick={resetItemForm}>
                    انصراف
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>

        <div className="panel">
          <h2 className="section-title">کالاها</h2>
          <DataGrid
            columns={itemColumns}
            rows={items}
            totalCount={items.length}
            page={1}
            pageSize={200}
            onPageChange={() => undefined}
            rowKey={(r) => r.id}
            emptyTitle="کالایی ثبت نشده"
          />
        </div>

        <div className="panel">
          <h2 className="section-title">انبارها</h2>
          <DataGrid
            columns={warehouseColumns}
            rows={warehouses}
            totalCount={warehouses.length}
            page={1}
            pageSize={200}
            onPageChange={() => undefined}
            rowKey={(r) => r.id}
            emptyTitle="انباری ثبت نشده"
          />
        </div>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>رسید موجودی</h2>
          <form className="form-grid" onSubmit={receiveStock}>
            <label>
              انبار
              <select value={receiptWh} onChange={(e) => setReceiptWh(e.target.value)} required>
                <option value="">انتخاب…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              کالا
              <select value={receiptItem} onChange={(e) => setReceiptItem(e.target.value)} required>
                <option value="">انتخاب…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تاریخ شمسی
              <JalaliDatePicker value={dateJalali} onChange={setDateJalali} required />
            </label>
            <label>
              مقدار
              <input className="ltr" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </label>
            <label>
              بهای واحد (ریال)
              <input className="ltr" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required />
            </label>
            <label>
              طرف حساب (اختیاری برای ثبت سند)
              <select value={clearingAccountId} onChange={(e) => setClearingAccountId(e.target.value)}>
                <option value="">بدون سند</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ثبت رسید
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>انتقال بین انبارها</h2>
          <form className="form-grid" onSubmit={transferStock}>
            <label>
              از انبار
              <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} required>
                <option value="">انتخاب…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              به انبار
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} required>
                <option value="">انتخاب…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              کالا
              <select value={transferItem} onChange={(e) => setTransferItem(e.target.value)} required>
                <option value="">انتخاب…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تاریخ شمسی
              <JalaliDatePicker value={transferDate} onChange={setTransferDate} required />
            </label>
            <label>
              مقدار
              <input className="ltr" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} required />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ثبت انتقال
              </button>
            </div>
          </form>
        </section>

        <div className="panel">
          <DataGrid
            columns={balanceColumns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            rowKey={(r) => `${r.warehouseId}-${r.itemId}`}
            loading={loading}
            emptyTitle="موجودی ثبت نشده است"
            savedViewKey="inventory-balances"
          />
        </div>
      </div>
    </AppShell>
  );
}
