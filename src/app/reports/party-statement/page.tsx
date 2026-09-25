"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorState } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { LedgerView, mapLedger, type Ledger } from "@/components/reports/LedgerView";
import { apiGet, apiGetPaged } from "@/lib/api";

type Party = { id: string; label: string };
const PAGE_SIZE = 100;

const PARTY_SOURCES: { value: string; label: string; path: string }[] = [
  { value: "Customer", label: "مشتری", path: "/api/v1/customers" },
  { value: "Vendor", label: "تأمین‌کننده", path: "/api/v1/vendors" },
  { value: "BankAccount", label: "حساب بانکی", path: "/api/v1/bank-accounts" },
  { value: "CashAccount", label: "صندوق", path: "/api/v1/cash-accounts" },
];

function PartyStatementContent() {
  const params = useSearchParams();
  const [partyType, setPartyType] = useState(params.get("partyType") ?? "Customer");
  const [partyId, setPartyId] = useState(params.get("partyId") ?? "");
  const [partySearch, setPartySearch] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = PARTY_SOURCES.find((s) => s.value === partyType);
    if (!source) return;
    const q = new URLSearchParams({ page: "1", pageSize: "50" });
    if (partySearch.trim()) q.set("search", partySearch.trim());
    void apiGetPaged<Record<string, unknown>>(`${source.path}?${q.toString()}`).then((res) => {
      if (res.error) {
        setError(res.error);
        setParties([]);
        return;
      }
      setParties(
        (res.data?.items ?? []).map((r) => ({
          id: String(r.id ?? r.Id),
          label: `${String(r.code ?? r.Code ?? r.accountNumber ?? r.AccountNumber ?? "")} — ${String(r.name ?? r.Name ?? r.title ?? r.Title ?? "")}`,
        })),
      );
    });
  }, [partyType, partySearch]);

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    const label = parties.find((p) => p.id === partyId)?.label;
    const q = new URLSearchParams({ partyType, partyId, page: String(page), pageSize: String(PAGE_SIZE) });
    if (label) q.set("partyLabel", label);
    if (from) q.set("fromJalali", from);
    if (to) q.set("toJalali", to);
    const res = await apiGet<Record<string, unknown>>(`/api/v1/reports/party-statement?${q.toString()}`);
    if (res.error || !res.data) {
      setError(res.error ?? "دریافت صورت‌حساب ناموفق بود.");
      setLedger(null);
    } else {
      setError(null);
      setLedger(mapLedger(res.data));
    }
    setLoading(false);
  }, [partyType, partyId, from, to, page, parties]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      <div className="panel form-grid">
        <label>
          نوع طرف حساب
          <select
            value={partyType}
            onChange={(e) => {
              setPartyType(e.target.value);
              setPartyId("");
              setPage(1);
            }}
          >
            {PARTY_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          جستجو
          <input value={partySearch} onChange={(e) => setPartySearch(e.target.value)} placeholder="کد یا نام…" />
        </label>
        <label>
          طرف حساب
          <select
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">— انتخاب —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
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
      </div>
      {partyId ? (
        <LedgerView ledger={ledger} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading} hidePartyColumn />
      ) : (
        <p className="panel muted">طرف حساب را انتخاب کنید تا گردش تفصیلی شناور (مشتری، تأمین‌کننده، بانک، صندوق) نمایش داده شود.</p>
      )}
    </div>
  );
}

export default function PartyStatementPage() {
  return (
    <AppShell title="صورت‌حساب طرف حساب (تفصیلی شناور)">
      <Suspense fallback={<p className="muted">در حال بارگذاری…</p>}>
        <PartyStatementContent />
      </Suspense>
    </AppShell>
  );
}
