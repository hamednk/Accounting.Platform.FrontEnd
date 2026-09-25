"use client";

import { FinancialReportPage } from "@/components/reports/FinancialReportPage";

export default function IncomeReportPage() {
  return <FinancialReportPage title="سود و زیان" endpoint="/api/v1/reports/income-statement" />;
}
