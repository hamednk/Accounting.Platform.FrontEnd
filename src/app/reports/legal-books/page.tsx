"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGet } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { journalKindFa } from "@/lib/labels";

type Entry = { journalId: string; documentNumber: string; documentDateJalali: string; description: string; kind: string; lines: { debit: number }[] };
type Book = { items: Entry[]; totalCount: number; totalDebit: number; totalCredit: number };
type Row = { id: string; number: string; date: string; description: string; kind: string; amount: number; lineCount: number };

/** دفاتر قانونی: روزنامه و کل — screen preview (paged) + print. */
export default function LegalBooksPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (from) q.set("fromJalali", from);
    if (to) q.set("toJalali", to);
    const res = await apiGet<Book>(`/api/v1/reports/journal-book?${q.toString()}`);
    if (res.error || !res.data) {
      setError(res.error ?? "دریافت دفتر ناموفق بود.");
      setRows([]);
    } else {
      setError(null);
      setRows(
        res.data.items.map((e) => ({
          id: e.journalId,
          number: e.documentNumber,
          date: e.documentDateJalali,
          description: e.description,
          kind: e.kind,
          amount: e.lines.reduce((s, l) => s + l.debit, 0),
          lineCount: e.lines.length,
        })),
      );
      setTotal(res.data.totalCount);
      setTotals({ debit: res.data.totalDebit, credit: res.data.totalCredit });
    }
    setLoading(false);
  }, [page, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const columns: GridColumn<Row>[] = [
    { key: "date", header: "تاریخ", ltr: true, render: (r) => r.date },
    { key: "num", header: "شماره سند", ltr: true, render: (r) => r.number },
    { key: "desc", header: "شرح", render: (r) => r.description },
    { key: "kind", header: "نوع", render: (r) => journalKindFa(r.kind) },
    { key: "lines", header: "ردیف‌ها", align: "end", render: (r) => r.lineCount },
    { key: "amt", header: "مبلغ", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.amount) },
    {
      key: "print",
      header: "چاپ",
      render: (r) => (
        <Link className="btn-ghost" href={`/print/journal/${r.id}`} target="_blank">
          سند
        </Link>
      ),
    },
  ];

  return (
    <AppShell title="دفاتر قانونی">
      <div className="stack">
        <div className="panel form-grid">
          <label>
            از تاریخ
            <JalaliDatePicker
              value={from}
              onChange={(v) => {
                setPage(1);
                setFrom(v);
              }}
            />
          </label>
          <label>
            تا تاریخ
            <JalaliDatePicker
              value={to}
              onChange={(v) => {
                setPage(1);
                setTo(v);
              }}
            />
          </label>
          <div className="page-actions" style={{ alignSelf: "end" }}>
            <Link className="btn-primary" href={`/print/journal-book?${qs.toString()}`} target="_blank">
              چاپ دفتر روزنامه
            </Link>
            <Link className="btn-secondary" href={`/print/ledger-book?${qs.toString()}`} target="_blank">
              چاپ دفتر کل
            </Link>
          </div>
        </div>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        <div className="panel stack">
          <p className="muted">
            جمع گردش بازه — بدهکار: <span className="ltr">{formatMoneyIrr(totals.debit)}</span> · بستانکار:{" "}
            <span className="ltr">{formatMoneyIrr(totals.credit)}</span>
          </p>
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="سند ثبت‌شده‌ای در این بازه نیست"
          />
        </div>
      </div>
    </AppShell>
  );
}
