/** Display formatters — storage remains canonical Gregorian/DateOnly on the server. */

export function formatMoneyIrr(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(n);
}

export function formatQuantity(qty: number | string | null | undefined, fractionDigits = 3): string {
  if (qty === null || qty === undefined || qty === "") return "—";
  const n = typeof qty === "string" ? Number(qty) : qty;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatJalaliDisplay(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    // Already Jalali from API
    return value.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
  }
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/‏/g, "");
}

export function toLtr(value: string): string {
  return value;
}
