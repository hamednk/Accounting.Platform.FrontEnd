"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { SendToAssistant } from "@/components/ai/SendToAssistant";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ErrorState, LoadingState } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGet } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";

type RawLine = { code?: string; name?: string; accountCode?: string; accountName?: string; debit?: number; credit?: number; amount: number };
type Statement = {
  reportType?: string;
  reconcilesToLedger?: boolean;
  totalLeft?: number;
  totalRight?: number;
  sections?: { title: string; lines: RawLine[] }[];
};

export function FinancialReportPage({
  title,
  endpoint,
  printPath,
  showTurnover,
}: {
  title: string;
  endpoint: string;
  /** Print route (e.g. /print/trial-balance); receives periodId/from/to. */
  printPath?: string;
  /** Show debit/credit turnover columns (trial balance). */
  showTurnover?: boolean;
}) {
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Statement | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function run() {
    if (!workspace.companyId) {
      setError("ابتدا شرکت را از نوار بالا انتخاب کنید.");
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ companyId: workspace.companyId });
    if (from || to) {
      if (from) qs.set("fromJalali", from);
      if (to) qs.set("toJalali", to);
    } else if (workspace.periodId) qs.set("fiscalPeriodId", workspace.periodId);
    const res = await apiGet<Statement>(`${endpoint}?${qs}`);
    if (res.error) setError(res.error);
    else setData(res.data ?? null);
    setLoading(false);
  }

  const printQs = new URLSearchParams();
  if (from) printQs.set("from", from);
  if (to) printQs.set("to", to);
  if (!from && !to && workspace.periodId) printQs.set("periodId", workspace.periodId);

  return (
    <AppShell title={title} actions={<SendToAssistant title={title} prompt={`گزارش «${title}» را تحلیل کن و نکات مهم، نسبت‌ها و ریسک‌ها را بگو`} data={data} />}>
      <div className="stack">
        <div className="panel form-grid">
          <div>
            <strong>شرکت:</strong> {workspace.companyName ?? "—"}
          </div>
          <div>
            <strong>دوره:</strong> {from || to ? "بازه دلخواه" : workspace.periodName ?? "همه / انتخاب‌نشده"}
          </div>
          <label>
            از تاریخ (اختیاری)
            <JalaliDatePicker value={from} onChange={setFrom} />
          </label>
          <label>
            تا تاریخ (اختیاری)
            <JalaliDatePicker value={to} onChange={setTo} />
          </label>
          <div className="page-actions" style={{ alignSelf: "end" }}>
            <button type="button" className="btn-primary" onClick={() => void run()} disabled={loading}>
              اجرای گزارش
            </button>
            {printPath ? (
              <Link className="btn-ghost" href={`${printPath}?${printQs.toString()}`} target="_blank">
                چاپ
              </Link>
            ) : null}
          </div>
        </div>
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}
        {data ? (
          <div className="panel stack">
            {typeof data.reconcilesToLedger === "boolean" ? (
              <p>
                آشتی با دفترکل: <strong>{data.reconcilesToLedger ? "بله" : "خیر"}</strong>
              </p>
            ) : null}
            {(data.sections ?? []).map((s) => (
              <div key={s.title}>
                <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>{s.title}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>کد</th>
                        <th>نام</th>
                        {showTurnover ? <th style={{ textAlign: "end" }}>بدهکار</th> : null}
                        {showTurnover ? <th style={{ textAlign: "end" }}>بستانکار</th> : null}
                        <th style={{ textAlign: "end" }}>{showTurnover ? "مانده" : "مبلغ"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lines.map((l, i) => {
                        const code = l.code ?? l.accountCode ?? "";
                        return (
                          <tr key={`${s.title}-${code}-${i}`}>
                            <td className="ltr">{code}</td>
                            <td>{l.name ?? l.accountName ?? ""}</td>
                            {showTurnover ? (
                              <td className="ltr" style={{ textAlign: "end" }}>
                                {formatMoneyIrr(l.debit ?? 0)}
                              </td>
                            ) : null}
                            {showTurnover ? (
                              <td className="ltr" style={{ textAlign: "end" }}>
                                {formatMoneyIrr(l.credit ?? 0)}
                              </td>
                            ) : null}
                            <td className="ltr" style={{ textAlign: "end" }}>
                              {formatMoneyIrr(l.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
