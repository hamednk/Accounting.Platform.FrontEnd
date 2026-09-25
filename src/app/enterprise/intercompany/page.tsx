"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged, apiSend } from "@/lib/api";

type Named = { id: string; code: string; name: string };

export default function IntercompanyPage() {
  const { workspace, companies } = useWorkspace();
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ruleId, setRuleId] = useState("");
  const [fromCompanyId, setFromCompanyId] = useState("");
  const [toCompanyId, setToCompanyId] = useState("");
  const [fromDueTo, setFromDueTo] = useState("");
  const [toDueFrom, setToDueFrom] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [dateJalali, setDateJalali] = useState("1405/01/15");
  const [fromExpense, setFromExpense] = useState("");
  const [toIncome, setToIncome] = useState("");

  useEffect(() => {
    void apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true").then((res) => {
      const list = (res.data?.items ?? []).map((r) => ({
        id: String(r.id ?? r.Id),
        code: String(r.code ?? r.Code ?? ""),
        name: String(r.name ?? r.Name ?? ""),
      }));
      setAccounts(list);
      if (list[0]) {
        setFromDueTo(list.find((a) => a.code.startsWith("21"))?.id ?? list[0].id);
        setToDueFrom(list.find((a) => a.code.startsWith("12"))?.id ?? list[0].id);
        setFromExpense(list.find((a) => a.code.startsWith("52"))?.id ?? list[0].id);
        setToIncome(list.find((a) => a.code.startsWith("41"))?.id ?? list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    setFromCompanyId((prev) => prev || companies[0]?.id || "");
    setToCompanyId((prev) => prev || companies[1]?.id || companies[0]?.id || "");
  }, [companies]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/intercompany/rules", "POST", {
      code: `IC-${Date.now().toString().slice(-4)}`,
      name: "قاعده بین‌شرکتی",
      fromCompanyId,
      toCompanyId,
      fromDueToAccountId: fromDueTo,
      toDueFromAccountId: toDueFrom,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setRuleId(String(res.data.id ?? res.data.Id));
    setOk("قاعده بین‌شرکتی ایجاد شد.");
  }

  async function postTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleId || !workspace.periodId) {
      setError("قاعده و دوره مالی لازم است.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      "/api/v1/intercompany/transfers",
      "POST",
      {
        ruleId,
        number: `ICT-${Date.now().toString().slice(-4)}`,
        documentDateJalali: dateJalali,
        amount: Number(amount),
        fromFiscalPeriodId: workspace.periodId,
        toFiscalPeriodId: workspace.periodId,
        fromExpenseOrAssetAccountId: fromExpense,
        toIncomeOrAssetAccountId: toIncome,
        correlationId: crypto.randomUUID(),
      },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("انتقال بین‌شرکتی ثبت شد.");
  }

  return (
    <AppShell title="بین‌شرکتی">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>قاعده</h2>
          <form className="form-grid" onSubmit={createRule}>
            <label>
              از شرکت
              <select value={fromCompanyId} onChange={(e) => setFromCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              به شرکت
              <select value={toCompanyId} onChange={(e) => setToCompanyId(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب بدهی مبدأ
              <select value={fromDueTo} onChange={(e) => setFromDueTo(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب دریافتنی مقصد
              <select value={toDueFrom} onChange={(e) => setToDueFrom(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد قاعده
              </button>
            </div>
          </form>
        </section>
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>انتقال</h2>
          <form className="form-grid" onSubmit={postTransfer}>
            <label>
              مبلغ
              <input className="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label>
              تاریخ
              <JalaliDatePicker value={dateJalali} onChange={setDateJalali} />
            </label>
            <label>
              حساب هزینه مبدأ
              <select value={fromExpense} onChange={(e) => setFromExpense(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب درآمد مقصد
              <select value={toIncome} onChange={(e) => setToIncome(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ثبت انتقال
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
