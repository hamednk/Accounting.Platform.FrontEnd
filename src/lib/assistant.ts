/** Client-side bridge so any page can hand context/questions to the global assistant panel. */

export type AssistantContext = {
  page: string;
  title: string;
  /** Compact JSON-able snapshot of what the user sees (rows, totals, filters). Truncated before sending. */
  data?: unknown;
};

export type AssistantSendDetail = {
  prompt: string;
  context?: AssistantContext;
  autoSend?: boolean;
};

export const ASSISTANT_EVENT = "assistant:send";

export function sendToAssistant(detail: AssistantSendDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AssistantSendDetail>(ASSISTANT_EVENT, { detail }));
}

export type AiProposal = {
  id: string;
  kind: "Journal" | "SalesOrder" | "PurchaseOrder" | string;
  status: "Pending" | "Accepted" | "Rejected" | string;
  title: string;
  payloadJson: string;
  totalAmount: number;
  source: string;
  notes?: string | null;
  createdBy: string;
  createdAtUtc: string;
  decidedBy?: string | null;
  decidedAtUtc?: string | null;
  decisionReason?: string | null;
  resultDocumentId?: string | null;
  resultDocumentNumber?: string | null;
};

export type AiToolTrace = { name: string; titleFa?: string; summaryFa: string; ok: boolean };
export type AiChatResponse = { reply: string; mode: string; tools: AiToolTrace[]; proposals: AiProposal[] };

/** Fallback when older API responses omit titleFa. */
export const TOOL_TITLE_FA: Record<string, string> = {
  get_trial_balance: "تراز آزمایشی",
  get_account_balance: "مانده حساب",
  search_accounts: "جستجوی حساب",
  suggest_account_code: "پیشنهاد کد حساب",
  get_stock: "موجودی کالا",
  get_customer_aging: "سنی مطالبات",
  propose_journal: "پیشنهاد سند",
  propose_sales_order: "پیشنهاد سفارش فروش",
  propose_purchase_order: "پیشنهاد سفارش خرید",
};

export function toolTitleFa(t: AiToolTrace): string {
  return t.titleFa?.trim() || TOOL_TITLE_FA[t.name] || t.name;
}

export const PROPOSAL_KIND_FA: Record<string, string> = {
  Journal: "سند حسابداری",
  SalesOrder: "سفارش فروش",
  PurchaseOrder: "سفارش خرید",
};

export const PROPOSAL_STATUS_FA: Record<string, string> = {
  Pending: "در انتظار بررسی",
  Accepted: "پذیرفته (پیش‌نویس ساخته شد)",
  Rejected: "رد شده",
};

export const PROPOSAL_SOURCE_FA: Record<string, string> = {
  Chat: "گفتگو",
  Extract: "استخراج سند",
  Form: "فرم",
  LLM: "مدل زبانی",
  LocalRules: "قواعد محلی",
};

export function clipContext(data: unknown, max = 5000): string | undefined {
  if (data === undefined || data === null) return undefined;
  try {
    const s = JSON.stringify(data);
    return s.length > max ? s.slice(0, max) : s;
  } catch {
    return undefined;
  }
}
