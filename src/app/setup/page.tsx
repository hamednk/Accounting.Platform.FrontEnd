"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiGet, apiSend } from "@/lib/api";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { CompanyProfileForm } from "@/components/setup/CompanyProfileForm";
import { ACCOUNT_TYPE } from "@/lib/labels";

export default function SetupPage() {
  const { workspace, refresh } = useWorkspace();
  const [code, setCode] = useState("C01");
  const [name, setName] = useState("شرکت نمونه");
  const [nationalId, setNationalId] = useState("14000000000");
  const [jalaliYear, setJalaliYear] = useState(1405);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<string>("");

  useEffect(() => {
    void apiGet<{ version?: string }>("/api/v1/meta").then((r) => {
      if (r.data?.version) setMeta(r.data.version);
    });
  }, []);

  async function createCompanyAndYear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const companyRes = await apiSend<Record<string, unknown>>("/api/v1/companies", "POST", {
      code,
      name,
      nationalId,
    });
    if (companyRes.error || !companyRes.data) {
      setBusy(false);
      setError(companyRes.error ?? "ایجاد شرکت ناموفق بود.");
      return;
    }
    const companyId = String(companyRes.data.id ?? companyRes.data.Id);

    // Temporarily set company header context via workspace save before fiscal year
    const { saveWorkspace, readWorkspace } = await import("@/lib/workspace");
    const prev = readWorkspace();
    saveWorkspace({
      ...prev,
      companyId,
      companyName: `${code} — ${name}`,
      periodId: null,
      periodName: null,
    });

    const yearRes = await apiSend<Record<string, unknown>>("/api/v1/fiscal-years", "POST", {
      companyId,
      jalaliYear,
    });
    if (yearRes.error || !yearRes.data) {
      setBusy(false);
      setError(yearRes.error ?? "ایجاد سال مالی ناموفق بود.");
      return;
    }
    const yearId = String(yearRes.data.id ?? yearRes.data.Id);
    const periodsRes = await apiSend<unknown[]>(`/api/v1/fiscal-years/${yearId}/periods`, "POST");
    if (periodsRes.error) {
      setBusy(false);
      setError(periodsRes.error);
      return;
    }

    await refresh();
    setBusy(false);
    setMessage("شرکت، سال مالی و ۱۲ دوره ماهانه ساخته شد. از نوار بالا شرکت و دوره را انتخاب کنید.");
  }

  async function seedChart() {
    if (!workspace.companyId) {
      setError("ابتدا شرکت را بسازید و انتخاب کنید.");
      return;
    }
    setBusy(true);
    setError(null);
    const A = ACCOUNT_TYPE;
    // Iranian standard chart: گروه → کل → معین (only leaves are postable).
    const chart: { code: string; name: string; accountType: number; parent?: string }[] = [
      { code: "1", name: "دارایی‌ها", accountType: A.Asset },
      { code: "11", name: "دارایی‌های جاری - نقد و بانک", accountType: A.Asset, parent: "1" },
      { code: "1101", name: "موجودی نقد و بانک", accountType: A.Asset, parent: "11" },
      { code: "12", name: "دریافتنی‌ها", accountType: A.Asset, parent: "1" },
      { code: "1201", name: "حساب‌های دریافتنی تجاری", accountType: A.Asset, parent: "12" },
      { code: "1202", name: "اسناد دریافتنی", accountType: A.Asset, parent: "12" },
      { code: "13", name: "مالیات و پیش‌پرداخت‌ها", accountType: A.Asset, parent: "1" },
      { code: "1301", name: "مالیات بر ارزش افزوده خرید", accountType: A.Asset, parent: "13" },
      { code: "14", name: "موجودی‌ها", accountType: A.Asset, parent: "1" },
      { code: "1401", name: "موجودی کالا", accountType: A.Asset, parent: "14" },
      { code: "1402", name: "کالای در جریان ساخت", accountType: A.Asset, parent: "14" },
      { code: "15", name: "دارایی‌های ثابت", accountType: A.Asset, parent: "1" },
      { code: "1501", name: "دارایی‌های ثابت مشهود", accountType: A.Asset, parent: "15" },
      { code: "1502", name: "استهلاک انباشته", accountType: A.Asset, parent: "15" },
      { code: "2", name: "بدهی‌ها", accountType: A.Liability },
      { code: "21", name: "پرداختنی‌ها", accountType: A.Liability, parent: "2" },
      { code: "2101", name: "حساب‌های پرداختنی تجاری", accountType: A.Liability, parent: "21" },
      { code: "2102", name: "اسناد پرداختنی", accountType: A.Liability, parent: "21" },
      { code: "22", name: "مالیات و عوارض", accountType: A.Liability, parent: "2" },
      { code: "2201", name: "مالیات بر ارزش افزوده فروش", accountType: A.Liability, parent: "22" },
      { code: "2202", name: "مالیات حقوق پرداختنی", accountType: A.Liability, parent: "22" },
      { code: "2203", name: "حق بیمه پرداختنی", accountType: A.Liability, parent: "22" },
      { code: "23", name: "حقوق و دستمزد پرداختنی", accountType: A.Liability, parent: "2" },
      { code: "2301", name: "حقوق پرداختنی", accountType: A.Liability, parent: "23" },
      { code: "3", name: "حقوق مالکانه", accountType: A.Equity },
      { code: "31", name: "سرمایه", accountType: A.Equity, parent: "3" },
      { code: "3101", name: "سرمایه ثبت‌شده", accountType: A.Equity, parent: "31" },
      { code: "32", name: "سود و زیان", accountType: A.Equity, parent: "3" },
      { code: "3201", name: "سود (زیان) انباشته", accountType: A.Equity, parent: "32" },
      { code: "3202", name: "خلاصه سود و زیان", accountType: A.Equity, parent: "32" },
      { code: "4", name: "درآمدها", accountType: A.Revenue },
      { code: "41", name: "درآمد عملیاتی", accountType: A.Revenue, parent: "4" },
      { code: "4101", name: "درآمد فروش", accountType: A.Revenue, parent: "41" },
      { code: "4102", name: "برگشت از فروش و تخفیفات", accountType: A.Revenue, parent: "41" },
      { code: "42", name: "درآمد غیرعملیاتی", accountType: A.Revenue, parent: "4" },
      { code: "4201", name: "سود و زیان تسعیر ارز", accountType: A.Revenue, parent: "42" },
      { code: "5", name: "هزینه‌ها", accountType: A.Expense },
      { code: "51", name: "بهای تمام‌شده", accountType: A.Expense, parent: "5" },
      { code: "5101", name: "بهای تمام‌شده کالای فروش‌رفته", accountType: A.Expense, parent: "51" },
      { code: "52", name: "هزینه‌های عملیاتی", accountType: A.Expense, parent: "5" },
      { code: "5201", name: "هزینه‌های عمومی و اداری", accountType: A.Expense, parent: "52" },
      { code: "5202", name: "هزینه حقوق و دستمزد", accountType: A.Expense, parent: "52" },
      { code: "5203", name: "هزینه استهلاک", accountType: A.Expense, parent: "52" },
    ];

    const existing = await apiGet<Record<string, unknown>[]>("/api/v1/accounts/tree");
    if (existing.error) {
      setBusy(false);
      setError(existing.error);
      return;
    }
    const idByCode = new Map<string, string>();
    for (const r of existing.data ?? []) idByCode.set(String(r.code ?? r.Code), String(r.id ?? r.Id));

    let created = 0;
    for (const a of chart) {
      if (idByCode.has(a.code)) continue;
      const parentId = a.parent ? idByCode.get(a.parent) ?? null : null;
      const res = await apiSend<Record<string, unknown>>("/api/v1/accounts", "POST", {
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        parentId,
      });
      if (res.error || !res.data) {
        setBusy(false);
        setError(`حساب ${a.code}: ${res.error ?? "ایجاد نشد"}`);
        return;
      }
      idByCode.set(a.code, String(res.data.id ?? res.data.Id));
      created++;
    }
    setBusy(false);
    setMessage(`سرفصل استاندارد (گروه/کل/معین) آماده است — ${created} حساب جدید ساخته شد.`);
  }

  return (
    <AppShell title="راه‌اندازی اولیه">
      <div className="stack">
        {message ? <SuccessBanner message={message} /> : null}
        {error ? <ErrorState message={error} /> : null}

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>۱) ایجاد شرکت و سال مالی</h2>
          <p className="muted">
            نسخه سامانه: <span className="ltr">{meta || "—"}</span>
          </p>
          <form className="form-grid" onSubmit={createCompanyAndYear}>
            <label>
              کد شرکت
              <input className="ltr" value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <label>
              نام شرکت
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              شناسه ملی
              <input className="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
            </label>
            <label>
              سال شمسی
              <input
                className="ltr"
                type="number"
                value={jalaliYear}
                onChange={(e) => setJalaliYear(Number(e.target.value))}
                required
              />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary" disabled={busy}>
                ایجاد شرکت + دوره‌ها
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>مشخصات قانونی شرکت {workspace.companyName ? `— ${workspace.companyName}` : ""}</h2>
          <p className="muted">روی سربرگ فاکتور و اسناد چاپی و ارسال به سامانه مودیان استفاده می‌شود.</p>
          <CompanyProfileForm
            onOk={(m) => {
              setError(null);
              setMessage(m);
            }}
            onError={setError}
          />
        </section>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>۲) سرفصل حساب پایه</h2>
          <p className="muted">درخت استاندارد گروه ← کل ← معین شامل نقد، دریافتنی، مالیات، موجودی، دارایی ثابت، پرداختنی، حقوق، سرمایه، درآمد و هزینه را می‌سازد (حساب‌های موجود نادیده گرفته می‌شوند).</p>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void seedChart()}>
            ایجاد سرفصل‌های نمونه
          </button>
          <div className="page-actions">
            <Link className="btn-ghost" href="/accounts">
              مشاهده حساب‌ها
            </Link>
            <Link className="btn-ghost" href="/journals">
              رفتن به اسناد
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
