"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorState } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { LedgerView, mapLedger, type Ledger } from "@/components/reports/LedgerView";
import { apiGet } from "@/lib/api";
import { accountLevelFa } from "@/lib/labels";

type AccountOption = { id: string; code: string; name: string; level: string };
const PAGE_SIZE = 100;

function AccountLedgerContent() {
  const params = useSearchParams();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState(params.get("accountId") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeChildren, setIncludeChildren] = useState(true);
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Record<string, unknown>[]>("/api/v1/accounts/tree").then((res) => {
      if (res.error) {
        setError(res.error);
        return;
      }
      setAccounts(
        (res.data ?? [])
          .map((r) => ({
            id: String(r.id ?? r.Id),
            code: String(r.code ?? r.Code ?? ""),
            name: String(r.name ?? r.Name ?? ""),
            level: String(r.level ?? r.Level ?? ""),
          }))
          .sort((a, b) => a.code.localeCompare(b.code)),
      );
    });
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const q = new URLSearchParams({
      accountId,
      includeChildren: String(includeChildren),
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (from) q.set("fromJalali", from);
    if (to) q.set("toJalali", to);
    const res = await apiGet<Record<string, unknown>>(`/api/v1/reports/account-ledger?${q.toString()}`);
    if (res.error || !res.data) {
      setError(res.error ?? "دریافت دفتر ناموفق بود.");
      setLedger(null);
    } else {
      setError(null);
      setLedger(mapLedger(res.data));
    }
    setLoading(false);
  }, [accountId, from, to, includeChildren, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      <div className="panel form-grid">
        <label>
          حساب (کل / معین / تفصیلی)
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">— انتخاب حساب —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name} ({accountLevelFa(a.level)})
              </option>
            ))}
          </select>
        </label>
        <label>
          از تاریخ
          <JalaliDatePicker
            value={from}
            onChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
          />
        </label>
        <label>
          تا تاریخ
          <JalaliDatePicker
            value={to}
            onChange={(v) => {
              setTo(v);
              setPage(1);
            }}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeChildren}
            onChange={(e) => {
              setIncludeChildren(e.target.checked);
              setPage(1);
            }}
          />
          شامل زیرحساب‌ها
        </label>
      </div>
      {accountId ? (
        <LedgerView ledger={ledger} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading} />
      ) : (
        <p className="panel muted">یک حساب را انتخاب کنید تا گردش و مانده آن نمایش داده شود.</p>
      )}
    </div>
  );
}

export default function AccountLedgerPage() {
  return (
    <AppShell title="دفتر کل و معین">
      <Suspense fallback={<p className="muted">در حال بارگذاری…</p>}>
        <AccountLedgerContent />
      </Suspense>
    </AppShell>
  );
}
