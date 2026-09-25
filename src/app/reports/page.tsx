import { AppShell } from "@/components/shell/AppShell";
import Link from "next/link";

const REPORTS = [
  { href: "/reports/trial-balance", label: "تراز آزمایشی", desc: "آشتی دوطرفه با دفترکل" },
  { href: "/reports/income", label: "سود و زیان", desc: "درآمد و هزینه دوره" },
  { href: "/reports/balance-sheet", label: "ترازنامه", desc: "دارایی، بدهی، حقوق" },
  { href: "/reports/cash-flow", label: "جریان وجوه", desc: "نمای نقدی عملیاتی" },
  { href: "/reports/account-ledger", label: "دفتر کل و معین", desc: "گردش و مانده هر حساب با مانده ابتدا و پایان دوره" },
  { href: "/reports/party-statement", label: "صورت‌حساب طرف حساب", desc: "تفصیلی شناور مشتری، تأمین‌کننده، بانک و صندوق" },
  { href: "/reports/legal-books", label: "دفاتر قانونی", desc: "دفتر روزنامه و دفتر کل برای چاپ و پلمپ" },
];

export default function ReportsIndexPage() {
  return (
    <AppShell title="گزارش‌ها">
      <div className="module-list">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <strong>{r.label}</strong>
            <div className="muted">{r.desc}</div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
