/** Jalali calendar helpers — keep format in sync with BuildingBlocks.Contracts.Time.JalaliDate (yyyy/MM/dd, ASCII digits). */

const MONTHS_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const WEEKDAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const persianFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type JalaliParts = { year: number; month: number; day: number };

function toAsciiDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function formatJalali(isoDate: string | Date): string {
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  return toAsciiDigits(persianFmt.format(d).replace(/‏/g, "").replace(/-/g, "/"));
}

export function todayJalali(): string {
  return formatJalali(new Date());
}

export function monthNameFa(month: number): string {
  return MONTHS_FA[month - 1] ?? "";
}

export function weekdaysFa(): string[] {
  return WEEKDAYS_FA;
}

export function parseJalali(value: string | null | undefined): JalaliParts | null {
  if (!value) return null;
  const normalized = toAsciiDigits(value.trim()).replace(/-/g, "/");
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!isValidJalali(year, month, day)) return null;
  return { year, month, day };
}

export function formatJalaliParts(parts: JalaliParts): string {
  return `${parts.year}/${String(parts.month).padStart(2, "0")}/${String(parts.day).padStart(2, "0")}`;
}

export function isLeapJalali(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  let jp = breaks[0]!;
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (jump - n < 6) n = n - jump + ((jump + 4) / 33) * 33;
  let leap = ((((n + 1) % 33) - 1) % 4);
  if (leap === -1) leap = 4;
  return leap === 0;
}

export function daysInJalaliMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}

export function isValidJalali(jy: number, jm: number, jd: number): boolean {
  return jy >= 1 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= daysInJalaliMonth(jy, jm);
}

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Gregorian → Jalali */
export function toJalali(gy: number, gm: number, gd: number): JalaliParts {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  let gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const days =
    365 * gy2 +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1]! -
    (gm > 2 && ((gy2 % 4 === 0 && gy2 % 100 !== 0) || gy2 % 400 === 0) ? 0 : 1);
  jy += 33 * div(days, 12053);
  let remaining = days % 12053;
  jy += 4 * div(remaining, 1461);
  remaining %= 1461;
  if (remaining > 365) {
    jy += div(remaining - 1, 365);
    remaining = (remaining - 1) % 365;
  }
  const jm = remaining < 186 ? 1 + div(remaining, 31) : 7 + div(remaining - 186, 30);
  const jd = 1 + (remaining < 186 ? remaining % 31 : (remaining - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

/** Jalali → Gregorian */
export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = jy <= 979 ? 621 : 1600;
  jy = jy <= 979 ? jy : jy - 979;
  const days =
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  let remaining = days % 146097;
  if (remaining > 36524) {
    gy += 100 * div(--remaining, 36524);
    remaining %= 36524;
    if (remaining >= 365) remaining += 1;
  }
  gy += 4 * div(remaining, 1461);
  remaining %= 1461;
  if (remaining > 365) {
    gy += div(remaining - 1, 365);
    remaining = (remaining - 1) % 365;
  }
  const gd = remaining + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  let v = gd;
  for (gm = 1; gm <= 12 && v > sal_a[gm]!; gm += 1) v -= sal_a[gm]!;
  return { gy, gm, gd: v };
}

export function jalaliToDate(parts: JalaliParts): Date {
  const g = toGregorian(parts.year, parts.month, parts.day);
  return new Date(g.gy, g.gm - 1, g.gd);
}

export function dateToJalali(date: Date): JalaliParts {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Saturday-based weekday index 0..6 for Jalali calendar grids */
export function jalaliWeekdayIndex(parts: JalaliParts): number {
  const d = jalaliToDate(parts);
  // JS: 0=Sun … 6=Sat → Jalali grid starts Saturday
  return (d.getDay() + 1) % 7;
}

export function addJalaliMonths(parts: JalaliParts, delta: number): JalaliParts {
  const absolute = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(absolute / 12);
  const month = (absolute % 12) + 1;
  const day = Math.min(parts.day, daysInJalaliMonth(year, month));
  return { year, month, day };
}
