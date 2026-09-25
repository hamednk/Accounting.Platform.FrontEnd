"use client";

import { useRouter } from "next/navigation";
import { formatJalaliDisplay } from "@/lib/format";

export type PrintCompany = {
  name: string;
  nationalId?: string | null;
  economicCode?: string | null;
  registrationNumber?: string | null;
  postalCode?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function mapCompany(r: Record<string, unknown> | undefined | null): PrintCompany {
  const v = (k: string) => (r?.[k] ?? r?.[k.charAt(0).toUpperCase() + k.slice(1)] ?? null) as string | null;
  return {
    name: v("name") ?? "",
    nationalId: v("nationalId"),
    economicCode: v("economicCode"),
    registrationNumber: v("registrationNumber"),
    postalCode: v("postalCode"),
    address: v("address"),
    phone: v("phone"),
  };
}

type Meta = { label: string; value: React.ReactNode; ltr?: boolean };

/**
 * A4 RTL print surface. Browser «چاپ» → «Save as PDF» is the PDF path; server data is authoritative.
 */
export function PrintLayout({
  title,
  company,
  meta,
  loading,
  error,
  children,
  footer,
  orientation = "portrait",
}: {
  title: string;
  company: PrintCompany | null;
  meta?: Meta[];
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  orientation?: "portrait" | "landscape";
}) {
  const router = useRouter();
  return (
    <div className={`print-root print-${orientation}`}>
      <div className="print-toolbar no-print">
        <button type="button" className="btn-primary" onClick={() => window.print()} disabled={loading || !!error}>
          چاپ / ذخیره PDF
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          بازگشت
        </button>
      </div>
      <article className="print-page">
        {loading ? <p className="muted">در حال آماده‌سازی…</p> : null}
        {error ? <p className="state-error">{error}</p> : null}
        {!loading && !error ? (
          <>
            <header className="print-header">
              <div className="print-company">
                <strong>{company?.name}</strong>
                <small>
                  {company?.nationalId ? <>شناسه ملی: <span className="ltr">{company.nationalId}</span> </> : null}
                  {company?.economicCode ? <>· کد اقتصادی: <span className="ltr">{company.economicCode}</span> </> : null}
                  {company?.registrationNumber ? <>· شماره ثبت: <span className="ltr">{company.registrationNumber}</span></> : null}
                </small>
                {company?.address ? (
                  <small>
                    {company.address}
                    {company.postalCode ? <> · کد پستی: <span className="ltr">{company.postalCode}</span></> : null}
                    {company.phone ? <> · تلفن: <span className="ltr">{company.phone}</span></> : null}
                  </small>
                ) : null}
              </div>
              <h1 className="print-title">{title}</h1>
              {meta && meta.length > 0 ? (
                <dl className="print-meta">
                  {meta.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd className={m.ltr ? "ltr" : undefined}>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </header>
            {children}
            {footer ? <footer className="print-footer">{footer}</footer> : null}
            <p className="print-stamp muted">تاریخ چاپ: {formatJalaliDisplay(new Date())}</p>
          </>
        ) : null}
      </article>
    </div>
  );
}

export function SignatureRow({ labels }: { labels: string[] }) {
  return (
    <div className="print-signatures">
      {labels.map((l) => (
        <div key={l}>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

/** Fetch all pages of a paged endpoint for printing (bounded). */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; totalCount: number } | { error: string }>,
  maxPages = 200,
): Promise<{ items: T[] } | { error: string }> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page);
    if ("error" in res) return res;
    all.push(...res.items);
    if (all.length >= res.totalCount || res.items.length === 0) break;
  }
  return { items: all };
}
