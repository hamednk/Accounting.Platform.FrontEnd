/** Numeric values must match Modules.Accounting.Domain.AccountType (starts at 1). */
export const ACCOUNT_TYPE = {
  Asset: 1,
  Liability: 2,
  Equity: 3,
  Revenue: 4,
  Expense: 5,
} as const;

export const ACCOUNT_TYPE_OPTIONS = [
  { value: ACCOUNT_TYPE.Asset, label: "دارایی" },
  { value: ACCOUNT_TYPE.Liability, label: "بدهی" },
  { value: ACCOUNT_TYPE.Equity, label: "حقوق مالکانه" },
  { value: ACCOUNT_TYPE.Revenue, label: "درآمد" },
  { value: ACCOUNT_TYPE.Expense, label: "هزینه" },
];

const ACCOUNT_TYPE_FA: Record<string, string> = {
  Asset: "دارایی",
  Liability: "بدهی",
  Equity: "حقوق مالکانه",
  Revenue: "درآمد",
  Expense: "هزینه",
};

const STATUS_FA: Record<string, string> = {
  Draft: "پیش‌نویس",
  Submitted: "ارسال‌شده",
  Approved: "تأییدشده",
  Posted: "ثبت‌شده",
  Reversed: "برگشت‌خورده",
  Confirmed: "تأییدشده",
  Invoiced: "فاکتورشده",
  Received: "دریافت‌شده",
  Cancelled: "لغوشده",
  Active: "فعال",
  Disposed: "واگذارشده",
  Calculated: "محاسبه‌شده",
  Closed: "بسته",
  Open: "باز",
  SoftClosed: "بسته موقت",
  Matched: "تطبیق‌شده",
  Planned: "برنامه‌ریزی‌شده",
  Released: "آزادشده",
  InProcess: "در جریان تولید",
  Completed: "تکمیل‌شده",
  Obsolete: "منسوخ",
  Frozen: "منجمد",
  Costed: "بهایابی‌شده",
  Pending: "در انتظار",
  Rejected: "ردشده",
  Queued: "در صف",
  Running: "در حال اجرا",
  Failed: "ناموفق",
  Processed: "پردازش‌شده",
  Duplicate: "تکراری",
  InHand: "نزد صندوق",
  Deposited: "واگذارشده به بانک",
  Cleared: "وصول‌شده",
  Bounced: "برگشتی",
  Paid: "پرداخت‌شده",
  DraftOnly: "فقط پیش‌نویس",
  DraftProposal: "پیشنهاد پیش‌نویس",
};

const ACTION_FA: Record<string, string> = {
  submit: "ارسال",
  approve: "تأیید",
  post: "ثبت نهایی",
  reverse: "برگشت",
};

export function accountTypeFa(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const key = typeof value === "number" ? Object.keys(ACCOUNT_TYPE).find((k) => ACCOUNT_TYPE[k as keyof typeof ACCOUNT_TYPE] === value) : value;
  return (key && ACCOUNT_TYPE_FA[key]) ?? String(value);
}

export function statusFa(value: string | null | undefined): string {
  if (!value) return "—";
  return STATUS_FA[value] ?? value;
}

/** CSS modifier for `.status-chip--*` */
export function statusTone(value: string | null | undefined): string {
  if (!value) return "draft";
  if (value === "SoftClosed") return "softclosed";
  const normalized = value.toLowerCase();
  const known = new Set([
    "draft",
    "submitted",
    "pending",
    "queued",
    "approved",
    "confirmed",
    "open",
    "active",
    "posted",
    "completed",
    "paid",
    "cleared",
    "reversed",
    "rejected",
    "failed",
    "bounced",
    "cancelled",
    "closed",
    "softclosed",
  ]);
  return known.has(normalized) ? normalized : "draft";
}

export function actionFa(action: string): string {
  return ACTION_FA[action] ?? action;
}

const ACCOUNT_LEVEL_FA: Record<string, string> = {
  Group: "گروه",
  General: "کل",
  Subsidiary: "معین",
  Detail: "تفصیلی",
};

export function accountLevelFa(value: string | null | undefined): string {
  if (!value) return "—";
  return ACCOUNT_LEVEL_FA[value] ?? value;
}

const JOURNAL_KIND_FA: Record<string, string> = {
  Normal: "عادی",
  Opening: "افتتاحیه",
  Closing: "اختتامیه",
  Reversal: "برگشتی",
  ClosingTemporary: "بستن حساب‌های موقت",
};

export function journalKindFa(value: string | null | undefined): string {
  if (!value) return "—";
  return JOURNAL_KIND_FA[value] ?? value;
}

export const PARTY_TYPE_OPTIONS = [
  { value: "Customer", label: "مشتری" },
  { value: "Vendor", label: "تأمین‌کننده" },
  { value: "Employee", label: "کارمند" },
  { value: "BankAccount", label: "حساب بانکی" },
  { value: "CashAccount", label: "صندوق" },
];

export function partyTypeFa(value: string | null | undefined): string {
  if (!value) return "—";
  return PARTY_TYPE_OPTIONS.find((p) => p.value === value)?.label ?? value;
}
