"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrintLayout, fetchAllPages, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { apiGet } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr } from "@/lib/format";

type Row = { generalAccountId: string; accountCode: string; accountName: string; journalId: string | null; documentNumber: string | null; documentDateJalali: string; description: string; debit: number; credit: number; balance: number };
type Summary = { accountId: string; accountCode: string; accountName: string; openingBalance: number; debit: number; credit: number; closingBalance: number };
type Book = { accounts: Summary[]; items: Row[]; totalCount: number };

function bal(v: number) {
  if (v === 0) return "۰";
  return `${formatMoneyIrr(Math.abs(v))} ${v > 0 ? "بد" : "بس"}`;
}

/** دفتر کل — one section per کل account with running balance. */
function LedgerBookPrint() {
  const params = useSearchParams();
  const { workspace, ready } = useWorkspace();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const accountId = params.get("accountId") ?? "";
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!workspace.companyId) {
      setError("شرکت انتخاب نشده است.");
      return;
    }
    void apiGet<Record<string, unknown>>(`/api/v1/companies/${workspace.companyId}`).then((c) => c.data && setCompany(mapCompany(c.data)));
    void fetchAllPages<Row>(async (page) => {
      const q = new URLSearchParams({ page: String(page), pageSize: "1000" });
      if (from) q.set("fromJalali", from);
      if (to) q.set("toJalali", to);
      if (accountId) q.set("accountId", accountId);
      const res = await apiGet<Book>(`/api/v1/reports/general-ledger-book?${q.toString()}`);
      if (res.error || !res.data) return { error: res.error ?? "دریافت دفتر ناموفق بود." };
      if (page === 1) setSummaries(res.data.accounts);
      return { items: res.data.items, totalCount: res.data.totalCount };
    }).then((r) => ("error" in r ? setError(r.error) : setRows(r.items)));
  }, [ready, workspace.companyId, from, to, accountId]);

  return (
    <PrintLayout
      title="دفتر کل"
      company={company}
      loading={!rows && !error}
      error={error}
      meta={[{ label: "بازه", value: `${from ? formatJalaliDisplay(from) : "ابتدا"} تا ${to ? formatJalaliDisplay(to) : "امروز"}` }]}
    >
      {summaries.map((s) => {
        const accountRows = (rows ?? []).filter((r) => r.generalAccountId === s.accountId);
        return (
          <Fragment key={s.accountId}>
            <h2 className="section-title" style={{ marginTop: "1rem" }}>
              <span className="ltr">{s.accountCode}</span> — {s.accountName}
            </h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>شماره سند</th>
                  <th>شرح</th>
                  <th className="num">بدهکار</th>
                  <th className="num">بستانکار</th>
                  <th className="num">مانده</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.map((r, i) => (
                  <tr key={`${s.accountId}-${i}`}>
                    <td>{r.documentDateJalali ? formatJalaliDisplay(r.documentDateJalali) : ""}</td>
                    <td className="ltr">{r.documentNumber ?? ""}</td>
                    <td>{r.description}</td>
                    <td className="num">{r.debit ? formatMoneyIrr(r.debit) : ""}</td>
                    <td className="num">{r.credit ? formatMoneyIrr(r.credit) : ""}</td>
                    <td className="num">{bal(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>جمع گردش / مانده پایان</td>
                  <td className="num">{formatMoneyIrr(s.debit)}</td>
                  <td className="num">{formatMoneyIrr(s.credit)}</td>
                  <td className="num">{bal(s.closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </Fragment>
        );
      })}
    </PrintLayout>
  );
}

export default function PrintLedgerBookPage() {
  return (
    <Suspense fallback={null}>
      <LedgerBookPrint />
    </Suspense>
  );
}
