"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiSend } from "@/lib/api";
import { formatMoneyIrr } from "@/lib/format";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  ASSISTANT_EVENT,
  PROPOSAL_KIND_FA,
  clipContext,
  toolTitleFa,
  type AiChatResponse,
  type AiProposal,
  type AiToolTrace,
  type AssistantContext,
  type AssistantSendDetail,
} from "@/lib/assistant";

type Msg = { role: "user" | "assistant"; content: string; tools?: AiToolTrace[]; proposals?: AiProposal[]; mode?: string };

/** AppShell remounts per page; keep the conversation across client-side navigation (not across reloads). */
const memory: { messages: Msg[]; open: boolean } = { messages: [], open: false };

const SUGGESTIONS = ["تراز آزمایشی دوره را خلاصه کن", "موجودی کالاها چقدر است؟", "گزارش سنی مطالبات", "مانده حساب بانک"];

/**
 * Global assistant drawer (ADR-007). Reads via server tools; anything it "creates" lands in the proposal queue
 * for a human to review — it has no way to post, close or reopen.
 */
export function AssistantPanel({ title }: { title: string }) {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(memory.open);
  const [messages, setMessages] = useState<Msg[]>(memory.messages);

  useEffect(() => {
    memory.messages = messages;
    memory.open = open;
  }, [messages, open]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageContext, setPageContext] = useState<AssistantContext | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string, ctx?: AssistantContext | null) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setError(null);
    const history: Msg[] = [...messages, { role: "user", content: prompt }];
    setMessages(history);
    setInput("");
    setBusy(true);
    const effective = ctx ?? pageContext;
    const res = await apiSend<AiChatResponse>("/api/v1/ai/chat", "POST", {
      messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      context: {
        page: effective?.page ?? pathname,
        title: effective?.title ?? title,
        companyName: workspace.companyName,
        periodName: workspace.periodName,
        data: clipContext(effective?.data),
      },
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "پاسخی دریافت نشد.");
      return;
    }
    const data = res.data;
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply, tools: data.tools, proposals: data.proposals, mode: data.mode }]);
  }

  const onExternalSend = useEffectEvent((detail: AssistantSendDetail) => {
    setOpen(true);
    if (detail.context) setPageContext(detail.context);
    if (detail.autoSend) void send(detail.prompt, detail.context ?? null);
    else setInput(detail.prompt);
  });

  useEffect(() => {
    function onSend(e: Event) {
      const detail = (e as CustomEvent<AssistantSendDetail>).detail;
      if (detail) onExternalSend(detail);
    }
    window.addEventListener(ASSISTANT_EVENT, onSend);
    return () => window.removeEventListener(ASSISTANT_EVENT, onSend);
  }, []);

  // Page-attached data belongs to the page it came from.
  const [contextPath, setContextPath] = useState(pathname);
  if (contextPath !== pathname) {
    setContextPath(pathname);
    setPageContext(null);
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  return (
    <>
      <button
        type="button"
        className={`assistant-fab${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls="assistant-drawer"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "بستن دستیار" : "دستیار هوشمند"}
      </button>
      <aside id="assistant-drawer" className={`assistant-drawer${open ? " is-open" : ""}`} aria-label="دستیار هوشمند" aria-hidden={!open}>
        <header className="assistant-head">
          <div>
            <strong>دستیار حسابداری</strong>
            <p className="muted assistant-sub">فقط خواندن و پیشنهاد · ثبت نهایی با شما</p>
          </div>
          <div className="assistant-head-actions">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMessages([])} disabled={busy || messages.length === 0}>
              گفتگوی تازه
            </button>
            <button
              type="button"
              className="assistant-close"
              aria-label="بستن دستیار"
              title="بستن"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
        </header>
        <div className="assistant-context muted">
          <span>{pageContext?.title ?? title}</span>
          {workspace.companyName ? <span>{workspace.companyName}</span> : null}
          {workspace.periodName ? <span>{workspace.periodName}</span> : null}
          {pageContext?.data ? <span className="assistant-context-data">داده صفحه پیوست شد</span> : null}
        </div>
        <div className="assistant-log" ref={listRef} role="log" aria-live="polite">
          {messages.length === 0 ? (
            <div className="assistant-empty">
              <p className="muted">سؤال بپرسید یا بخواهید سند/سفارشی پیشنهاد شود. پیشنهادها در صف بررسی می‌مانند.</p>
              <div className="assistant-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="btn-ghost btn-sm" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((m, i) => (
            <div key={i} className={`assistant-msg assistant-msg-${m.role}`}>
              <p className="assistant-text">{m.content}</p>
              {m.tools && m.tools.length > 0 ? (
                <ul className="assistant-tools">
                  {m.tools.map((t, j) => (
                    <li key={j} className={t.ok ? "" : "is-failed"}>
                      {toolTitleFa(t)} — {t.summaryFa}
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.proposals && m.proposals.length > 0 ? (
                <div className="assistant-proposals">
                  {m.proposals.map((p) => (
                    <Link key={p.id} href={`/ai/proposals?id=${p.id}`} className="assistant-proposal">
                      <span>{PROPOSAL_KIND_FA[p.kind] ?? p.kind}: {p.title}</span>
                      <span>{formatMoneyIrr(p.totalAmount)} ریال</span>
                      <span className="assistant-proposal-cta">بررسی و تأیید ←</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {m.mode === "LocalRules" ? <p className="muted assistant-mode">حالت قواعد محلی (مدل زبانی در تنظیمات سرور فعال نیست)</p> : null}
              {m.mode === "ProviderFallback" ? <p className="muted assistant-mode">اتصال مدل ناموفق — پاسخ با قواعد محلی</p> : null}
              {m.mode === "LLM" ? <p className="muted assistant-mode">پاسخ مدل زبانی</p> : null}
            </div>
          ))}
          {busy ? <div className="assistant-msg assistant-msg-assistant assistant-typing">در حال بررسی…</div> : null}
        </div>
        {error ? (
          <p className="assistant-error" role="alert">
            {error}
          </p>
        ) : null}
        <form
          className="assistant-input"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            rows={2}
            maxLength={4000}
            placeholder="مثلاً: سند پرداخت اجاره ۵۰ میلیون ریال از بانک ملت را پیشنهاد بده"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
            ارسال
          </button>
        </form>
      </aside>
    </>
  );
}
