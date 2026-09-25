"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiDownload, apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { statusFa } from "@/lib/labels";
import { StatusChip } from "@/components/ui/StatusChip";

type EmployeeRow = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  iban: string;
  isActive: boolean;
};

type RunRow = {
  id: string;
  code: string;
  status: string;
  totalGross: number;
  totalNet: number;
};

type PayslipRow = {
  id: string;
  employeeCode: string;
  employeeName: string;
  gross: number;
  net: number;
  incomeTax: number;
  employeeInsurance: number;
};

type Named = { id: string; code: string; name: string };

function mapEmployee(raw: Record<string, unknown>): EmployeeRow {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    firstName: String(raw.firstName ?? raw.FirstName ?? ""),
    lastName: String(raw.lastName ?? raw.LastName ?? ""),
    nationalId: String(raw.nationalId ?? raw.NationalId ?? ""),
    iban: String(raw.iban ?? raw.Iban ?? ""),
    isActive: Boolean(raw.isActive ?? raw.IsActive ?? true),
  };
}

export default function PayrollPage() {
  const { workspace } = useWorkspace();
  const [empPage, setEmpPage] = useState(1);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [empTotal, setEmpTotal] = useState(0);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [accounts, setAccounts] = useState<Named[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [code, setCode] = useState("E001");
  const [firstName, setFirstName] = useState("علی");
  const [lastName, setLastName] = useState("رضایی");
  const [nationalId, setNationalId] = useState("0012345678");
  const [iban, setIban] = useState("IR120170000000123456789001");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empActive, setEmpActive] = useState(true);
  const [salary, setSalary] = useState("20000000");
  const [jalaliYear, setJalaliYear] = useState(1405);
  const [jalaliMonth, setJalaliMonth] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [runId, setRunId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [netPayAccountId, setNetPayAccountId] = useState("");
  const [empInsAccountId, setEmpInsAccountId] = useState("");
  const [erInsAccountId, setErInsAccountId] = useState("");
  const [taxAccountId, setTaxAccountId] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runStatus, setRunStatus] = useState("");
  const [runCode, setRunCode] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(empPage), pageSize: "20" });
    if (empSearch) qs.set("search", empSearch);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/payroll/employees?${qs}`);
    if (res.error) {
      setError(res.error);
      setEmployees([]);
      setEmpTotal(0);
    } else {
      setError(null);
      const items = (res.data?.items ?? []).map(mapEmployee);
      setEmployees(items);
      setEmpTotal(res.data?.totalCount ?? 0);
      setSelectedEmployeeId((prev) => prev || items[0]?.id || "");
    }
    setLoading(false);
  }, [empPage, empSearch]);

  const loadRuns = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(runsPage), pageSize: "20" });
    if (runStatus) qs.set("status", runStatus);
    if (runCode) qs.set("code", runCode);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/payroll/runs?${qs}`);
    if (res.error) return;
    setRunsTotal(res.data?.totalCount ?? 0);
    const items = (res.data?.items ?? []).map((r) => ({
      id: String(r.id ?? r.Id),
      code: String(r.code ?? r.Code ?? ""),
      status: String(r.status ?? r.Status ?? ""),
      totalGross: Number(r.totalGross ?? r.TotalGross ?? 0),
      totalNet: Number(r.totalNet ?? r.TotalNet ?? 0),
    }));
    setRuns(items);
    setRunId((prev) => prev || items[0]?.id || "");
  }, [runsPage, runStatus, runCode]);

  const loadPayslips = useCallback(async (rid: string) => {
    if (!rid) {
      setPayslips([]);
      return;
    }
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/payroll/payslips?runId=${rid}&page=1&pageSize=50`);
    if (res.error) {
      setPayslips([]);
      return;
    }
    setPayslips(
      (res.data?.items ?? []).map((p) => ({
        id: String(p.id ?? p.Id),
        employeeCode: String(p.employeeCode ?? p.EmployeeCode ?? ""),
        employeeName: String(p.employeeName ?? p.EmployeeName ?? ""),
        gross: Number(p.gross ?? p.Gross ?? 0),
        net: Number(p.net ?? p.Net ?? 0),
        incomeTax: Number(p.incomeTax ?? p.IncomeTax ?? 0),
        employeeInsurance: Number(p.employeeInsurance ?? p.EmployeeInsurance ?? 0),
      })),
    );
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
    const next = (res.data?.items ?? []).map((a) => ({
      id: String(a.id ?? a.Id),
      code: String(a.code ?? a.Code ?? ""),
      name: String(a.name ?? a.Name ?? ""),
    }));
    setAccounts(next);
    setExpenseAccountId((prev) => prev || next.find((a) => a.code.startsWith("51"))?.id || next[0]?.id || "");
    setNetPayAccountId((prev) => prev || next.find((a) => a.code.startsWith("21"))?.id || next[0]?.id || "");
    setEmpInsAccountId((prev) => prev || next.find((a) => a.code.startsWith("22"))?.id || next[0]?.id || "");
    setErInsAccountId((prev) => prev || next.find((a) => a.code.startsWith("23"))?.id || next[0]?.id || "");
    setTaxAccountId((prev) => prev || next.find((a) => a.code.startsWith("24"))?.id || next[0]?.id || "");
  }, []);

  useEffect(() => {
    void loadEmployees();
    void loadRuns();
    void loadAccounts();
  }, [loadEmployees, loadRuns, loadAccounts]);

  useEffect(() => {
    void loadPayslips(runId);
  }, [runId, loadPayslips]);

  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (editingEmployeeId) {
      const res = await apiSend(`/api/v1/payroll/employees/${editingEmployeeId}`, "PUT", {
        firstName,
        lastName,
        nationalId,
        iban,
        isActive: empActive,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("کارمند ویرایش شد.");
      setEditingEmployeeId(null);
      await loadEmployees();
      return;
    }
    const res = await apiSend<Record<string, unknown>>("/api/v1/payroll/employees", "POST", {
      code,
      firstName,
      lastName,
      nationalId,
      iban,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    const id = String(res.data.id ?? res.data.Id);
    setSelectedEmployeeId(id);
    const contract = await apiSend("/api/v1/payroll/contracts", "POST", {
      employeeId: id,
      baseSalaryMonthly: Number(salary),
      effectiveFromJalali: `${jalaliYear}/01/01`,
    });
    if (contract.error) {
      setError(contract.error);
      return;
    }
    setOk("کارمند و قرارداد ثبت شد.");
    await loadEmployees();
  }

  async function seedDefaults() {
    setOk(null);
    const res = await apiSend("/api/v1/payroll/seed-iran-defaults", "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("پله‌های مالیات و نرخ بیمه نمونه بارگذاری شد.");
  }

  async function createPeriodAndRun(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const period = await apiSend<Record<string, unknown>>("/api/v1/payroll/periods", "POST", {
      jalaliYear,
      jalaliMonth,
    });
    if (period.error || !period.data) {
      setError(period.error ?? "خطا");
      return;
    }
    const pid = String(period.data.id ?? period.data.Id);
    setPeriodId(pid);
    const run = await apiSend<Record<string, unknown>>("/api/v1/payroll/runs", "POST", { periodId: pid });
    if (run.error || !run.data) {
      setError(run.error ?? "خطا");
      return;
    }
    setRunId(String(run.data.id ?? run.data.Id));
    setOk("دوره و اجرای حقوق ایجاد شد.");
    await loadRuns();
  }

  async function calculateRun() {
    if (!runId) {
      setError("ابتدا اجرای حقوق را بسازید.");
      return;
    }
    setOk(null);
    const res = await apiSend<Record<string, unknown>>(`/api/v1/payroll/runs/${runId}/calculate`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("محاسبه حقوق انجام شد.");
    await loadRuns();
    await loadPayslips(runId);
  }

  async function postRun() {
    if (!runId || !workspace.periodId) {
      setError("اجرای حقوق و دوره مالی لازم است.");
      return;
    }
    setOk(null);
    const res = await apiSend<Record<string, unknown>>(
      `/api/v1/payroll/runs/${runId}/post`,
      "POST",
      {
        fiscalPeriodId: workspace.periodId,
        payrollExpenseAccountId: expenseAccountId,
        netPayPayableAccountId: netPayAccountId,
        employeeInsurancePayableAccountId: empInsAccountId,
        employerInsurancePayableAccountId: erInsAccountId,
        incomeTaxPayableAccountId: taxAccountId,
      },
      crypto.randomUUID(),
    );
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("اجرای حقوق ثبت دفترکل شد.");
    await loadRuns();
  }

  async function downloadCsv() {
    if (!runId) return;
    const res = await apiDownload(`/api/v1/payroll/runs/${runId}/bank-csv`, { accept: "text/csv" });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا در دریافت CSV");
      return;
    }
    const url = URL.createObjectURL(res.data.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.fileName.endsWith(".csv") ? res.data.fileName : `payroll-bank-${runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const empCols: GridColumn<EmployeeRow>[] = [
    { key: "code", header: "کد", render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => `${r.firstName} ${r.lastName}` },
    { key: "nationalId", header: "کد ملی", render: (r) => r.nationalId },
    { key: "iban", header: "شبا", render: (r) => r.iban || "—" },
    { key: "st", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "act",
      header: "اقدام",
      render: (r) => (
        <div className="row-actions">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setEditingEmployeeId(r.id);
              setCode(r.code);
              setFirstName(r.firstName);
              setLastName(r.lastName);
              setNationalId(r.nationalId);
              setIban(r.iban);
              setEmpActive(r.isActive);
              setSelectedEmployeeId(r.id);
            }}
          >
            ویرایش
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              void (async () => {
                const res = await apiSend(`/api/v1/payroll/employees/${r.id}`, "PUT", {
                  firstName: r.firstName,
                  lastName: r.lastName,
                  nationalId: r.nationalId,
                  iban: r.iban,
                  isActive: !r.isActive,
                });
                if (res.error) setError(res.error);
                else {
                  setOk(r.isActive ? "کارمند غیرفعال شد." : "کارمند فعال شد.");
                  await loadEmployees();
                }
              })();
            }}
          >
            {r.isActive ? "غیرفعال" : "فعال"}
          </button>
          <ConfirmAction
            title="حذف کارمند"
            consequences={[`کارمند ${r.code} حذف می‌شود.`, "اگر در اجرای حقوق استفاده شده باشد حذف مجاز نیست."]}
            reference={r.code}
            confirmLabel="حذف"
            onConfirm={async () => {
              const res = await apiSend(`/api/v1/payroll/employees/${r.id}`, "DELETE");
              if (res.error) throw new Error(res.error);
              setOk("کارمند حذف شد.");
              if (editingEmployeeId === r.id) setEditingEmployeeId(null);
              await loadEmployees();
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
  ];

  const runCols: GridColumn<RunRow>[] = [
    { key: "code", header: "کد", render: (r) => r.code },
    { key: "status", header: "وضعیت", render: (r) => <StatusChip status={r.status} /> },
    { key: "gross", header: "ناخالص", render: (r) => formatMoneyIrr(r.totalGross) },
    { key: "net", header: "خالص", render: (r) => formatMoneyIrr(r.totalNet) },
  ];

  const slipCols: GridColumn<PayslipRow>[] = [
    { key: "code", header: "کد", render: (r) => r.employeeCode },
    { key: "name", header: "نام", render: (r) => r.employeeName },
    { key: "gross", header: "ناخالص", render: (r) => formatMoneyIrr(r.gross) },
    { key: "ins", header: "بیمه کارمند", render: (r) => formatMoneyIrr(r.employeeInsurance) },
    { key: "tax", header: "مالیات", render: (r) => formatMoneyIrr(r.incomeTax) },
    { key: "net", header: "خالص", render: (r) => formatMoneyIrr(r.net) },
  ];

  const accountSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <AppShell
      title="حقوق و دستمزد"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={() => void seedDefaults()}>
            بارگذاری پیش‌فرض ایران
          </button>
          <button type="button" className="btn-secondary" onClick={() => void downloadCsv()} disabled={!runId}>
            دانلود CSV بانک
          </button>
        </>
      }
    >
      {error ? <ErrorState message={error} /> : null}
      {ok ? <SuccessBanner message={ok} /> : null}

      <section className="panel">
        <h2>{editingEmployeeId ? `ویرایش کارمند ${code}` : "کارمند جدید"}</h2>
        <form className="form-grid" onSubmit={(e) => void saveEmployee(e)}>
          <label>
            کد
            <input value={code} onChange={(e) => setCode(e.target.value)} required disabled={!!editingEmployeeId} />
          </label>
          <label>
            نام
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label>
            نام خانوادگی
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label>
            کد ملی
            <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
          </label>
          <label>
            شبا
            <input className="ltr" value={iban} onChange={(e) => setIban(e.target.value)} />
          </label>
          {!editingEmployeeId ? (
            <label>
              حقوق ماهانه
              <input className="ltr" value={salary} onChange={(e) => setSalary(e.target.value)} required />
            </label>
          ) : (
            <label>
              <span>
                <input type="checkbox" checked={empActive} onChange={(e) => setEmpActive(e.target.checked)} /> فعال
              </span>
            </label>
          )}
          <div className="page-actions" style={{ alignSelf: "end" }}>
            <button type="submit" className="btn-primary">
              {editingEmployeeId ? "ذخیره" : "ثبت کارمند و قرارداد"}
            </button>
            {editingEmployeeId ? (
              <button type="button" className="btn-ghost" onClick={() => setEditingEmployeeId(null)}>
                انصراف
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>کارمندان</h2>
        <DataGrid
          rows={employees}
          columns={empCols}
          loading={loading}
          page={empPage}
          pageSize={20}
          totalCount={empTotal}
          onPageChange={setEmpPage}
          filterValue={empSearch}
          onFilterChange={setEmpSearch}
          filterPlaceholder="کد، نام یا کد ملی"
          rowKey={(r) => r.id}
          savedViewKey="payroll-employees"
        />
      </section>

      <section className="panel">
        <h2>دوره و اجرا</h2>
        <form className="form-grid" onSubmit={(e) => void createPeriodAndRun(e)}>
          <label>
            سال شمسی
            <input
              type="number"
              value={jalaliYear}
              onChange={(e) => setJalaliYear(Number(e.target.value))}
              required
            />
          </label>
          <label>
            ماه
            <input
              type="number"
              min={1}
              max={12}
              value={jalaliMonth}
              onChange={(e) => setJalaliMonth(Number(e.target.value))}
              required
            />
          </label>
          <button type="submit" className="btn-primary">
            ایجاد دوره و اجرا
          </button>
          <button type="button" className="btn-secondary" onClick={() => void calculateRun()}>
            محاسبه
          </button>
          <label>
            اجرای فعال
            <select value={runId} onChange={(e) => setRunId(e.target.value)}>
              <option value="">انتخاب اجرا…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {statusFa(r.status)}
                </option>
              ))}
            </select>
          </label>
        </form>
        <p className="muted">
          دوره: {periodId || "—"} · اجرا: {runId || "—"} · کارمند انتخابی: {selectedEmployeeId || "—"}
        </p>
        {accountSelect(expenseAccountId, setExpenseAccountId, "حساب هزینه حقوق")}
        {accountSelect(netPayAccountId, setNetPayAccountId, "خالص پرداختنی")}
        {accountSelect(empInsAccountId, setEmpInsAccountId, "بیمه کارمند")}
        {accountSelect(erInsAccountId, setErInsAccountId, "بیمه کارفرما")}
        {accountSelect(taxAccountId, setTaxAccountId, "مالیات حقوق")}
        <button type="button" className="btn-primary" onClick={() => void postRun()}>
          ثبت دفترکل (Idempotency-Key)
        </button>
      </section>

      <section className="panel">
        <h2>اجراها</h2>
        <div className="form-grid">
          <label>
            وضعیت اجرا
            <select
              value={runStatus}
              onChange={(e) => {
                setRunStatus(e.target.value);
                setRunsPage(1);
              }}
            >
              <option value="">همه</option>
              {["Draft", "Calculated", "Posted"].map((s) => (
                <option key={s} value={s}>
                  {statusFa(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DataGrid
          rows={runs}
          columns={runCols}
          loading={false}
          page={runsPage}
          pageSize={20}
          totalCount={runsTotal}
          onPageChange={setRunsPage}
          filterValue={runCode}
          onFilterChange={setRunCode}
          filterPlaceholder="کد اجرا"
          rowKey={(r) => r.id}
          savedViewKey="payroll-runs"
        />
      </section>

      <section className="panel">
        <h2>فیش‌های حقوق</h2>
        <DataGrid
          rows={payslips}
          columns={slipCols}
          loading={false}
          page={1}
          pageSize={50}
          totalCount={payslips.length}
          onPageChange={() => undefined}
          rowKey={(r) => r.id}
          savedViewKey="payroll-payslips"
        />
      </section>
    </AppShell>
  );
}
