"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { apiGet, apiSend } from "@/lib/api";

type Profile = {
  name: string;
  nationalId: string;
  economicCode: string;
  registrationNumber: string;
  postalCode: string;
  address: string;
  phone: string;
};

const EMPTY: Profile = { name: "", nationalId: "", economicCode: "", registrationNumber: "", postalCode: "", address: "", phone: "" };

/** Legal identity of the selected company — printed on invoices and used for سامانه مودیان. */
export function CompanyProfileForm({ onOk, onError }: { onOk: (m: string) => void; onError: (m: string) => void }) {
  const { workspace, refresh } = useWorkspace();
  const [form, setForm] = useState<Profile>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspace.companyId) return;
    void apiGet<Record<string, unknown>>(`/api/v1/companies/${workspace.companyId}`).then((res) => {
      const r = res.data;
      if (!r) return;
      const s = (k: string) => String(r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)] ?? "");
      setForm({
        name: s("name"),
        nationalId: s("nationalId"),
        economicCode: s("economicCode"),
        registrationNumber: s("registrationNumber"),
        postalCode: s("postalCode"),
        address: s("address"),
        phone: s("phone"),
      });
    });
  }, [workspace.companyId]);

  function set<K extends keyof Profile>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.companyId) {
      onError("ابتدا شرکت را انتخاب کنید.");
      return;
    }
    setBusy(true);
    const res = await apiSend(`/api/v1/companies/${workspace.companyId}`, "PUT", {
      name: form.name,
      nationalId: form.nationalId,
      economicCode: form.economicCode || null,
      registrationNumber: form.registrationNumber || null,
      postalCode: form.postalCode || null,
      address: form.address || null,
      phone: form.phone || null,
    });
    setBusy(false);
    if (res.error) {
      onError(res.error);
      return;
    }
    onOk("مشخصات شرکت ذخیره شد.");
    await refresh();
  }

  if (!workspace.companyId) return <p className="muted">پس از ایجاد/انتخاب شرکت، مشخصات قانونی را اینجا تکمیل کنید.</p>;

  return (
    <form className="form-grid" onSubmit={save}>
      <label>
        نام قانونی
        <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </label>
      <label>
        شناسه ملی
        <input className="ltr" inputMode="numeric" value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} required />
      </label>
      <label>
        کد اقتصادی
        <input className="ltr" inputMode="numeric" value={form.economicCode} onChange={(e) => set("economicCode", e.target.value)} />
      </label>
      <label>
        شماره ثبت
        <input className="ltr" value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
      </label>
      <label>
        کد پستی
        <input className="ltr" inputMode="numeric" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
      </label>
      <label>
        تلفن
        <input className="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </label>
      <label style={{ gridColumn: "1 / -1" }}>
        نشانی
        <textarea className="field-control" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
      </label>
      <div style={{ alignSelf: "end" }}>
        <button type="submit" className="btn-primary" disabled={busy}>
          ذخیره مشخصات
        </button>
      </div>
    </form>
  );
}
