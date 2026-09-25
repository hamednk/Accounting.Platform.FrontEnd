"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { apiGetPaged, apiSend } from "@/lib/api";

export type Party = {
  id: string;
  code: string;
  name: string;
  nationalId: string;
  economicCode: string;
  postalCode: string;
  address: string;
  phone: string;
  isActive: boolean;
  creditLimit: string;
};

export function mapParty(r: Record<string, unknown>): Party {
  const s = (k: string) => String(r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)] ?? "");
  const credit = r.creditLimit ?? r.CreditLimit;
  return {
    id: s("id"),
    code: s("code"),
    name: s("name"),
    nationalId: s("nationalId"),
    economicCode: s("economicCode"),
    postalCode: s("postalCode"),
    address: s("address"),
    phone: s("phone"),
    isActive: (r.isActive ?? r.IsActive ?? true) !== false,
    creditLimit: credit == null || credit === "" ? "" : String(credit),
  };
}

const EMPTY: Party = { id: "", code: "", name: "", nationalId: "", economicCode: "", postalCode: "", address: "", phone: "", isActive: true, creditLimit: "" };

/**
 * Customer/vendor register with Iranian invoice identity fields (کد اقتصادی، شناسه ملی، کد پستی).
 * Server-side search + paging; create then profile update via PUT; hard delete only when unused.
 */
export function PartyManager({
  kind,
  onChanged,
  onError,
  onOk,
}: {
  kind: "customers" | "vendors";
  onChanged?: () => void;
  onError: (msg: string) => void;
  onOk: (msg: string) => void;
}) {
  const label = kind === "customers" ? "مشتری" : "تأمین‌کننده";
  const [rows, setRows] = useState<Party[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Party>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search) q.set("search", search);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/${kind}?${q.toString()}`);
    if (res.error) onError(res.error);
    setRows((res.data?.items ?? []).map(mapParty));
    setTotal(res.data?.totalCount ?? 0);
    setLoading(false);
  }, [kind, page, search, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof Party>(k: K, v: Party[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let id = form.id;
    if (!id) {
      const created = await apiSend<Record<string, unknown>>(`/api/v1/${kind}`, "POST", {
        code: form.code,
        name: form.name,
        nationalId: form.nationalId || null,
        ...(kind === "customers"
          ? {
              phone: form.phone || null,
              creditLimit: form.creditLimit.trim() === "" ? null : Number(form.creditLimit),
            }
          : {}),
      });
      if (created.error || !created.data) {
        setBusy(false);
        onError(created.error ?? `ایجاد ${label} ناموفق بود.`);
        return;
      }
      id = String(created.data.id ?? created.data.Id);
    }
    const res = await apiSend(`/api/v1/${kind}/${id}`, "PUT", {
      name: form.name,
      nationalId: form.nationalId || null,
      economicCode: form.economicCode || null,
      postalCode: form.postalCode || null,
      address: form.address || null,
      phone: form.phone || null,
      isActive: form.isActive,
      ...(kind === "customers"
        ? { creditLimit: form.creditLimit.trim() === "" ? null : Number(form.creditLimit) }
        : {}),
    });
    setBusy(false);
    if (res.error) {
      onError(res.error);
      return;
    }
    onOk(form.id ? `${label} ویرایش شد.` : `${label} ایجاد شد.`);
    setForm(EMPTY);
    await load();
    onChanged?.();
  }

  async function toggleActive(row: Party) {
    const res = await apiSend(`/api/v1/${kind}/${row.id}`, "PUT", {
      name: row.name,
      nationalId: row.nationalId || null,
      economicCode: row.economicCode || null,
      postalCode: row.postalCode || null,
      address: row.address || null,
      phone: row.phone || null,
      isActive: !row.isActive,
      ...(kind === "customers"
        ? { creditLimit: row.creditLimit.trim() === "" ? null : Number(row.creditLimit) }
        : {}),
    });
    if (res.error) {
      onError(res.error);
      return;
    }
    onOk(row.isActive ? `${label} غیرفعال شد.` : `${label} فعال شد.`);
    await load();
    onChanged?.();
  }

  async function remove(row: Party) {
    const res = await apiSend(`/api/v1/${kind}/${row.id}`, "DELETE");
    if (res.error) throw new Error(res.error);
    onOk(`${label} حذف شد.`);
    if (form.id === row.id) setForm(EMPTY);
    await load();
    onChanged?.();
  }

  const columns: GridColumn<Party>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => r.name },
    { key: "eco", header: "کد اقتصادی", ltr: true, render: (r) => r.economicCode },
    { key: "nid", header: "شناسه/کد ملی", ltr: true, render: (r) => r.nationalId },
    ...(kind === "customers"
      ? ([
          {
            key: "credit",
            header: "سقف اعتبار",
            align: "end" as const,
            ltr: true,
            render: (r: Party) => (r.creditLimit ? r.creditLimit : "نامحدود"),
          },
        ] as GridColumn<Party>[])
      : []),
    { key: "st", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "act",
      header: "اقدام",
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setForm(r)}>
            ویرایش
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => void toggleActive(r)}>
            {r.isActive ? "غیرفعال" : "فعال"}
          </button>
          <ConfirmAction
            title={`حذف ${label}`}
            consequences={[
              `کد ${r.code} برای همیشه حذف می‌شود.`,
              "اگر در فاکتور/سفارش استفاده شده باشد، حذف مجاز نیست — از غیرفعال‌سازی استفاده کنید.",
            ]}
            reference={r.code}
            confirmLabel="حذف"
            onConfirm={() => remove(r)}
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
    <section className="panel stack">
      <h2 style={{ margin: 0, fontSize: "1rem" }}>{form.id ? `ویرایش ${label} ${form.code}` : `${label} جدید`}</h2>
      <form className="form-grid" onSubmit={save}>
        <label>
          کد
          <input className="ltr" value={form.code} onChange={(e) => set("code", e.target.value)} required disabled={!!form.id} />
        </label>
        <label>
          نام
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </label>
        <label>
          شناسه/کد ملی
          <input className="ltr" inputMode="numeric" value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
        </label>
        <label>
          کد اقتصادی
          <input className="ltr" inputMode="numeric" value={form.economicCode} onChange={(e) => set("economicCode", e.target.value)} />
        </label>
        <label>
          کد پستی
          <input className="ltr" inputMode="numeric" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
        </label>
        <label>
          تلفن
          <input className="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>
        {kind === "customers" ? (
          <label>
            سقف اعتبار (ریال — خالی = نامحدود)
            <input
              className="ltr"
              inputMode="numeric"
              value={form.creditLimit}
              onChange={(e) => set("creditLimit", e.target.value)}
              placeholder="نامحدود"
            />
          </label>
        ) : null}
        <label style={{ gridColumn: "1 / -1" }}>
          نشانی
          <input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </label>
        {form.id ? (
          <label>
            <span>
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> فعال
            </span>
          </label>
        ) : null}
        <div className="page-actions" style={{ alignSelf: "end" }}>
          <button type="submit" className="btn-secondary" disabled={busy}>
            {form.id ? "ذخیره" : `ایجاد ${label}`}
          </button>
          {form.id ? (
            <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY)}>
              انصراف
            </button>
          ) : null}
        </div>
      </form>
      <DataGrid
        columns={columns}
        rows={rows}
        totalCount={total}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        filterValue={search}
        onFilterChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        filterPlaceholder="جستجوی کد یا نام…"
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle={`${label}ی ثبت نشده است`}
      />
    </section>
  );
}
