"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { SendToAssistant } from "@/components/ai/SendToAssistant";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { statusFa } from "@/lib/labels";
import { StatusChip } from "@/components/ui/StatusChip";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";

type Named = { id: string; code: string; name: string };
type BankAccountRow = Named & {
  bankName: string;
  iban: string;
  accountNumber: string;
  glAccountId: string;
  isActive: boolean;
};
type Cheque = {
  id: string;
  number: string;
  sayadNumber: string;
  issueDateJalali: string;
  dueDateJalali: string;
  amount: number;
  chequeStatus: string;
};

function mapNamed(raw: Record<string, unknown>): Named {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

function mapBank(raw: Record<string, unknown>): BankAccountRow {
  return {
    ...mapNamed(raw),
    bankName: String(raw.bankName ?? raw.BankName ?? ""),
    iban: String(raw.iban ?? raw.Iban ?? ""),
    accountNumber: String(raw.accountNumber ?? raw.AccountNumber ?? ""),
    glAccountId: String(raw.glAccountId ?? raw.GlAccountId ?? ""),
    isActive: (raw.isActive ?? raw.IsActive ?? true) !== false,
  };
}

export default function TreasuryPage() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Cheque[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Named[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [cashCode, setCashCode] = useState("CASH01");
  const [cashName, setCashName] = useState("صندوق مرکزی");
  const [cashGl, setCashGl] = useState("");
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState("BNK01");
  const [bankName, setBankName] = useState("حساب جاری");
  const [bankBankName, setBankBankName] = useState("بانک ملی");
  const [accountNumber, setAccountNumber] = useState("0100000000");
  const [iban, setIban] = useState("IR000000000000000000000001");
  const [bankGl, setBankGl] = useState("");
  const [bankActive, setBankActive] = useState(true);

  const [chequeNumber, setChequeNumber] = useState("1001");
  const [sayad, setSayad] = useState("SAYAD1001");
  const [issueDate, setIssueDate] = useState("1405/01/10");
  const [dueDate, setDueDate] = useState("1405/02/10");
  const [amount, setAmount] = useState("5000000");
  const [bankAccountId, setBankAccountId] = useState("");
  const [chequeDesc, setChequeDesc] = useState("چک دریافتنی");
  const [clearBankGl, setClearBankGl] = useState("");
  const [clearingGl, setClearingGl] = useState("");

  const loadLookups = useCallback(async () => {
    const [accRes, cashRes, bankRes] = await Promise.all([
      apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true"),
      apiGetPaged<Record<string, unknown>>("/api/v1/cash-accounts?page=1&pageSize=100"),
      apiGetPaged<Record<string, unknown>>("/api/v1/bank-accounts?page=1&pageSize=100"),
    ]);
    const nextAcc = (accRes.data?.items ?? []).map(mapNamed);
    const nextCash = (cashRes.data?.items ?? []).map(mapNamed);
    const nextBank = (bankRes.data?.items ?? []).map(mapBank);
    setAccounts(nextAcc);
    setCashAccounts(nextCash);
    setBankAccounts(nextBank);
    const cashGlDefault = nextAcc.find((a) => a.code.startsWith("11"))?.id ?? nextAcc[0]?.id ?? "";
    setCashGl((prev) => prev || cashGlDefault);
    setBankGl((prev) => prev || cashGlDefault);
    setClearBankGl((prev) => prev || cashGlDefault);
    setClearingGl((prev) => prev || (nextAcc.find((a) => a.code.startsWith("12"))?.id ?? nextAcc[0]?.id ?? ""));
    setBankAccountId((prev) => prev || nextBank[0]?.id || "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/cheques?page=${page}&pageSize=20`);
    if (res.error) {
      setError(res.error);
      setRows([]);
      setTotal(0);
    } else {
      setError(null);
      setRows(
        (res.data?.items ?? []).map((r) => ({
          id: String(r.id ?? r.Id),
          number: String(r.number ?? r.Number ?? ""),
          sayadNumber: String(r.sayadNumber ?? r.SayadNumber ?? ""),
          issueDateJalali: String(r.issueDateJalali ?? r.IssueDateJalali ?? ""),
          dueDateJalali: String(r.dueDateJalali ?? r.DueDateJalali ?? ""),
          amount: Number(r.amount ?? r.Amount ?? 0),
          chequeStatus: String(r.chequeStatus ?? r.ChequeStatus ?? ""),
        })),
      );
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
    void loadLookups();
  }, [load, loadLookups]);

  function resetBankForm() {
    setEditingBankId(null);
    setBankCode("BNK01");
    setBankName("حساب جاری");
    setBankBankName("بانک ملی");
    setAccountNumber("0100000000");
    setIban("IR000000000000000000000001");
    setBankActive(true);
  }

  async function createCash(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend("/api/v1/cash-accounts", "POST", {
      code: cashCode,
      name: cashName,
      glAccountId: cashGl,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("صندوق ایجاد شد.");
    await loadLookups();
  }

  async function saveBank(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (editingBankId) {
      const res = await apiSend(`/api/v1/bank-accounts/${editingBankId}`, "PUT", {
        name: bankName,
        bankName: bankBankName,
        accountNumber,
        iban,
        glAccountId: bankGl,
        isActive: bankActive,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("حساب بانکی ویرایش شد.");
    } else {
      const res = await apiSend("/api/v1/bank-accounts", "POST", {
        code: bankCode,
        name: bankName,
        bankName: bankBankName,
        accountNumber,
        iban,
        glAccountId: bankGl,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("حساب بانکی ایجاد شد.");
    }
    resetBankForm();
    await loadLookups();
  }

  async function registerCheque(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend("/api/v1/cheques", "POST", {
      number: chequeNumber,
      sayadNumber: sayad,
      issueDateJalali: issueDate,
      dueDateJalali: dueDate,
      amount: Number(amount),
      bankAccountId: bankAccountId || null,
      counterpartyId: null,
      description: chequeDesc,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("چک ثبت شد.");
    await load();
  }

  async function clearCheque(id: string) {
    if (!workspace.periodId) {
      setError("دوره مالی را انتخاب کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(
      "/api/v1/cheques/clear",
      "POST",
      {
        instrumentId: id,
        fiscalPeriodId: workspace.periodId,
        clearDateJalali: dueDate,
        bankGlAccountId: clearBankGl,
        clearingAccountId: clearingGl,
      },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("وصول چک ثبت شد.");
    await load();
  }

  const columns: GridColumn<Cheque>[] = [
    { key: "num", header: "شماره", ltr: true, render: (r) => r.number },
    { key: "sayad", header: "صیاد", ltr: true, render: (r) => r.sayadNumber },
    { key: "issue", header: "صدور", ltr: true, render: (r) => r.issueDateJalali },
    { key: "due", header: "سررسید", ltr: true, render: (r) => r.dueDateJalali },
    { key: "amt", header: "مبلغ", align: "end", ltr: true, render: (r) => formatMoneyIrr(r.amount) },
    { key: "st", header: "وضعیت", render: (r) => <StatusChip status={r.chequeStatus} /> },
    {
      key: "act",
      header: "عملیات",
      render: (r) => (
        <div className="page-actions">
          {r.chequeStatus !== "Cleared" && r.chequeStatus !== "Paid" ? (
            <button type="button" className="btn-primary" onClick={() => void clearCheque(r.id)}>
              وصول
            </button>
          ) : null}
          <Link className="btn-ghost" href={`/print/cheque/${r.id}`} target="_blank">
            چاپ
          </Link>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="خزانه" actions={<SendToAssistant title="خزانه" prompt="وضعیت چک‌ها را خلاصه کن و سررسیدهای نزدیک را بگو" data={rows.slice(0, 40)} />}>
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        <div className="kpi-grid">
          <section className="panel stack">
            <h2 style={{ margin: 0, fontSize: "1rem" }}>صندوق</h2>
            <p className="muted">تعداد: {cashAccounts.length}</p>
            <form className="form-grid" onSubmit={createCash}>
              <label>
                کد
                <input className="ltr" value={cashCode} onChange={(e) => setCashCode(e.target.value)} required />
              </label>
              <label>
                نام
                <input value={cashName} onChange={(e) => setCashName(e.target.value)} required />
              </label>
              <label>
                حساب دفترکل
                <select value={cashGl} onChange={(e) => setCashGl(e.target.value)} required>
                  <option value="">انتخاب…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-secondary">
                  ایجاد صندوق
                </button>
              </div>
            </form>
          </section>

          <section className="panel stack">
            <h2 style={{ margin: 0, fontSize: "1rem" }}>{editingBankId ? `ویرایش حساب بانکی ${bankCode}` : "حساب بانکی"}</h2>
            <p className="muted">تعداد: {bankAccounts.length}</p>
            <form className="form-grid" onSubmit={saveBank}>
              <label>
                کد
                <input className="ltr" value={bankCode} onChange={(e) => setBankCode(e.target.value)} required disabled={!!editingBankId} />
              </label>
              <label>
                نام حساب
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} required />
              </label>
              <label>
                بانک
                <input value={bankBankName} onChange={(e) => setBankBankName(e.target.value)} required />
              </label>
              <label>
                شماره حساب
                <input className="ltr" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
              </label>
              <label>
                شبا
                <input className="ltr" value={iban} onChange={(e) => setIban(e.target.value)} required />
              </label>
              <label>
                حساب دفترکل
                <select value={bankGl} onChange={(e) => setBankGl(e.target.value)} required>
                  <option value="">انتخاب…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              {editingBankId ? (
                <label>
                  <span>
                    <input type="checkbox" checked={bankActive} onChange={(e) => setBankActive(e.target.checked)} /> فعال
                  </span>
                </label>
              ) : null}
              <div className="page-actions" style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-secondary">
                  {editingBankId ? "ذخیره" : "ایجاد حساب بانکی"}
                </button>
                {editingBankId ? (
                  <button type="button" className="btn-ghost" onClick={resetBankForm}>
                    انصراف
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>

        <div className="panel">
          <h2 className="section-title">حساب‌های بانکی</h2>
          <DataGrid
            columns={[
              { key: "code", header: "کد", ltr: true, render: (r: BankAccountRow) => r.code },
              { key: "name", header: "نام", render: (r: BankAccountRow) => r.name },
              { key: "bank", header: "بانک", render: (r: BankAccountRow) => r.bankName },
              { key: "iban", header: "شبا", ltr: true, render: (r: BankAccountRow) => r.iban },
              { key: "st", header: "وضعیت", render: (r: BankAccountRow) => (r.isActive ? "فعال" : "غیرفعال") },
              {
                key: "act",
                header: "اقدام",
                render: (r: BankAccountRow) => (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setEditingBankId(r.id);
                        setBankCode(r.code);
                        setBankName(r.name);
                        setBankBankName(r.bankName);
                        setAccountNumber(r.accountNumber);
                        setIban(r.iban);
                        setBankGl(r.glAccountId);
                        setBankActive(r.isActive);
                      }}
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        void (async () => {
                          const res = await apiSend(`/api/v1/bank-accounts/${r.id}`, "PUT", {
                            name: r.name,
                            bankName: r.bankName,
                            accountNumber: r.accountNumber,
                            iban: r.iban,
                            glAccountId: r.glAccountId,
                            isActive: !r.isActive,
                          });
                          if (res.error) setError(res.error);
                          else {
                            setOk(r.isActive ? "حساب بانکی غیرفعال شد." : "حساب بانکی فعال شد.");
                            await loadLookups();
                          }
                        })();
                      }}
                    >
                      {r.isActive ? "غیرفعال" : "فعال"}
                    </button>
                    <ConfirmAction
                      title="حذف حساب بانکی"
                      consequences={[`حساب ${r.code} حذف می‌شود.`, "اگر چک یا مغایرت بانکی داشته باشد حذف مجاز نیست."]}
                      reference={r.code}
                      confirmLabel="حذف"
                      onConfirm={async () => {
                        const res = await apiSend(`/api/v1/bank-accounts/${r.id}`, "DELETE");
                        if (res.error) throw new Error(res.error);
                        setOk("حساب بانکی حذف شد.");
                        if (editingBankId === r.id) resetBankForm();
                        await loadLookups();
                      }}
                    >
                      {(open) => (
                        <button type="button" className="btn-danger btn-sm" onClick={open}>
                          حذف
                        </button>
                      )}
                    </ConfirmAction>
                  </div>
                ),
              },
            ]}
            rows={bankAccounts}
            totalCount={bankAccounts.length}
            page={1}
            pageSize={100}
            onPageChange={() => undefined}
            rowKey={(r) => r.id}
            emptyTitle="حساب بانکی ثبت نشده"
          />
        </div>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>ثبت چک صیاد</h2>
          <form className="form-grid" onSubmit={registerCheque}>
            <label>
              شماره چک
              <input className="ltr" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} required />
            </label>
            <label>
              شناسه صیاد
              <input className="ltr" value={sayad} onChange={(e) => setSayad(e.target.value)} required />
            </label>
            <label>
              تاریخ صدور
              <JalaliDatePicker value={issueDate} onChange={setIssueDate} required />
            </label>
            <label>
              سررسید
              <JalaliDatePicker value={dueDate} onChange={setDueDate} required />
            </label>
            <label>
              مبلغ
              <input className="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>
              حساب بانکی مرتبط
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                <option value="">اختیاری</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              شرح
              <textarea className="field-control" rows={2} value={chequeDesc} onChange={(e) => setChequeDesc(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                ثبت چک
              </button>
            </div>
          </form>
          <p className="muted">حساب‌های پیش‌فرض برای وصول چک:</p>
          <div className="form-grid">
            <label>
              حساب بانک (بدهکار)
              <select value={clearBankGl} onChange={(e) => setClearBankGl(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب طرف (بستانکار)
              <select value={clearingGl} onChange={(e) => setClearingGl(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div className="panel">
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="چکی ثبت نشده است"
            savedViewKey="treasury-cheques"
          />
        </div>
      </div>
    </AppShell>
  );
}
