"use client";

import { FinancialReportPage } from "@/components/reports/FinancialReportPage";

export default function CashFlowReportPage() {
  return <FinancialReportPage title="جریان وجوه نقد" endpoint="/api/v1/reports/cash-flow" />;
}
