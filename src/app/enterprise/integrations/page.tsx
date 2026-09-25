"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiSend } from "@/lib/api";

export default function IntegrationsPage() {
  const [connectorCode, setConnectorCode] = useState("CONN01");
  const [connectorName, setConnectorName] = useState("اتصال نمونه");
  const [connectorId, setConnectorId] = useState("");
  const [payload, setPayload] = useState('{"hello":"world"}');
  const [inboxType, setInboxType] = useState("JournalImport");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/connectors", "POST", {
      code: connectorCode,
      name: connectorName,
      adapterType: "JsonFile",
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setConnectorId(String(res.data.id ?? res.data.Id));
    setOk("اتصال ثبت شد.");
  }

  async function queueExport() {
    if (!connectorId) {
      setError("ابتدا اتصال بسازید.");
      return;
    }
    setOk(null);
    const res = await apiSend("/api/v1/integrations/export", "POST", {
      connectorId,
      code: `EXP-${Date.now().toString().slice(-4)}`,
      payload,
      correlationId: crypto.randomUUID(),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("کار خروجی در صف قرار گرفت.");
  }

  async function queueImport() {
    if (!connectorId) {
      setError("ابتدا اتصال بسازید.");
      return;
    }
    setOk(null);
    const res = await apiSend("/api/v1/integrations/import", "POST", {
      connectorId,
      code: `IMP-${Date.now().toString().slice(-4)}`,
      payload,
      correlationId: crypto.randomUUID(),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("کار ورودی در صف قرار گرفت.");
  }

  async function receiveInbox(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend("/api/v1/integrations/inbox", "POST", {
      idempotencyKey: crypto.randomUUID(),
      messageType: inboxType,
      payload,
      correlationId: crypto.randomUUID(),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("پیام ورودی دریافت شد.");
  }

  return (
    <AppShell title="هاب یکپارچه‌سازی">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>اتصال</h2>
          <form className="form-grid" onSubmit={register}>
            <label>
              کد
              <input className="ltr" value={connectorCode} onChange={(e) => setConnectorCode(e.target.value)} />
            </label>
            <label>
              نام
              <input value={connectorName} onChange={(e) => setConnectorName(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ثبت اتصال
              </button>
            </div>
          </form>
        </section>
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>صف ورود/خروج</h2>
          <label>
            Payload
            <textarea className="ltr" rows={4} value={payload} onChange={(e) => setPayload(e.target.value)} />
          </label>
          <div className="page-actions">
            <button type="button" className="btn-primary" onClick={() => void queueExport()}>
              صف خروجی
            </button>
            <button type="button" className="btn-secondary" onClick={() => void queueImport()}>
              صف ورودی
            </button>
          </div>
        </section>
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>صندوق پیام‌های ورودی</h2>
          <form className="form-grid" onSubmit={receiveInbox}>
            <label>
              نوع پیام
              <input className="ltr" value={inboxType} onChange={(e) => setInboxType(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                دریافت پیام
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
