"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { EmptyState, ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { useCan } from "@/components/auth/AuthGate";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";
import { formatJalaliDisplay, formatMoneyIrr } from "@/lib/format";
import { PROPOSAL_KIND_FA, PROPOSAL_STATUS_FA, PROPOSAL_SOURCE_FA, type AiProposal } from "@/lib/assistant";

type Option = { id: string; label: string };
type JournalLine = { accountId: string | null; accountCode?: string | null; accountName?: string | null; description: string; debit: number; credit: number };
type JournalPayload = { fiscalPeriodId: string; documentDateJalali: string; description: string; lines: JournalLine[] };
type OrderLine = { itemId: string | null; itemCode?: string | null; itemName: string; quantity: number; unitPrice: number };
type OrderPayload = {
  partyId: string | null;
  partyLabel?: string | null;
  partyNationalId?: string | null;
  orderDateJalali: string;
  description: string;
  lines: OrderLine[];
  taxAmount?: number | null;
};

const PAGE_SIZE = 15;
const KIND_PERMISSION: Record<string, string> = {
  Journal: "ACCOUNTING.JOURNAL.DRAFT",
  SalesOrder: "SALES.MANAGE",
  PurchaseOrder: "PURCHASING.MANAGE",
};

function toOptions(items: Record<string, unknown>[]): Option[] {
  return items.map((r) => ({ id: String(r.id), label: `${String(r.code ?? "")} — ${String(r.name ?? "")}` }));
}

function resultLink(p: AiProposal): string | null {
  if (!p.resultDocumentId) return null;
  if (p.kind === "Journal") return `/journals?id=${p.resultDocumentId}`;
  if (p.kind === "SalesOrder") return "/sales";
  if (p.kind === "PurchaseOrder") return "/purchasing";
  return null;
}

function ProposalsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const can = useCan();
  const [status, setStatus] = useState("Pending");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AiProposal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [selected, setSelected] = useState<AiProposal | null>(null);
  const [journal, setJournal] = useState<JournalPayload | null>(null);
  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [parties, setParties] = useState<Option[]>([]);
  const [items, setItems] = useState<Option[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGetPaged<AiProposal>(`/api/v1/ai/proposals?status=${status}&page=${page}&pageSize=${PAGE_SIZE}`);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows(res.data?.items ?? []);
    setTotal(res.data?.totalCount ?? 0);
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback(async (id: string) => {
    setOk(null);
    setError(null);
    const res = await apiGet<AiProposal>(`/api/v1/ai/proposals/${id}`);
    if (res.error || !res.data) {
      setError(res.error ?? "پیشنهاد یافت نشد.");
      return;
    }
    const p = res.data;
    setSelected(p);
    setReason("");
    if (p.kind === "Journal") {
      setJournal(JSON.parse(p.payloadJson) as JournalPayload);
      setOrder(null);
      if (accounts.length === 0) {
        const a = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
        setAccounts(toOptions(a.data?.items ?? []));
      }
    } else {
      setOrder(JSON.parse(p.payloadJson) as OrderPayload);
      setJournal(null);
      const partyPath = p.kind === "SalesOrder" ? "/api/v1/customers" : "/api/v1/vendors";
      const [pr, it] = await Promise.all([
        apiGetPaged<Record<string, unknown>>(`${partyPath}?page=1&pageSize=200`),
        apiGetPaged<Record<string, unknown>>("/api/v1/items?page=1&pageSize=200"),
      ]);
      setParties(toOptions(pr.data?.items ?? []));
      setItems(toOptions(it.data?.items ?? []));
    }
  }, [accounts.length]);

  useEffect(() => {
    if (selectedId) void open(selectedId);
  }, [selectedId, open]);

  function select(id: string) {
    setSelectedId(id);
    router.replace(`/ai/proposals?id=${id}`, { scroll: false });
  }

  const pending = selected?.status === "Pending";
  const allowed = selected ? can(KIND_PERMISSION[selected.kind] ?? "IDENTITY.ADMIN") : false;
  const editable = pending && allowed;

  async function save(): Promise<boolean> {
    if (!selected) return false;
    const payload = journal ?? order;
    const res = await apiSend<AiProposal>(`/api/v1/ai/proposals/${selected.id}`, "PUT", payload);
    if (res.error || !res.data) {
      setError(res.error ?? "ذخیره نشد.");
      return false;
    }
    setSelected(res.data);
    return true;
  }

  async function accept() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    if (!(await save())) {
      setBusy(false);
      return;
    }
    const res = await apiSend<AiProposal>(`/api/v1/ai/proposals/${selected.id}/accept`, "POST");
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "پذیرش انجام نشد.");
      return;
    }
    setSelected(res.data);
    setOk(`پیش‌نویس ${res.data.resultDocumentNumber ?? ""} ساخته شد. ثبت نهایی از صفحه مربوط و طبق گردش تأیید انجام می‌شود.`);
    void load();
  }

  async function reject() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await apiSend<AiProposal>(`/api/v1/ai/proposals/${selected.id}/reject`, "POST", { reason: reason || null });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "رد انجام نشد.");
      return;
    }
    setSelected(res.data);
    setOk("پیشنهاد رد شد.");
    void load();
  }

  const columns: GridColumn<AiProposal>[] = [
    { key: "kind", header: "نوع", render: (r) => PROPOSAL_KIND_FA[r.kind] ?? r.kind },
    {
      key: "title",
      header: "عنوان",
      render: (r) => (
        <button type="button" className="link-button" onClick={() => select(r.id)}>
          {r.title}
        </button>
      ),
    },
    { key: "amount", header: "مبلغ (ریال)", align: "end", render: (r) => formatMoneyIrr(r.totalAmount) },
    { key: "date", header: "تاریخ", render: (r) => formatJalaliDisplay(r.createdAtUtc) },
    { key: "status", header: "وضعیت", render: (r) => PROPOSAL_STATUS_FA[r.status] ?? r.status },
  ];

  const journalDebit = journal?.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) ?? 0;
  const journalCredit = journal?.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) ?? 0;
  const orderTotal = order?.lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0) ?? 0;

  function setJournalLine(i: number, patch: Partial<JournalLine>) {
    setJournal((j) => (j ? { ...j, lines: j.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) } : j));
  }

  function setOrderLine(i: number, patch: Partial<OrderLine>) {
    setOrder((o) => (o ? { ...o, lines: o.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) } : o));
  }

  return (
    <div className="stack">
      <p className="muted">
        پیشنهادهای دستیار هیچ اثری در دفاتر ندارند تا شما آن‌ها را بپذیرید. پذیرش فقط «پیش‌نویس» می‌سازد؛ تأیید و ثبت نهایی مثل همیشه
        از صفحه اسناد یا سفارش‌ها انجام می‌شود.
      </p>
      {error ? <ErrorState message={error} onDismiss={() => setError(null)} /> : null}
      {ok ? <SuccessBanner message={ok} /> : null}
      <div className="proposal-layout">
        <div className="panel stack">
          <label className="inline-field">
            وضعیت
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="Pending">در انتظار بررسی</option>
              <option value="Accepted">پذیرفته</option>
              <option value="Rejected">رد شده</option>
              <option value="">همه</option>
            </select>
          </label>
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="پیشنهادی در این وضعیت نیست"
          />
        </div>

        <div className="panel stack">
          {!selected ? (
            <EmptyState title="یک پیشنهاد را انتخاب کنید" hint="از جدول کناری یا از پیوند داخل گفتگوی دستیار." />
          ) : (
            <>
              <div>
                <h2 style={{ margin: 0 }}>
                  {PROPOSAL_KIND_FA[selected.kind] ?? selected.kind}: {selected.title}
                </h2>
                <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                  {PROPOSAL_STATUS_FA[selected.status] ?? selected.status} · منبع: {PROPOSAL_SOURCE_FA[selected.source] ?? selected.source} · ایجاد: {selected.createdBy}
                  {selected.decidedBy ? ` · تصمیم: ${selected.decidedBy}` : ""}
                </p>
                {selected.notes ? <p className="alert-text">{selected.notes}</p> : null}
                {selected.decisionReason ? <p className="muted">دلیل: {selected.decisionReason}</p> : null}
                {selected.resultDocumentId ? (
                  <p>
                    سند ساخته‌شده: <strong className="ltr">{selected.resultDocumentNumber}</strong>{" "}
                    {resultLink(selected) ? <Link href={resultLink(selected)!}>مشاهده</Link> : null}
                  </p>
                ) : null}
                {pending && !allowed ? <p className="muted">برای پذیرش یا رد این نوع پیشنهاد مجوز ندارید.</p> : null}
              </div>

              {journal ? (
                <fieldset className="stack" disabled={!editable || busy} style={{ border: 0, padding: 0 }}>
                  <div className="form-grid">
                    <label>
                      شرح سند
                      <textarea
                        className="field-control"
                        rows={2}
                        value={journal.description}
                        onChange={(e) => setJournal({ ...journal, description: e.target.value })}
                      />
                    </label>
                    <label>
                      تاریخ
                      <JalaliDatePicker value={journal.documentDateJalali} onChange={(v) => setJournal({ ...journal, documentDateJalali: v })} />
                    </label>
                  </div>
                  <table className="proposal-table">
                    <thead>
                      <tr>
                        <th>حساب</th>
                        <th>شرح</th>
                        <th>بدهکار</th>
                        <th>بستانکار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journal.lines.map((l, i) => (
                        <tr key={i} className={l.accountId ? "" : "is-unresolved"}>
                          <td>
                            <select value={l.accountId ?? ""} onChange={(e) => setJournalLine(i, { accountId: e.target.value || null })}>
                              <option value="">{`انتخاب حساب… (پیشنهاد: ${l.accountCode ?? ""} ${l.accountName ?? ""})`}</option>
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <textarea
                              className="field-control"
                              rows={2}
                              value={l.description}
                              onChange={(e) => setJournalLine(i, { description: e.target.value })}
                            />
                          </td>
                          <td>
                            <input className="ltr" inputMode="numeric" value={l.debit} onChange={(e) => setJournalLine(i, { debit: Number(e.target.value.replace(/,/g, "")) || 0 })} />
                          </td>
                          <td>
                            <input className="ltr" inputMode="numeric" value={l.credit} onChange={(e) => setJournalLine(i, { credit: Number(e.target.value.replace(/,/g, "")) || 0 })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}>جمع {journalDebit === journalCredit ? "(تراز)" : "(ناتراز)"}</td>
                        <td>{formatMoneyIrr(journalDebit)}</td>
                        <td>{formatMoneyIrr(journalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </fieldset>
              ) : null}

              {order ? (
                <fieldset className="stack" disabled={!editable || busy} style={{ border: 0, padding: 0 }}>
                  <div className="form-grid">
                    <label>
                      {selected.kind === "SalesOrder" ? "مشتری" : "تأمین‌کننده"}
                      <select value={order.partyId ?? ""} onChange={(e) => setOrder({ ...order, partyId: e.target.value || null })}>
                        <option value="">{`انتخاب… (پیشنهاد: ${order.partyLabel ?? "نامشخص"})`}</option>
                        {parties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      تاریخ
                      <JalaliDatePicker value={order.orderDateJalali} onChange={(v) => setOrder({ ...order, orderDateJalali: v })} />
                    </label>
                    <label>
                      شرح
                      <textarea
                        className="field-control"
                        rows={2}
                        value={order.description}
                        onChange={(e) => setOrder({ ...order, description: e.target.value })}
                      />
                    </label>
                  </div>
                  <table className="proposal-table">
                    <thead>
                      <tr>
                        <th>کالا</th>
                        <th>مقدار</th>
                        <th>فی (ریال)</th>
                        <th>مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((l, i) => (
                        <tr key={i} className={l.itemId ? "" : "is-unresolved"}>
                          <td>
                            <select value={l.itemId ?? ""} onChange={(e) => setOrderLine(i, { itemId: e.target.value || null })}>
                              <option value="">{`انتخاب کالا… (${l.itemName})`}</option>
                              {items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input className="ltr" inputMode="decimal" value={l.quantity} onChange={(e) => setOrderLine(i, { quantity: Number(e.target.value) || 0 })} />
                          </td>
                          <td>
                            <input className="ltr" inputMode="numeric" value={l.unitPrice} onChange={(e) => setOrderLine(i, { unitPrice: Number(e.target.value.replace(/,/g, "")) || 0 })} />
                          </td>
                          <td>{formatMoneyIrr(Math.round(l.quantity * l.unitPrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3}>جمع</td>
                        <td>{formatMoneyIrr(orderTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {order.taxAmount ? <p className="muted">مالیات و عوارض در سند مبدأ: {formatMoneyIrr(order.taxAmount)} ریال (در فاکتور محاسبه می‌شود)</p> : null}
                </fieldset>
              ) : null}

              {editable ? (
                <div className="stack">
                  <div className="page-actions">
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => void save().then((s) => s && setOk("تغییرات ذخیره شد."))}>
                      ذخیره تغییرات
                    </button>
                    <button type="button" className="btn-primary" disabled={busy} onClick={() => void accept()}>
                      {busy ? "در حال انجام…" : "پذیرش و ساخت پیش‌نویس"}
                    </button>
                  </div>
                  <div className="page-actions">
                    <textarea
                      className="field-control"
                      rows={2}
                      placeholder="دلیل رد (اختیاری)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                    />
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => void reject()}>
                      رد پیشنهاد
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AiProposalsPage() {
  return (
    <AppShell title="پیشنهادهای دستیار">
      <Suspense fallback={null}>
        <ProposalsContent />
      </Suspense>
    </AppShell>
  );
}
