"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";

export default function ConsolidationPage() {
  const { workspace } = useWorkspace();
  const [code, setCode] = useState("CONS01");
  const [assetBalance, setAssetBalance] = useState("100000000");
  const [elim, setElim] = useState("0");
  const [runId, setRunId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function createRun(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.companyId || !workspace.periodId) {
      setError("شرکت و دوره را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/consolidations", "POST", {
      code,
      parentCompanyId: workspace.companyId,
      fiscalPeriodId: workspace.periodId,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setRunId(String(res.data.id ?? res.data.Id));
    setOk("اجرای تلفیق ایجاد شد.");
  }

  async function calculate() {
    if (!runId || !workspace.companyId) {
      setError("ابتدا اجرا را بسازید.");
      return;
    }
    setOk(null);
    const res = await apiSend<Record<string, unknown>>(`/api/v1/consolidations/${runId}/calculate`, "POST", {
      companyAssets: [{ companyId: workspace.companyId, assetBalance: Number(assetBalance) }],
      intercompanyEliminations: Number(elim),
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    const consolidated = Number(res.data.consolidatedAssets ?? res.data.ConsolidatedAssets ?? 0);
    setResult(formatMoneyIrr(consolidated));
    setOk("محاسبه تلفیق انجام شد.");
  }

  async function close() {
    if (!runId) {
      setError("اجرایی انتخاب نشده.");
      return;
    }
    setOk(null);
    const res = await apiSend(`/api/v1/consolidations/${runId}/close`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("اجرای تلفیق بسته شد.");
  }

  return (
    <AppShell title="تلفیق">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <section className="panel stack">
          <form className="form-grid" onSubmit={createRun}>
            <label>
              کد اجرا
              <input className="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد اجرا
              </button>
            </div>
          </form>
          <div className="form-grid">
            <label>
              مانده دارایی شرکت والد
              <input className="ltr" value={assetBalance} onChange={(e) => setAssetBalance(e.target.value)} />
            </label>
            <label>
              حذف بین‌شرکتی
              <input className="ltr" value={elim} onChange={(e) => setElim(e.target.value)} />
            </label>
          </div>
          <div className="page-actions">
            <button type="button" className="btn-primary" onClick={() => void calculate()}>
              محاسبه
            </button>
            <button type="button" className="btn-danger" onClick={() => void close()}>
              بستن
            </button>
          </div>
          {result ? (
            <p>
              دارایی تلفیقی: <span className="ltr">{result}</span>
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
