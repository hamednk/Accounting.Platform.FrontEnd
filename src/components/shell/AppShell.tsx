"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { hasCapability, type Capability } from "@/lib/permissions";
import { useAuthSession } from "@/components/auth/AuthGate";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { LoadingState } from "@/components/ui/StateViews";
import { statusFa } from "@/lib/labels";
import { AssistantPanel } from "@/components/ai/AssistantPanel";

type NavItem = { href: string; label: string; cap?: Capability; perm?: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

/** Pages that work without a selected company; every other page calls company-scoped APIs. */
const COMPANY_OPTIONAL = new Set(["/", "/dashboard", "/setup", "/api-status", "/reports", "/enterprise"]);

function CompanyRequired({ hasCompanies }: { hasCompanies: boolean }) {
  return (
    <div className="alert alert-info" role="status">
      <div className="alert-body">
        <strong className="alert-title">{hasCompanies ? "شرکتی انتخاب نشده است" : "هنوز شرکتی تعریف نشده است"}</strong>
        <p className="alert-text">
          {hasCompanies
            ? "برای کار با این بخش، ابتدا از نوار بالا یک شرکت و دوره مالی انتخاب کنید."
            : "برای شروع، از صفحه راه‌اندازی یک شرکت، سال مالی و سرفصل حساب‌ها بسازید. (پایگاه داده حافظه‌ای با هر بار اجرای مجدد API خالی می‌شود.)"}
        </p>
        {!hasCompanies ? (
          <div className="alert-actions">
            <Link className="btn-primary btn-sm" href="/setup">
              رفتن به راه‌اندازی
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    label: "شروع",
    items: [
      { href: "/dashboard", label: "داشبورد" },
      { href: "/setup", label: "راه‌اندازی" },
    ],
  },
  {
    id: "gl",
    label: "دفترکل",
    items: [
      { href: "/fiscal-years", label: "سال و دوره مالی", cap: "gl" },
      { href: "/accounts", label: "سرفصل حساب‌ها", cap: "gl" },
      { href: "/journals", label: "اسناد حسابداری", cap: "gl" },
      { href: "/journals/recurring", label: "اسناد تکراری", cap: "gl" },
      { href: "/fx", label: "ارز و تسعیر", cap: "gl", perm: "ACCOUNTING.ACCOUNT.MANAGE" },
      { href: "/reports", label: "گزارش‌ها", cap: "reporting", perm: "REPORTS.VIEW" },
    ],
  },
  {
    id: "ops",
    label: "عملیات",
    items: [
      { href: "/treasury", label: "خزانه", cap: "treasury" },
      { href: "/sales", label: "فروش", cap: "sales" },
      { href: "/purchasing", label: "خرید", cap: "sales" },
      { href: "/inventory", label: "انبار", cap: "inventory" },
      { href: "/assets", label: "دارایی ثابت", cap: "assets" },
      { href: "/payroll", label: "حقوق و دستمزد", perm: "PAYROLL.MANAGE" },
    ],
  },
  {
    id: "industrial",
    label: "صنعتی",
    items: [
      { href: "/costing", label: "بهایابی", cap: "costing" },
      { href: "/manufacturing", label: "تولید", cap: "manufacturing" },
      { href: "/enterprise", label: "سازمانی", cap: "enterprise" },
    ],
  },
  {
    id: "compliance",
    label: "مالیات و انطباق",
    items: [
      { href: "/tax", label: "مالیات و گزارش فصلی", perm: "TAX.MANAGE" },
      { href: "/tax/moadian", label: "سامانه مودیان", perm: "TAX.MOADIAN.SUBMIT" },
    ],
  },
  {
    id: "ai",
    label: "هوشمند",
    items: [
      { href: "/ai", label: "دستیار هوشمند", cap: "ai", perm: "AI.USE" },
      { href: "/ai/proposals", label: "پیشنهادهای دستیار", cap: "ai", perm: "AI.USE" },
    ],
  },
  {
    id: "admin",
    label: "مدیریت",
    items: [
      { href: "/admin/users", label: "کاربران و نقش‌ها", perm: "IDENTITY.USERS.MANAGE" },
      { href: "/admin/integrations", label: "API باز و وب‌هوک‌ها", perm: "INTEGRATIONS.APICLIENTS.MANAGE" },
      { href: "/admin/audit", label: "رویدادهای ممیزی", perm: "AUDIT.VIEW" },
    ],
  },
];

function navActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the most specific nav item (e.g. /journals/recurring over /journals).
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
}

export function AppShell({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}) {
  const { session, logout, can } = useAuthSession();
  const { workspace, companies, periods, setCompany, setPeriod, loading, ready } = useWorkspace();
  const pathname = usePathname();
  const needsCompany = !COMPANY_OPTIONAL.has(pathname);
  const [navOpen, setNavOpen] = useState(false);

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((n) => (!n.cap || hasCapability(n.cap)) && (!n.perm || can(n.perm))),
      })).filter((g) => g.items.length > 0),
    [can],
  );

  let body: React.ReactNode = children;
  if (needsCompany && !ready) body = <LoadingState label="در حال بارگذاری شرکت‌ها…" />;
  else if (needsCompany && !workspace.companyId) body = <CompanyRequired hasCompanies={companies.length > 0} />;

  return (
    <div className={`erp-shell${navOpen ? " nav-open" : ""}`}>
      <aside className="erp-sidebar" aria-label="ناوبری ماژول‌ها">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand-mark" onClick={() => setNavOpen(false)}>
            <span className="brand-orb" aria-hidden />
            <span className="brand-text">
              <strong>سامانه حسابداری</strong>
              <span className="muted">فارسی · شمسی · ریال</span>
            </span>
          </Link>
          <button
            type="button"
            className="sidebar-close btn-ghost btn-sm"
            aria-label="بستن منو"
            onClick={() => setNavOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="sidebar-nav">
          {groups.map((group) => {
            const groupHrefs = group.items.map((i) => i.href);
            return (
            <div key={group.id} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const active = navActive(pathname, item.href, groupHrefs);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={active ? "nav-link is-active" : "nav-link"}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setNavOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </nav>
      </aside>

      {navOpen ? (
        <button type="button" className="nav-backdrop" aria-label="بستن منو" onClick={() => setNavOpen(false)} />
      ) : null}

      <div className="erp-main">
        <header className="erp-topbar">
          <div className="topbar-start">
            <button type="button" className="nav-toggle btn-ghost" aria-label="منوی ماژول‌ها" onClick={() => setNavOpen(true)}>
              ☰
            </button>
            <div className="context-switcher" aria-label="زمینه سازمان">
              <label>
                شرکت
                <select
                  aria-label="انتخاب شرکت"
                  disabled={loading}
                  value={workspace.companyId ?? ""}
                  onChange={(e) => {
                    const c = companies.find((x) => x.id === e.target.value) ?? null;
                    setCompany(c);
                  }}
                >
                  <option value="">انتخاب شرکت…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                دوره مالی
                <select
                  aria-label="انتخاب دوره مالی"
                  disabled={loading || !workspace.companyId}
                  value={workspace.periodId ?? ""}
                  onChange={(e) => {
                    const p = periods.find((x) => x.id === e.target.value) ?? null;
                    setPeriod(p);
                  }}
                >
                  <option value="">انتخاب دوره…</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({statusFa(p.status)})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="topbar-user">
            <span className="user-chip">{session?.user.displayName ?? "مهمان"}</span>
            {session ? (
              <button type="button" className="btn-ghost btn-sm" onClick={logout}>
                خروج
              </button>
            ) : (
              <Link className="btn-secondary btn-sm" href="/login">
                ورود
              </Link>
            )}
          </div>
        </header>
        <div className="page-header">
          <div>
            <p className="breadcrumb muted">خانه / {title}</p>
            <h1>{title}</h1>
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </div>
        <main className="page-body" key={workspace.companyId ?? "none"}>
          {body}
        </main>
      </div>
      {session && hasCapability("ai") && can("AI.USE") ? <AssistantPanel title={title} /> : null}
    </div>
  );
}
