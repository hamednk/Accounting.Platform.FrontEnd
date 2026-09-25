"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrintLayout, fetchAllPages, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { apiGet } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr } from "@/lib/format";
import { journalKindFa } from "@/lib/labels";

type Line = { accountCode: string; accountName: string; description: string; debit: number; credit: number };
type Entry = { journalId: string; documentNumber: string; documentDateJalali: string; description: string; kind: string; lines: Line[] };
type Book = { items: Entry[]; totalCount: number; totalDebit: number; totalCredit: number };

/** دفتر روزنامه — chronological legal journal book. */
function JournalBookPrint() {
  const params = useSearchParams();
  const { workspace, ready } = useWorkspace();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!workspace.companyId) {
      setError("شرکت انتخاب نشده است.");
      return;
    }
    void apiGet<Record<string, unknown>>(`/api/v1/companies/${workspace.companyId}`).then((c) => c.data && setCompany(mapCompany(c.data)));
    void fetchAllPages<Entry>(async (page) => {
      const q = new URLSearchParams({ page: String(page), pageSize: "200" });
      if (from) q.set("fromJalali", from);
      if (to) q.set("toJalali", to);
      const res = await apiGet<Book>(`/api/v1/reports/journal-book?${q.toString()}`);
      if (res.error || !res.data) return { error: res.error ?? "دریافت دفتر ناموفق بود." };
      if (page === 1) setTotals({ debit: res.data.totalDebit, credit: res.data.totalCredit });
      return { items: res.data.items, totalCount: res.data.totalCount };
    }).then((r) => ("error" in r ? setError(r.error) : setEntries(r.items)));
  }, [ready, workspace.companyId, from, to]);

  return (
    <PrintLayout
      title="دفتر روزنامه"
      company={company}
      loading={!entries && !error}
      error={error}
      orientation="landscape"
      meta={[{ label: "بازه", value: `${from ? formatJalaliDisplay(from) : "ابتدا"} تا ${to ? formatJalaliDisplay(to) : "امروز"}` }]}
    >
      <table className="print-table">
        <thead>
          <tr>
            <th>تاریخ</th>
            <th>شماره سند</th>
            <th>کد حساب</th>
            <th>شرح حساب</th>
            <th>شرح</th>
            <th className="num">بدهکار</th>
            <th className="num">بستانکار</th>
          </tr>
        </thead>
        <tbody>
          {(entries ?? []).map((e) => (
            <Fragment key={e.journalId}>
              <tr className="group-row">
                <td>{formatJalaliDisplay(e.documentDateJalali)}</td>
                <td className="ltr">{e.documentNumber}</td>
                <td colSpan={5}>
                  {e.description}
                  {e.kind !== "Normal" ? ` — ${journalKindFa(e.kind)}` : ""}
                </td>
              </tr>
              {e.lines.map((l, i) => (
                <tr key={`${e.journalId}-${i}`}>
                  <td />
                  <td />
                  <td className="ltr">{l.accountCode}</td>
                  <td>{l.accountName}</td>
                  <td>{l.description}</td>
                  <td className="num">{l.debit ? formatMoneyIrr(l.debit) : ""}</td>
                  <td className="num">{l.credit ? formatMoneyIrr(l.credit) : ""}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>جمع کل ({(entries ?? []).length} سند)</td>
            <td className="num">{formatMoneyIrr(totals.debit)}</td>
            <td className="num">{formatMoneyIrr(totals.credit)}</td>
          </tr>
        </tfoot>
      </table>
    </PrintLayout>
  );
}

export default function PrintJournalBookPage() {
  return (
    <Suspense fallback={null}>
      <JournalBookPrint />
    </Suspense>
  );
}
