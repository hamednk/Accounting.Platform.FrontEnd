export type ErrorKind = "network" | "validation" | "auth" | "forbidden" | "notFound" | "conflict" | "business" | "server";

export type ApiProblem = {
  kind: ErrorKind;
  status: number;
  title: string;
  message: string;
  fieldErrors: string[];
  code?: string;
  correlationId?: string;
};

type RawProblem = {
  title?: string;
  detail?: string;
  status?: number;
  code?: string;
  errorCode?: string;
  correlationId?: string;
  traceId?: string;
  errors?: unknown;
  extensions?: { code?: string; errorCode?: string; correlationId?: string };
};

const TITLES: Record<ErrorKind, string> = {
  network: "ارتباط با سرور برقرار نشد",
  validation: "اطلاعات وارد شده کامل یا معتبر نیست",
  auth: "نشست شما معتبر نیست",
  forbidden: "دسترسی مجاز نیست",
  notFound: "مورد درخواستی پیدا نشد",
  conflict: "تداخل در اطلاعات",
  business: "این عملیات مجاز نیست",
  server: "خطای داخلی سامانه",
};

const DEFAULT_MESSAGES: Record<ErrorKind, string> = {
  network: "اتصال اینترنت یا روشن بودن سرور API را بررسی کنید و دوباره تلاش کنید.",
  validation: "لطفاً فیلدهای مشخص‌شده را اصلاح کنید.",
  auth: "لطفاً دوباره وارد سامانه شوید.",
  forbidden: "نقش کاربری شما اجازه انجام این عملیات را ندارد.",
  notFound: "ممکن است این مورد حذف شده یا شرکت/دوره انتخابی اشتباه باشد.",
  conflict: "این اطلاعات قبلاً ثبت شده یا توسط کاربر دیگری تغییر کرده است.",
  business: "قواعد حسابداری اجازه این عملیات را نمی‌دهد.",
  server: "عملیات کامل نشد. اگر تکرار شد، شرکت/دوره فعال را بررسی کنید یا کد پیگیری را به پشتیبانی بدهید.",
};

/** Stable codes → clear Persian guidance (falls back to API detail when present). */
const CODE_MESSAGES: Record<string, string> = {
  ORG_TENANT_REQUIRED: "مستأجر مشخص نیست؛ دوباره وارد شوید.",
  ORG_COMPANY_REQUIRED: "ابتدا از نوار بالا یک شرکت انتخاب کنید.",
  ORG_PERIOD_REQUIRED: "ابتدا از نوار بالا یک دوره مالی باز انتخاب کنید.",
  VALIDATION_FAILED: "مقادیر فرم ناقص یا نامعتبر است؛ فیلدها را بررسی کنید.",
  UNAUTHORIZED: "برای ادامه باید وارد سامانه شوید.",
  FORBIDDEN: "نقش کاربری شما اجازه این کار را ندارد.",
  NOT_FOUND: "مورد درخواستی پیدا نشد.",
  CONFLICT: "این اطلاعات قبلاً ثبت شده یا با دادهٔ موجود تداخل دارد.",
  IDEMPOTENCY_CONFLICT: "این درخواست قبلاً با نتیجهٔ دیگری اجرا شده است؛ کلید تکرار را عوض کنید.",
  ACCOUNTING_JOURNAL_NOT_BALANCED: "جمع بدهکار و بستانکار سند برابر نیست.",
  ACCOUNTING_PERIOD_CLOSED: "دوره مالی بسته است؛ سند در دوره بسته ثبت نمی‌شود.",
  ACCOUNTING_PERMISSION_DENIED: "مجوز حسابداری برای این عملیات کافی نیست.",
  ACCOUNTING_NOT_DRAFT: "فقط اسناد پیش‌نویس قابل ویرایش یا حذف هستند.",
  ACCOUNTING_APPROVAL_REQUIRED: "مبلغ سند از آستانه تأیید بالاتر است؛ ابتدا تأیید کنید.",
  DOCUMENT_ALREADY_POSTED: "این سند قبلاً ثبت شده و قابل تغییر نیست.",
  INVENTORY_NEGATIVE_STOCK: "موجودی انبار کافی نیست.",
  AR_CREDIT_LIMIT: "سقف اعتبار مشتری تجاوز شده است.",
  AR_CREDIT_LIMIT_INVALID: "سقف اعتبار نمی‌تواند منفی باشد.",
  MOADIAN_KEY_REQUIRED: "حالت Production مودیان بدون کلید خصوصی پیکربندی نشده است.",
  RECURRING_INACTIVE: "قالب سند تکراری غیرفعال است.",
  RECURRING_NAME_REQUIRED: "نام سند تکراری الزامی است.",
  INTERNAL_ERROR: "خطای غیرمنتظره در سرور رخ داد. جزئیات فنی در لاگ سرور ثبت شده است.",
  INTERNAL_SERVER_ERROR: "خطای غیرمنتظره در سرور رخ داد. جزئیات فنی در لاگ سرور ثبت شده است.",
  PAYROLL_RUN_NOT_CALCULATED: "ابتدا حقوق باید محاسبه شود.",
  PAYROLL_RUN_NOT_FOUND: "اجرای حقوق یافت نشد.",
  PAYROLL_ALREADY_POSTED: "این اجرای حقوق قبلاً ثبت شده است.",
};

