import { AppShell } from "@/components/shell/AppShell";
import Link from "next/link";

export default function EnterprisePage() {
  return (
    <AppShell title="سازمانی و یکپارچه‌سازی">
      <div className="module-list">
        <Link href="/enterprise/intercompany">
          <strong>بین‌شرکتی</strong>
          <div className="muted">انتقال و قاعده با ثبت دوطرفه</div>
        </Link>
        <Link href="/enterprise/workflows">
          <strong>گردش‌کار</strong>
          <div className="muted">تأیید چندمرحله‌ای اسناد</div>
        </Link>
        <Link href="/enterprise/integrations">
          <strong>هاب یکپارچه‌سازی</strong>
          <div className="muted">ورود/خروج حسابرسی‌شده و صندوق پیام‌های ورودی</div>
        </Link>
        <Link href="/enterprise/consolidation">
          <strong>تلفیق</strong>
          <div className="muted">حذف معاملات درون‌گروهی</div>
        </Link>
      </div>
    </AppShell>
  );
}
