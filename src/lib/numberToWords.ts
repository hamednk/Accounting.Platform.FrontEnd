/** Persian number to words (عدد به حروف) for invoices and cheques. Works on integer strings to avoid float loss. */

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "هزار میلیارد", "میلیون میلیارد", "میلیارد میلیارد"];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]!);
    if (o) parts.push(ONES[o]!);
  }
  return parts.join(" و ");
}

export function numberToPersianWords(value: number | string | bigint | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  let digits: string;
  if (typeof value === "bigint") digits = value.toString();
  else if (typeof value === "number") digits = Number.isFinite(value) ? Math.trunc(value).toString() : "0";
  else digits = value.trim().replace(/[٬,\s]/g, "").split(".")[0] ?? "0";

  let negative = false;
  if (digits.startsWith("-")) {
    negative = true;
    digits = digits.slice(1);
  }
  digits = digits.replace(/^0+/, "");
  if (!/^\d*$/.test(digits)) return "";
  if (digits === "") return "صفر";

  const groups: number[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(Number(digits.slice(Math.max(0, end - 3), end)));
  }
  if (groups.length > SCALES.length) return digits;

  const words: string[] = [];
  groups.forEach((g, i) => {
    if (!g) return;
    const scale = SCALES[groups.length - 1 - i]!;
    words.push(scale ? `${threeDigits(g)} ${scale}` : threeDigits(g));
  });
  return `${negative ? "منفی " : ""}${words.join(" و ")}`;
}

/** e.g. «یک میلیون و دویست هزار ریال» */
export function rialsInWords(value: number | string | null | undefined): string {
  const w = numberToPersianWords(value);
  return w ? `${w} ریال` : "";
}