const ENGLISH_NOISE =
  /internal\s*server\s*error|an error occurred|unhandled exception|http error|bad request|not found|unauthorized|forbidden|one or more validation errors/i;

function kindFromStatus(status: number): ErrorKind {
  if (status === 0) return "network";
  if (status === 400) return "validation";
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 422) return "business";
  return "server";
}

function hasPersian(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function isUsefulDetail(text: string | undefined | null): text is string {
  if (!text?.trim()) return false;
  const t = text.trim().replace(/^[.\s،,;:]+/u, "").trim();
  if (!t) return false;
  if (ENGLISH_NOISE.test(t) && !hasPersian(t)) return false;
  if (/^internal[_ ]server[_ ]error$/i.test(t)) return false;
  return true;
}

function cleanDetail(text: string): string {
  return text.trim().replace(/^[.\s،,;:]+/u, "").trim();
}

function normalizeCode(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw.trim().replace(/\s+/g, "_").toUpperCase();
}

function readFieldErrors(errors: unknown): string[] {
  if (!errors) return [];
  if (Array.isArray(errors)) {
    return errors
      .map((e) => {
        if (typeof e === "string") return e;
        const obj = e as Record<string, unknown>;
        return String(obj.errorMessage ?? obj.ErrorMessage ?? obj.message ?? "");
      })
      .filter(Boolean);
  }
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .map((v) => String(v))
      .filter(Boolean);
  }
  return [];
}

function extractFromBody(body: Record<string, unknown> | null): RawProblem | null {
  if (!body) return null;
  const extensions = (body.extensions ?? body.Extensions) as RawProblem["extensions"] | undefined;
  const code =
    (body.code as string | undefined) ??
    (body.errorCode as string | undefined) ??
    (body.ErrorCode as string | undefined) ??
    extensions?.code ??
    extensions?.errorCode;

  return {
    title: (body.title ?? body.Title) as string | undefined,
    detail: (body.detail ?? body.Detail ?? body.message ?? body.Message) as string | undefined,
    status: Number(body.status ?? body.Status ?? 0) || undefined,
    code,
    errorCode: code,
    correlationId:
      (body.correlationId as string | undefined) ??
      (body.CorrelationId as string | undefined) ??
      extensions?.correlationId,
    traceId: (body.traceId ?? body.TraceId) as string | undefined,
    errors: body.errors ?? body.Errors,
    extensions,
  };
}

export function buildProblem(status: number, body: Record<string, unknown> | null, isAuthEndpoint = false): ApiProblem {
  const raw = extractFromBody(body);
  const kind = kindFromStatus(status);
  const code = normalizeCode(raw?.code ?? raw?.errorCode ?? raw?.extensions?.code ?? raw?.extensions?.errorCode);
  const fieldErrors = readFieldErrors(raw?.errors);

  let title = TITLES[kind];
  if (raw?.title && hasPersian(raw.title) && !ENGLISH_NOISE.test(raw.title)) {
    title = raw.title.trim();
  }

  let message =
    (isUsefulDetail(raw?.detail) ? cleanDetail(raw!.detail!) : undefined) ||
    (code && CODE_MESSAGES[code]) ||
    DEFAULT_MESSAGES[kind];

  if (isAuthEndpoint && (kind === "auth" || kind === "business")) {
    title = "ورود ناموفق";
    message = isUsefulDetail(raw?.detail) ? cleanDetail(raw!.detail!) : "نام کاربری یا رمز عبور اشتباه است.";
  } else if (kind === "auth") {
    message = "نشست شما منقضی شده یا نامعتبر است. در حال انتقال به صفحه ورود…";
  }

  if (kind === "validation" && fieldErrors.length > 0 && message.includes("; ")) {
    message = DEFAULT_MESSAGES.validation;
  }

  return {
    kind,
    status,
    title,
    message,
    fieldErrors,
    code,
    correlationId: raw?.correlationId ?? raw?.extensions?.correlationId ?? raw?.traceId,
  };
}

export function networkProblem(): ApiProblem {
  return buildProblem(0, null);
}

const registry = new Map<string, ApiProblem>();
let seq = 0;

/** Keeps structured details so ErrorState can render them without changing every page's state type.
 * Returns the Persian user message (safe to show even if registry lookup misses). */
export function rememberProblem(problem: ApiProblem): string {
  const key = `err:${++seq}:${problem.code ?? problem.kind}`;
  registry.set(key, problem);
  registry.set(problem.message, problem);
  if (registry.size > 100) {
    const first = registry.keys().next().value;
    if (first !== undefined) registry.delete(first);
  }
  return problem.message;
}

export function lookupProblem(message: string): ApiProblem | undefined {
  const byKey = registry.get(message);
  if (byKey) return byKey;
  // Backward-compat: older callers may still store the Persian message as the key.
  for (const p of registry.values()) {
    if (p.message === message) return p;
  }
  return undefined;
}

/** Human label for technical error codes shown in the UI. */
export function codeLabelFa(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return CODE_MESSAGES[normalizeCode(code) ?? ""] ? code : code;
}
