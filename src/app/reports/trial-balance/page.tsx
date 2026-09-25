"use client";

import { FinancialReportPage } from "@/components/reports/FinancialReportPage";

export default function TrialBalanceReportPage() {
  return <FinancialReportPage title="تراز آزمایشی" endpoint="/api/v1/reports/trial-balance-v2" printPath="/print/trial-balance" showTurnover />;
}
