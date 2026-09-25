"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrintLayout, SignatureRow, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { apiGet } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr } from "@/lib/format";

type Line = { accountId: string; code: string; name: string; debit: number; credit: number; amount: number };
type Statement = { sections: { title: string; lines: Line[] }[]; totalLeft: number; totalRight: number; reconcilesToLedger: boolean };

function TrialBalancePrint() {
  const params = useSearchParams();
  const { workspace, ready } = useWorkspace();
  const periodId = params.get("periodId") ?? workspace.periodId ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const companyId = workspace.companyId;
    if (!companyId) {
      setError("شرکت انتخاب نشده است.");
      return;
    }
    const q = new URLSearchParams({ companyId });
    if (periodId && !from && !to) q.set("fiscalPeriodId", periodId);
    if (from) q.set("fromJalali", from);
    if (to) q.set("toJalali", to);
    void Promise.all([
      apiGet<Record<string, unknown>>(`/api/v1/companies/${companyId}`),
      apiGet<Statement>(`/api/v1/reports/trial-balance-v2?${q.toString()}`),
    ]).then(([c, tb]) => {
      if (c.data) setCompany(mapCompany(c.data));
      if (tb.error || !tb.data) setError(tb.error ?? "تراز دریافت نشد.");
      else setData(tb.data);
    });
  }, [ready, workspace.companyId, periodId, from, to]);

  const lines = data?.sections.flatMap((s) => s.lines) ?? [];
  const range = from || to ? `${from ? formatJalaliDisplay(from) : "ابتدا"} تا ${to ? formatJalaliDisplay(to) : "امروز"}` : workspace.periodName ?? "دوره جاری";

  return (
    <PrintLayout
      title="تراز آزمایشی"
      company={company}
      loading={!data && !error}
      error={error}
      meta={[{ label: "بازه", value: range }]}
      footer={<SignatureRow labels={["تهیه‌کننده", "مدیر مالی"]} />}
    >
      <table className="print-table">
        <thead>
          <tr>
            <th>کد حساب</th>
            <th>نام حساب</th>
            <th className="num">گردش بدهکار</th>
            <th className="num">گردش بستانکار</th>
            <th className="num">مانده بدهکار</th>
            <th className="num">مانده بستانکار</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.accountId}>
              <td className="ltr">{l.code}</td>
              <td>{l.name}</td>
              <td className="num">{formatMoneyIrr(l.debit)}</td>
              <td className="num">{formatMoneyIrr(l.credit)}</td>
              <td className="num">{l.amount > 0 ? formatMoneyIrr(l.amount) : ""}</td>
              <td className="num">{l.amount < 0 ? formatMoneyIrr(-l.amount) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>جمع {data && !data.reconcilesToLedger ? "(نا تراز!)" : ""}</td>
            <td className="num">{formatMoneyIrr(data?.totalLeft ?? 0)}</td>
            <td className="num">{formatMoneyIrr(data?.totalRight ?? 0)}</td>
            <td className="num">{formatMoneyIrr(lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0))}</td>
            <td className="num">{formatMoneyIrr(-lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </PrintLayout>
  );
}

export default function PrintTrialBalancePage() {
  return (
    <Suspense fallback={null}>
      <TrialBalancePrint />
    </Suspense>
  );
}
