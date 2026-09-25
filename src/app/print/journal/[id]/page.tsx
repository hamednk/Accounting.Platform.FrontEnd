"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PrintLayout, SignatureRow, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { apiGet } from "@/lib/api";
import { formatMoneyIrr, formatJalaliDisplay } from "@/lib/format";
import { journalKindFa, statusFa } from "@/lib/labels";
import { rialsInWords } from "@/lib/numberToWords";

type Line = { lineNumber: number; accountCode: string; accountName: string; parentAccount: string | null; description: string; debit: number; credit: number; party: string | null };
type Journal = { documentNumber: string; documentDateJalali: string; description: string; status: string; kind: string; totalDebit: number; totalCredit: number; createdBy: string; postedBy: string | null };

export default function PrintJournalPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<{ company: Record<string, unknown>; journal: Journal; lines: Line[] }>(`/api/v1/print/journal-batches/${id}`).then((res) => {
      if (res.error || !res.data) {
        setError(res.error ?? "سند یافت نشد.");
        return;
      }
      setCompany(mapCompany(res.data.company));
      setJournal(res.data.journal);
      setLines(res.data.lines);
    });
  }, [id]);

  return (
    <PrintLayout
      title="سند حسابداری"
      company={company}
      loading={!journal && !error}
      error={error}
      meta={
        journal
          ? [
              { label: "شماره سند", value: journal.documentNumber, ltr: true },
              { label: "تاریخ", value: formatJalaliDisplay(journal.documentDateJalali) },
              { label: "نوع", value: journalKindFa(journal.kind) },
              { label: "وضعیت", value: statusFa(journal.status) },
            ]
          : []
      }
      footer={<SignatureRow labels={["تنظیم‌کننده", "بررسی‌کننده", "تأییدکننده", "مدیر مالی"]} />}
    >
      {journal ? (
        <>
          <p>
            <strong>شرح سند: </strong>
            {journal.description}
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>کد حساب</th>
                <th>شرح حساب</th>
                <th>طرف حساب (تفصیلی)</th>
                <th>شرح ردیف</th>
                <th className="num">بدهکار (ریال)</th>
                <th className="num">بستانکار (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.lineNumber}>
                  <td>{l.lineNumber}</td>
                  <td className="ltr">{l.accountCode}</td>
                  <td>
                    {l.accountName}
                    {l.parentAccount ? <div className="muted">{l.parentAccount}</div> : null}
                  </td>
                  <td>{l.party ?? ""}</td>
                  <td>{l.description}</td>
                  <td className="num">{l.debit ? formatMoneyIrr(l.debit) : ""}</td>
                  <td className="num">{l.credit ? formatMoneyIrr(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>جمع</td>
                <td className="num">{formatMoneyIrr(journal.totalDebit)}</td>
                <td className="num">{formatMoneyIrr(journal.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="print-words">مبلغ به حروف: {rialsInWords(journal.totalDebit)}</p>
          <p className="muted">
            تنظیم: {journal.createdBy}
            {journal.postedBy ? ` · ثبت نهایی: ${journal.postedBy}` : ""}
          </p>
        </>
      ) : null}
    </PrintLayout>
  );
}
