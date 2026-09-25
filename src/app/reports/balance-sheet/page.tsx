"use client";

import { FinancialReportPage } from "@/components/reports/FinancialReportPage";

export default function BalanceSheetReportPage() {
  return <FinancialReportPage title="ترازنامه" endpoint="/api/v1/reports/balance-sheet" />;
}
