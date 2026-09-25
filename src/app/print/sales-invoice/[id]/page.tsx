"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PrintLayout, SignatureRow, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { apiGet } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr, formatQuantity } from "@/lib/format";
import { rialsInWords } from "@/lib/numberToWords";

type Line = { lineNumber: number; itemCode: string; itemName: string; unit: string; quantity: number; unitPrice: number; amount: number; taxRate: number; taxAmount: number };
type Party = { code: string; name: string; nationalId?: string | null; economicCode?: string | null; postalCode?: string | null; address?: string | null; phone?: string | null };
type Invoice = { documentNumber: string; invoiceDateJalali: string; totalAmount: number; taxTotal: number; description: string };
type Payload = { company: Record<string, unknown>; customer: Party | null; invoice: Invoice; lines: Line[]; grandTotal: number };

/** صورتحساب فروش کالا و خدمات — layout follows the official Iranian invoice sections (seller / buyer / items). */
export default function PrintSalesInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Payload>(`/api/v1/print/sales-invoices/${id}`).then((res) => {
      if (res.error || !res.data) {
        setError(res.error ?? "فاکتور یافت نشد.");
        return;
      }
      setData(res.data);
      setCompany(mapCompany(res.data.company));
    });
  }, [id]);

  const inv = data?.invoice;
  const c = data?.customer;

  return (
    <PrintLayout
      title="صورتحساب فروش کالا و خدمات"
      company={company}
      loading={!data && !error}
      error={error}
      orientation="landscape"
      meta={
        inv
          ? [
              { label: "شماره", value: inv.documentNumber, ltr: true },
              { label: "تاریخ", value: formatJalaliDisplay(inv.invoiceDateJalali) },
            ]
          : []
      }
      footer={<SignatureRow labels={["مهر و امضای فروشنده", "مهر و امضای خریدار"]} />}
    >
      {data && inv ? (
        <>
          <section className="print-two">
            <div className="print-box">
              <h2>مشخصات فروشنده</h2>
              <div>{company?.name}</div>
              <div>
                شناسه ملی: <span className="ltr">{company?.nationalId || "—"}</span> · کد اقتصادی:{" "}
                <span className="ltr">{company?.economicCode || "—"}</span>
              </div>
              <div>
                نشانی: {company?.address || "—"} · کد پستی: <span className="ltr">{company?.postalCode || "—"}</span>
              </div>
            </div>
            <div className="print-box">
              <h2>مشخصات خریدار</h2>
              <div>
                {c?.name ?? "—"} {c?.code ? <span className="muted ltr">({c.code})</span> : null}
              </div>
              <div>
                شناسه/کد ملی: <span className="ltr">{c?.nationalId || "—"}</span> · کد اقتصادی:{" "}
                <span className="ltr">{c?.economicCode || "—"}</span>
              </div>
              <div>
                نشانی: {c?.address || "—"} · کد پستی: <span className="ltr">{c?.postalCode || "—"}</span>
                {c?.phone ? <> · تلفن: <span className="ltr">{c.phone}</span></> : null}
              </div>
            </div>
          </section>

          <table className="print-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>کد کالا</th>
                <th>شرح کالا / خدمت</th>
                <th>واحد</th>
                <th className="num">مقدار</th>
                <th className="num">مبلغ واحد</th>
                <th className="num">مبلغ کل</th>
                <th className="num">نرخ مالیات</th>
                <th className="num">مالیات و عوارض</th>
                <th className="num">جمع با مالیات</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.lineNumber}>
                  <td>{l.lineNumber}</td>
                  <td className="ltr">{l.itemCode}</td>
                  <td>{l.itemName}</td>
                  <td>{l.unit}</td>
                  <td className="num">{formatQuantity(l.quantity)}</td>
                  <td className="num">{formatMoneyIrr(l.unitPrice)}</td>
                  <td className="num">{formatMoneyIrr(l.amount)}</td>
                  <td className="num">{l.taxRate ? `${formatQuantity(l.taxRate * 100, 2)}٪` : "—"}</td>
                  <td className="num">{formatMoneyIrr(l.taxAmount)}</td>
                  <td className="num">{formatMoneyIrr(l.amount + l.taxAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>جمع کل</td>
                <td className="num">{formatMoneyIrr(inv.totalAmount)}</td>
                <td />
                <td className="num">{formatMoneyIrr(inv.taxTotal)}</td>
                <td className="num">{formatMoneyIrr(data.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="print-words">مبلغ قابل پرداخت به حروف: {rialsInWords(data.grandTotal)}</p>
          {inv.description ? <p>توضیحات: {inv.description}</p> : null}
        </>
      ) : null}
    </PrintLayout>
  );
}
