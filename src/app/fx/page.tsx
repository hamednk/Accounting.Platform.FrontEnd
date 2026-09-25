"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

type RateRow = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveFromJalali: string;
};

type CurrencyRow = {
  id: string;
  code: string;
  nameFa: string;
  decimalPlaces: number;
  isActive: boolean;
};

type Named = { id: string; code: string; name: string };

function pick(r: Record<string, unknown>, k: string): unknown {
  return r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)];
}

function mapRate(r: Record<string, unknown>): RateRow {
  return {
    id: String(pick(r, "id")),
    fromCurrency: String(pick(r, "fromCurrency") ?? ""),
    toCurrency: String(pick(r, "toCurrency") ?? ""),
    rate: Number(pick(r, "rate") ?? 0),
    effectiveFromJalali: String(pick(r, "effectiveFromJalali") ?? ""),
  };
}

function mapCurrency(r: Record<string, unknown>): CurrencyRow {
  return {
    id: String(pick(r, "id")),
    code: String(pick(r, "code") ?? ""),
    nameFa: String(pick(r, "nameFa") ?? ""),
    decimalPlaces: Number(pick(r, "decimalPlaces") ?? 0),
    isActive: (pick(r, "isActive") ?? true) !== false,
  };
}

export default function FxPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [currencyCode, setCurrencyCode] = useState("AED");
  const [currencyName, setCurrencyName] = useState("درهم امارات");
  const [currencyDecimals, setCurrencyDecimals] = useState("2");
  const [currencyActive, setCurrencyActive] = useState(true);

  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("IRR");
  const [rate, setRate] = useState("600000");
  const [effectiveFrom, setEffectiveFrom] = useState("1405/01/01");

  const [asOf, setAsOf] = useState("1405/01/29");
  const [gainAccountId, setGainAccountId] = useState("");
  const [lossAccountId, setLossAccountId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/exchange-rates?page=${page}&pageSize=20`);
    if (res.error) {
      setError(res.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows((res.data?.items ?? []).map(mapRate));
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  const loadCurrencies = useCallback(async () => {
    const res = await apiGet<Record<string, unknown>[]>("/api/v1/currencies");
    if (res.error) {
      setError(res.error);
      return;
    }
    setCurrencies((res.data ?? []).map(mapCurrency));
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
    const next = (res.data?.items ?? []).map((r) => ({
      id: String(pick(r, "id")),
      code: String(pick(r, "code") ?? ""),
      name: String(pick(r, "name") ?? ""),
    }));
    setAccounts(next);
    setGainAccountId((prev) => prev || next.find((a) => a.code.startsWith("41"))?.id || next[0]?.id || "");
    setLossAccountId((prev) => prev || next.find((a) => a.code.startsWith("51"))?.id || next[0]?.id || "");
  }, []);

  useEffect(() => {
    void load();
    void loadAccounts();
    void loadCurrencies();
  }, [load, loadAccounts, loadCurrencies]);

  async function upsertCurrency(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend("/api/v1/currencies", "POST", {
      code: currencyCode,
      nameFa: currencyName,
      decimalPlaces: Number(currencyDecimals),
      isActive: currencyActive,
    });
    if (res.error) setError(res.error);
    else {
      setOk("ارز ذخیره شد.");
      await loadCurrencies();
    }
  }

  async function setRateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend("/api/v1/exchange-rates", "POST", {
      fromCurrency,
      toCurrency,
      rate: Number(rate),
      effectiveFromJalali: effectiveFrom,
    });
    if (res.error) setError(res.error);
    else {
      setOk("نرخ ارز ذخیره شد.");
      await load();
    }
  }

  async function revalue(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (!workspace.companyId || !workspace.periodId) {
      setError("شرکت و دوره مالی را انتخاب کنید.");
      return;
    }
    const res = await apiSend<{ message?: string; Message?: string; created?: boolean; Created?: boolean }>(
      "/api/v1/fx/revaluations",
      "POST",
      {
        companyId: workspace.companyId,
        fiscalPeriodId: workspace.periodId,
        asOfJalali: asOf,
        gainAccountId,
        lossAccountId,
      },
      `fx-rev-${workspace.companyId}-${workspace.periodId}-${asOf}`,
    );
    if (res.error) setError(res.error);
    else setOk(String(res.data?.message ?? res.data?.Message ?? "تسعیر انجام شد."));
  }

  const cols: GridColumn<RateRow>[] = [
    { key: "fromCurrency", header: "از", render: (r) => r.fromCurrency },
    { key: "toCurrency", header: "به", render: (r) => r.toCurrency },
    { key: "rate", header: "نرخ", align: "end", ltr: true, render: (r) => r.rate.toLocaleString("fa-IR") },
    { key: "effectiveFromJalali", header: "از تاریخ", ltr: true, render: (r) => r.effectiveFromJalali },
  ];

  const currencyCols: GridColumn<CurrencyRow>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => r.nameFa },
    { key: "dp", header: "اعشار", ltr: true, render: (r) => r.decimalPlaces },
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
              setCurrencyCode(r.code);
              setCurrencyName(r.nameFa);
              setCurrencyDecimals(String(r.decimalPlaces));
              setCurrencyActive(r.isActive);
            }}
          >
            ویرایش
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void (async () => {
                const res = await apiSend("/api/v1/currencies", "POST", {
                  code: r.code,
                  nameFa: r.nameFa,
                  decimalPlaces: r.decimalPlaces,
                  isActive: !r.isActive,
                });
                if (res.error) setError(res.error);
                else {
                  setOk(r.isActive ? "ارز غیرفعال شد." : "ارز فعال شد.");
                  await loadCurrencies();
                }
              })();
            }}
          >
            {r.isActive ? "غیرفعال" : "فعال"}
          </button>
          <ConfirmAction
            title="حذف ارز"
            consequences={[`ارز ${r.code} حذف می‌شود.`, "ریال و ارزهای دارای نرخ/سند قابل حذف نیستند."]}
            reference={r.code}
            confirmLabel="حذف"
            onConfirm={async () => {
              const res = await apiSend(`/api/v1/currencies/${r.code}`, "DELETE");
              if (res.error) throw new Error(res.error);
              setOk("ارز حذف شد.");
              await loadCurrencies();
            }}
          >
            {(open) => (
              <button type="button" className="btn-danger btn-sm" onClick={open} disabled={r.code === "IRR"}>
                حذف
              </button>
            )}
          </ConfirmAction>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="ارز و تسعیر">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {ok ? <SuccessBanner message={ok} /> : null}

      <section className="panel">
        <h2>تعریف ارز</h2>
        <form className="form-grid" onSubmit={upsertCurrency}>
          <label>
            کد
            <input className="ltr" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} required />
          </label>
          <label>
            نام فارسی
            <input value={currencyName} onChange={(e) => setCurrencyName(e.target.value)} required />
          </label>
          <label>
            تعداد اعشار
            <input className="ltr" value={currencyDecimals} onChange={(e) => setCurrencyDecimals(e.target.value)} required />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={currencyActive} onChange={(e) => setCurrencyActive(e.target.checked)} />
            فعال
          </label>
          <button type="submit" className="btn-secondary">
            ذخیره ارز
          </button>
        </form>
        <DataGrid
          columns={currencyCols}
          rows={currencies}
          loading={false}
          page={1}
          pageSize={50}
          totalCount={currencies.length}
          onPageChange={() => undefined}
          rowKey={(r) => r.id}
          emptyTitle="ارزی ثبت نشده"
        />
      </section>

      <section className="panel">
        <h2>ثبت نرخ ارز</h2>
        <form className="form-grid" onSubmit={setRateSubmit}>
          <label>
            از ارز
            <input value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value.toUpperCase())} required />
          </label>
          <label>
            به ارز
            <input value={toCurrency} onChange={(e) => setToCurrency(e.target.value.toUpperCase())} required />
          </label>
          <label>
            نرخ
            <input type="number" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </label>
          <label>
            تاریخ مؤثر
            <JalaliDatePicker value={effectiveFrom} onChange={setEffectiveFrom} required />
          </label>
          <button type="submit" className="btn-primary">
            ذخیره نرخ
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>نرخ‌های ثبت‌شده</h2>
        <DataGrid
          columns={cols}
          rows={rows}
          loading={loading}
          page={page}
          pageSize={20}
          totalCount={total}
          onPageChange={setPage}
          rowKey={(r) => r.id}
        />
      </section>

      <section className="panel">
        <h2>تسعیر ارز (پیش‌نویس)</h2>
        <form className="form-grid" onSubmit={revalue}>
          <label>
            تاریخ تسعیر
            <JalaliDatePicker value={asOf} onChange={setAsOf} required />
          </label>
          <label>
            حساب سود تسعیر
            <select value={gainAccountId} onChange={(e) => setGainAccountId(e.target.value)} required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            حساب زیان تسعیر
            <select value={lossAccountId} onChange={(e) => setLossAccountId(e.target.value)} required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">
            ایجاد پیش‌نویس تسعیر
          </button>
        </form>
      </section>
    </AppShell>
  );
}
