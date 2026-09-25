"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiSend } from "@/lib/api";

export default function WorkflowsPage() {
  const [code, setCode] = useState("WF-JE");
  const [name, setName] = useState("تأیید سند حسابداری");
  const [documentType, setDocumentType] = useState("JournalBatch");
  const [requiredApprovals, setRequiredApprovals] = useState("1");
  const [definitionId, setDefinitionId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function createDef(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/workflows", "POST", {
      code,
      name,
      documentType,
      requiredApprovals: Number(requiredApprovals),
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setDefinitionId(String(res.data.id ?? res.data.Id));
    setOk("تعریف گردش‌کار ایجاد شد.");
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!definitionId || !documentId) {
      setError("تعریف و شناسه سند لازم است.");
      return;
    }
    setOk(null);
    const res = await apiSend<Record<string, unknown>>("/api/v1/workflows/start", "POST", {
      definitionId,
      documentId,
    });
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setInstanceId(String(res.data.id ?? res.data.Id));
    setOk("نمونه گردش‌کار شروع شد.");
  }

  async function approve() {
    if (!instanceId) {
      setError("ابتدا گردش‌کار را شروع کنید.");
      return;
    }
    setOk(null);
    const res = await apiSend(`/api/v1/workflows/instances/${instanceId}/approve`, "POST", {
      comment: "تأیید از وب",
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("مرحله تأیید ثبت شد.");
  }

  return (
    <AppShell title="گردش‌کار">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>تعریف</h2>
          <form className="form-grid" onSubmit={createDef}>
            <label>
              کد
              <input className="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label>
              نام
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              نوع سند
              <input className="ltr" value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
            </label>
            <label>
              تعداد تأیید
              <input className="ltr" value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-secondary">
                ایجاد تعریف
              </button>
            </div>
          </form>
        </section>
        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>شروع و تأیید</h2>
          <form className="form-grid" onSubmit={start}>
            <label>
              شناسه سند
              <input className="ltr" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="شناسه سند از لیست اسناد" />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn-primary">
                شروع گردش‌کار
              </button>
            </div>
          </form>
          <button type="button" className="btn-secondary" onClick={() => void approve()}>
            تأیید مرحله
          </button>
        </section>
      </div>
    </AppShell>
  );
}
