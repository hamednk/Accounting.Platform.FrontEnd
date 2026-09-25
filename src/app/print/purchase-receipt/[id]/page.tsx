"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PrintLayout, SignatureRow, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { apiGet } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr, formatQuantity } from "@/lib/format";
import { statusFa } from "@/lib/labels";
import { rialsInWords } from "@/lib/numberToWords";

type Line = { lineNumber: number; itemCode: string; itemName: string; unit: string; quantity: number; unitPrice: number; amount: number };
type Payload = {
  company: Record<string, unknown>;
  vendor: { code: string; name: string; nationalId?: string | null; economicCode?: string | null } | null;
  order: { documentNumber: string; orderDateJalali: string; receivedDateJalali: string | null; status: string; totalAmount: number; description: string };
  warehouse: string | null;
  lines: Line[];
};

export default function PrintPurchaseReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Payload>(`/api/v1/print/purchase-orders/${id}`).then((res) => {
      if (res.error || !res.data) {
        setError(res.error ?? "سفارش خرید یافت نشد.");
        return;
      }
      setData(res.data);
      setCompany(mapCompany(res.data.company));
    });
  }, [id]);

  const o = data?.order;
  const received = !!o?.receivedDateJalali;

  return (
    <PrintLayout
      title={received ? "رسید انبار (خرید)" : "سفارش خرید"}
      company={company}
      loading={!data && !error}
      error={error}
      meta={
        o
          ? [
              { label: "شماره سفارش", value: o.documentNumber, ltr: true },
              { label: "تاریخ سفارش", value: formatJalaliDisplay(o.orderDateJalali) },
              ...(o.receivedDateJalali ? [{ label: "تاریخ رسید", value: formatJalaliDisplay(o.receivedDateJalali) }] : []),
              { label: "وضعیت", value: statusFa(o.status) },
            ]
          : []
      }
      footer={<SignatureRow labels={["تحویل‌دهنده", "انباردار", "کنترل کیفیت", "حسابداری"]} />}
    >
      {data && o ? (
        <>
          <section className="print-two">
            <div className="print-box">
              <h2>تأمین‌کننده</h2>
              <div>
                {data.vendor?.name ?? "—"} {data.vendor?.code ? <span className="muted ltr">({data.vendor.code})</span> : null}
              </div>
              <div>
                شناسه ملی: <span className="ltr">{data.vendor?.nationalId || "—"}</span> · کد اقتصادی:{" "}
                <span className="ltr">{data.vendor?.economicCode || "—"}</span>
              </div>
            </div>
            <div className="print-box">
              <h2>انبار</h2>
              <div>{data.warehouse ?? "—"}</div>
              {o.description ? <div>شرح: {o.description}</div> : null}
            </div>
          </section>
          <table className="print-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>کد کالا</th>
                <th>شرح کالا</th>
                <th>واحد</th>
                <th className="num">مقدار</th>
                <th className="num">بهای واحد</th>
                <th className="num">بهای کل</th>
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
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>جمع</td>
                <td className="num">{formatMoneyIrr(o.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="print-words">جمع به حروف: {rialsInWords(o.totalAmount)}</p>
        </>
      ) : null}
    </PrintLayout>
  );
}
