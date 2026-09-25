"use client";

import Link from "next/link";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { formatMoneyIrr } from "@/lib/format";
import { partyTypeFa } from "@/lib/labels";

export type LedgerLine = {
  journalId: string;
  documentNumber: string;
  documentDateJalali: string;
  accountLabel: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  partyType: string | null;
};

export type Ledger = {
  title: string;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  items: LedgerLine[];
  totalCount: number;
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function mapLedger(r: Record<string, unknown>): Ledger {
  const items = ((r.items ?? r.Items ?? []) as Record<string, unknown>[]).map((i) => ({
    journalId: String(i.journalId ?? i.JournalId),
    documentNumber: String(i.documentNumber ?? i.DocumentNumber ?? ""),
    documentDateJalali: String(i.documentDateJalali ?? i.DocumentDateJalali ?? ""),
    accountLabel: String(i.accountLabel ?? i.AccountLabel ?? ""),
    description: String(i.description ?? i.Description ?? ""),
    debit: num(i.debit ?? i.Debit),
    credit: num(i.credit ?? i.Credit),
    runningBalance: num(i.runningBalance ?? i.RunningBalance),
    partyType: (i.partyType ?? i.PartyType ?? null) as string | null,
  }));
  return {
    title: String(r.title ?? r.Title ?? ""),
    openingBalance: num(r.openingBalance ?? r.OpeningBalance),
    periodDebit: num(r.periodDebit ?? r.PeriodDebit),
    periodCredit: num(r.periodCredit ?? r.PeriodCredit),
    closingBalance: num(r.closingBalance ?? r.ClosingBalance),
    items,
    totalCount: num(r.totalCount ?? r.TotalCount),
  };
}

/** Balance shown with تشخیص (بد/بس) per Iranian ledger convention. */
function balanceLabel(v: number): string {
  if (v === 0) return "۰";
  return `${formatMoneyIrr(Math.abs(v))} ${v > 0 ? "بد" : "بس"}`;
}

export function LedgerView({
  ledger,
  page,
  pageSize,
  onPageChange,
  loading,
  hidePartyColumn,
}: {
  ledger: Ledger | null;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  loading: boolean;
  hidePartyColumn?: boolean;
}) {
  const columns: GridColumn<LedgerLine>[] = [
    { key: "date", header: "تاریخ", ltr: true, render: (r) => r.documentDateJalali },
    {
      key: "doc",
      header: "شماره سند",
      ltr: true,
      render: (r) => <Link href={`/journals?id=${r.journalId}`}>{r.documentNumber}</Link>,
    },
    { key: "account", header: "حساب", render: (r) => r.accountLabel },
    { key: "desc", header: "شرح", render: (r) => r.description },
    ...(hidePartyColumn ? [] : [{ key: "party", header: "طرف حساب", render: (r: LedgerLine) => partyTypeFa(r.partyType) }]),
    { key: "debit", header: "بدهکار", align: "end", render: (r) => (r.debit ? formatMoneyIrr(r.debit) : "") },
    { key: "credit", header: "بستانکار", align: "end", render: (r) => (r.credit ? formatMoneyIrr(r.credit) : "") },
    { key: "balance", header: "مانده", align: "end", render: (r) => balanceLabel(r.runningBalance) },
  ];

  return (
    <div className="stack">
      {ledger ? (
        <div className="panel summary-row">
          <div>
            <span className="muted">عنوان</span>
            <strong>{ledger.title}</strong>
          </div>
          <div>
            <span className="muted">مانده ابتدای دوره</span>
            <strong>{balanceLabel(ledger.openingBalance)}</strong>
          </div>
          <div>
            <span className="muted">گردش بدهکار</span>
            <strong>{formatMoneyIrr(ledger.periodDebit)}</strong>
          </div>
          <div>
            <span className="muted">گردش بستانکار</span>
            <strong>{formatMoneyIrr(ledger.periodCredit)}</strong>
          </div>
          <div>
            <span className="muted">مانده پایان دوره</span>
            <strong>{balanceLabel(ledger.closingBalance)}</strong>
          </div>
        </div>
      ) : null}
      <div className="panel">
        <DataGrid
          columns={columns}
          rows={ledger?.items ?? []}
          totalCount={ledger?.totalCount ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          rowKey={(r) => `${r.journalId}-${r.accountLabel}-${r.debit}-${r.credit}-${r.runningBalance}`}
          loading={loading}
          emptyTitle="گردشی در این بازه وجود ندارد"
        />
      </div>
    </div>
  );
}
