"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PrintLayout, mapCompany, type PrintCompany } from "@/components/print/PrintLayout";
import { apiGet } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr } from "@/lib/format";
import { statusFa } from "@/lib/labels";
import { rialsInWords } from "@/lib/numberToWords";

type Payload = {
  company: Record<string, unknown>;
  cheque: { number: string; sayadNumber: string | null; issueDateJalali: string; dueDateJalali: string; amount: number; chequeStatus: string | null; description: string };
  bank: { bankName: string; name: string; iban: string } | null;
  counterparty: string | null;
};

export default function PrintChequePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [company, setCompany] = useState<PrintCompany | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Payload>(`/api/v1/print/cheques/${id}`).then((res) => {
      if (res.error || !res.data) {
        setError(res.error ?? "چک یافت نشد.");
        return;
      }
      setData(res.data);
      setCompany(mapCompany(res.data.company));
    });
  }, [id]);

  const ch = data?.cheque;

  return (
    <PrintLayout
      title="چک"
      company={company}
      loading={!data && !error}
      error={error}
      meta={ch ? [{ label: "وضعیت", value: statusFa(ch.chequeStatus) }] : []}
    >
      {ch ? (
        <>
          <section className="cheque-face">
            <div className="row">
              <span>
                بانک: <strong>{data?.bank?.bankName ?? "—"}</strong> {data?.bank?.name ? `(${data.bank.name})` : ""}
              </span>
              <span>
                شماره چک: <strong className="ltr">{ch.number}</strong>
              </span>
            </div>
            <div className="row">
              <span>
                شناسه صیاد: <strong className="ltr">{ch.sayadNumber ?? "—"}</strong>
              </span>
              <span>
                تاریخ سررسید: <strong>{formatJalaliDisplay(ch.dueDateJalali)}</strong>
              </span>
            </div>
            <div>
              در وجه: <strong>{data?.counterparty ?? "—"}</strong>
            </div>
            <div>
              مبلغ به حروف: <strong>{rialsInWords(ch.amount)}</strong>
            </div>
            <div className="row">
              <span className="amount">{formatMoneyIrr(ch.amount)} ریال</span>
              <span>
                تاریخ صدور: {formatJalaliDisplay(ch.issueDateJalali)}
              </span>
            </div>
            {data?.bank?.iban ? (
              <div className="muted">
                شبا: <span className="ltr">{data.bank.iban}</span>
              </div>
            ) : null}
          </section>
          {ch.description ? <p>بابت: {ch.description}</p> : null}
          <p className="muted">
            ثبت در سامانه صیاد و استعلام وضعیت چک طبق مقررات بانک مرکزی بر عهده صادرکننده/دارنده است.
          </p>
        </>
      ) : null}
    </PrintLayout>
  );
}
