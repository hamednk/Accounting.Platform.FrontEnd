"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { JalaliDatePicker } from "@/components/ui/JalaliDatePicker";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { todayJalali } from "@/lib/jalali";
import { PROPOSAL_KIND_FA, sendToAssistant, type AiProposal } from "@/lib/assistant";

type Account = { id: string; code: string; name: string };
type DraftResult = { proposalId: string; status: string; warningFa: string; reviewFa?: string; source?: string };
type AiStatus = { enabled: boolean; provider: string; model: string; mode: string; tools?: { name: string; descriptionFa: string }[] };
type ExtractResult = { proposal?: AiProposal | null; mode: string; warningsFa: string[]; summaryFa: string };

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ExtractPanel() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("auto");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  async function extract() {
    setError(null);
    setResult(null);
    if (!text.trim() && !file) {
      setError("متن سند را وارد کنید یا تصویر آن را انتخاب کنید.");
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError("حجم تصویر حداکثر ۴ مگابایت است.");
      return;
    }
    setBusy(true);
    const imageBase64 = file ? await readAsBase64(file) : null;
    const res = await apiSend<ExtractResult>("/api/v1/ai/extract-document", "POST", {
      text: text.trim() || null,
      imageBase64,
      mimeType: file?.type ?? null,
      kind,
      fileName: file?.name ?? null,
    });
    setBusy(false);
    if (res.error || !res.data) setError(res.error ?? "استخراج انجام نشد.");
    else setResult(res.data);
  }

  return (
    <div className="panel stack">
      <h2 style={{ margin: 0 }}>خواندن فاکتور و رسید</h2>
      <p className="muted" style={{ margin: 0 }}>
        متن فاکتور/رسید را بچسبانید یا تصویرش را بدهید. نتیجه یک پیشنهاد سفارش خرید/فروش یا سند هزینه است که در صف بررسی قرار می‌گیرد.
      </p>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void extract();
        }}
      >
        <label style={{ gridColumn: "1 / -1" }}>
          متن سند
          <textarea rows={6} value={text} maxLength={20000} onChange={(e) => setText(e.target.value)} placeholder="مثلاً متن فاکتور فروشنده، شماره اقتصادی، اقلام و مبالغ…" />
        </label>
        <label>
          تصویر (PNG/JPEG/WEBP، اختیاری)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          نوع سند
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="auto">تشخیص خودکار</option>
            <option value="purchase">فاکتور خرید</option>
            <option value="sales">فاکتور فروش</option>
            <option value="expense">رسید هزینه</option>
          </select>
        </label>
        <div style={{ alignSelf: "end" }}>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "در حال خواندن…" : "استخراج و ساخت پیشنهاد"}
          </button>
        </div>
      </form>
      {error ? <ErrorState message={error} onDismiss={() => setError(null)} /> : null}
      {result ? (
        <div className="stack">
          <SuccessBanner message={result.summaryFa || "استخراج انجام شد."} />
          {result.warningsFa.map((w, i) => (
            <p key={i} className="muted" style={{ margin: 0 }}>
              {w}
            </p>
          ))}
          {result.proposal ? (
            <p style={{ margin: 0 }}>
              {PROPOSAL_KIND_FA[result.proposal.kind] ?? result.proposal.kind} به مبلغ {formatMoneyIrr(result.proposal.totalAmount)} ریال ·{" "}
              <Link href={`/ai/proposals?id=${result.proposal.id}`}>بررسی و تأیید</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AiPage() {
  const { workspace } = useWorkspace();
  const [desc, setDesc] = useState("پیشنهاد سند هزینه");
  const [dateJalali, setDateJalali] = useState(todayJalali());
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    void apiGet<AiStatus>("/api/v1/ai/status").then((r) => setStatus(r.data ?? null));
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await apiGetPaged<Record<string, unknown>>("/api/v1/accounts?page=1&pageSize=200&postable=true");
    const list = (res.data?.items ?? []).map((r) => ({ id: String(r.id), code: String(r.code ?? ""), name: String(r.name ?? "") }));
    setAccounts(list);
    setDebitAccountId((prev) => prev || list.find((a) => a.code.startsWith("6") || a.code.startsWith("52"))?.id || list[0]?.id || "");
    setCreditAccountId((prev) => prev || list.find((a) => a.code.startsWith("11"))?.id || list[0]?.id || "");
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function propose() {
    setError(null);
    setResult(null);
    if (!workspace.periodId) {
      setError("دوره مالی را از نوار بالا انتخاب کنید.");
      return;
    }
    if (!debitAccountId || !creditAccountId) {
      setError("حساب‌های بدهکار و بستانکار را انتخاب کنید.");
      return;
    }
    const amt = Number(amount.replace(/,/g, ""));
    setBusy(true);
    const res = await apiSend<DraftResult>("/api/v1/ai/draft-journal", "POST", {
      fiscalPeriodId: workspace.periodId,
      documentDateJalali: dateJalali,
      description: desc,
      lines: [
        { accountId: debitAccountId, description: desc, debit: amt, credit: 0 },
        { accountId: creditAccountId, description: desc, debit: 0, credit: amt },
      ],
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else setResult(res.data ?? null);
  }

  return (
    <AppShell
      title="دستیار هوشمند"
      actions={
        <Link className="btn-ghost" href="/ai/proposals">
          صف پیشنهادها
        </Link>
      }
    >
      <div className="stack">
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            دستیار در همه صفحه‌ها از دکمه پایین صفحه در دسترس است. فقط می‌خواند و پیشنهاد می‌دهد؛ پذیرش پیشنهاد «پیش‌نویس» می‌سازد و ثبت نهایی
            همیشه با کاربر مجاز است.
          </p>
          {status ? (
            <p className="muted" style={{ margin: 0 }}>
              {status.enabled ? (
                <>
                  حالت: مدل زبانی · <span className="ltr">{status.provider} / {status.model}</span>
                </>
              ) : (
                <>حالت: قواعد محلی — برای فعال‌سازی مدل زبانی، بخش Ai را در تنظیمات سرور پر کنید (کلید فقط از طریق secrets/متغیر محیطی).</>
              )}
            </p>
          ) : null}
          {status?.tools?.length ? (
            <details>
              <summary>توانایی‌های دستیار ({status.tools.length})</summary>
              <ul>
                {status.tools.map((t) => (
                  <li key={t.name}>{t.descriptionFa}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="page-actions">
            <button type="button" className="btn-primary" onClick={() => sendToAssistant({ prompt: "خلاصه وضعیت مالی دوره جاری را بگو", autoSend: true })}>
              شروع گفتگو با دستیار
            </button>
          </div>
        </div>

        <ExtractPanel />

        <div className="panel stack">
          <h2 style={{ margin: 0 }}>پیشنهاد سند ساده با بازبینی هوشمند</h2>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void propose();
            }}
          >
            <label>
              شرح
              <textarea className="field-control" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} required />
            </label>
            <label>
              تاریخ شمسی
              <JalaliDatePicker value={dateJalali} onChange={setDateJalali} required />
            </label>
            <label>
              مبلغ (ریال)
              <input className="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>
              حساب بدهکار
              <select value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              حساب بستانکار
              <select value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "در حال بررسی…" : "ساخت پیشنهاد"}
              </button>
            </div>
          </form>
          {error ? <ErrorState message={error} onDismiss={() => setError(null)} /> : null}
          {result ? (
            <div className="stack">
              <SuccessBanner message={result.warningFa} />
              {result.reviewFa ? (
                <p style={{ margin: 0 }}>
                  <strong>بررسی {result.source === "LLM" ? "هوش مصنوعی" : "قاعده‌محور"}: </strong>
                  {result.reviewFa}
                </p>
              ) : null}
              <p style={{ margin: 0 }}>
                <Link href={`/ai/proposals?id=${result.proposalId}`}>بررسی و تأیید پیشنهاد</Link>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
