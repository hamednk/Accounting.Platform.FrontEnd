"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";

type ScopeInfo = { code: string; nameFa: string };
type EventInfo = { type: string; nameFa: string };
type Catalog = { events: EventInfo[]; scopes: ScopeInfo[] };

type ClientRow = {
  id: string;
  name: string;
  keyId: string;
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAtUtc?: string | null;
  expiresAtUtc?: string | null;
  revokedAtUtc?: string | null;
  allowedIps?: string | null;
};

type HookRow = {
  id: string;
  url: string;
  description: string;
  events: string[];
  isActive: boolean;
  consecutiveFailures: number;
  disabledReason?: string | null;
};

type DeliveryRow = {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: string;
  attempts: number;
  createdAtUtc: string;
  nextAttemptAtUtc: string;
  lastStatusCode?: number | null;
  lastError?: string | null;
};

function pick<T>(r: Record<string, unknown>, k: string): T {
  return (r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)]) as T;
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function mapClient(r: Record<string, unknown>): ClientRow {
  return {
    id: String(pick(r, "id")),
    name: String(pick(r, "name") ?? ""),
    keyId: String(pick(r, "keyId") ?? ""),
    scopes: asList(pick(r, "scopes")),
    rateLimitPerMinute: Number(pick(r, "rateLimitPerMinute") ?? 60),
    isActive: pick<boolean>(r, "isActive") !== false,
    lastUsedAtUtc: pick(r, "lastUsedAtUtc") as string | null,
    expiresAtUtc: pick(r, "expiresAtUtc") as string | null,
    revokedAtUtc: pick(r, "revokedAtUtc") as string | null,
    allowedIps: pick(r, "allowedIps") as string | null,
  };
}

function mapHook(r: Record<string, unknown>): HookRow {
  return {
    id: String(pick(r, "id")),
    url: String(pick(r, "url") ?? ""),
    description: String(pick(r, "description") ?? ""),
    events: asList(pick(r, "events") ?? pick(r, "eventTypes")),
    isActive: pick<boolean>(r, "isActive") !== false,
    consecutiveFailures: Number(pick(r, "consecutiveFailures") ?? 0),
    disabledReason: pick(r, "disabledReason") as string | null,
  };
}

function mapDelivery(r: Record<string, unknown>): DeliveryRow {
  return {
    id: String(pick(r, "id")),
    subscriptionId: String(pick(r, "subscriptionId")),
    eventType: String(pick(r, "eventType") ?? ""),
    status: String(pick(r, "status") ?? ""),
    attempts: Number(pick(r, "attempts") ?? 0),
    createdAtUtc: String(pick(r, "createdAtUtc") ?? ""),
    nextAttemptAtUtc: String(pick(r, "nextAttemptAtUtc") ?? ""),
    lastStatusCode: pick(r, "lastStatusCode") as number | null,
    lastError: pick(r, "lastError") as string | null,
  };
}

const STATUS_FA: Record<string, string> = {
  Pending: "در انتظار",
  Sending: "در حال ارسال",
  Succeeded: "موفق",
  Failed: "ناموفق",
  DeadLetter: "ناموفق نهایی",
};

const EMPTY_CLIENT = { id: "", name: "", scopes: [] as string[], rateLimitPerMinute: 60, allowedIps: "" };
const EMPTY_HOOK = { id: "", url: "", description: "", events: [] as string[] };

export default function OpenApiAdminPage() {
  const [tab, setTab] = useState<"clients" | "webhooks" | "deliveries">("clients");
  const [catalog, setCatalog] = useState<Catalog>({ events: [], scopes: [] });
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [clientPage, setClientPage] = useState(1);
  const [clientSearch, setClientSearch] = useState("");
  const [hooks, setHooks] = useState<HookRow[]>([]);
  const [hookTotal, setHookTotal] = useState(0);
  const [hookPage, setHookPage] = useState(1);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliverySubId, setDeliverySubId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [hookForm, setHookForm] = useState(EMPTY_HOOK);

  const loadCatalog = useCallback(async () => {
    const res = await apiGet<Record<string, unknown>>("/api/v1/webhooks/catalog");
    if (res.error || !res.data) return;
    const events = ((pick(res.data, "events") as Record<string, unknown>[]) ?? []).map((e) => ({
      type: String(pick(e, "type")),
      nameFa: String(pick(e, "nameFa") ?? pick(e, "type")),
    }));
    const scopes = ((pick(res.data, "scopes") as Record<string, unknown>[]) ?? []).map((s) => ({
      code: String(pick(s, "code")),
      nameFa: String(pick(s, "nameFa") ?? pick(s, "code")),
    }));
    setCatalog({ events, scopes });
  }, []);

  const loadClients = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(clientPage), pageSize: "20" });
    if (clientSearch) q.set("search", clientSearch);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/api-clients?${q}`);
    if (res.error) setError(res.error);
    setClients((res.data?.items ?? []).map(mapClient));
    setClientTotal(res.data?.totalCount ?? 0);
    setLoading(false);
  }, [clientPage, clientSearch]);

  const loadHooks = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(hookPage), pageSize: "20" });
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/webhooks?${q}`);
    if (res.error) setError(res.error);
    setHooks((res.data?.items ?? []).map(mapHook));
    setHookTotal(res.data?.totalCount ?? 0);
    setLoading(false);
  }, [hookPage]);

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(deliveryPage), pageSize: "20" });
    if (deliveryStatus) q.set("status", deliveryStatus);
    if (deliverySubId) q.set("subscriptionId", deliverySubId);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/webhooks/deliveries?${q}`);
    if (res.error) setError(res.error);
    setDeliveries((res.data?.items ?? []).map(mapDelivery));
    setDeliveryTotal(res.data?.totalCount ?? 0);
    setLoading(false);
  }, [deliveryPage, deliveryStatus, deliverySubId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (tab === "clients") void loadClients();
    else if (tab === "webhooks") void loadHooks();
    else void loadDeliveries();
  }, [tab, loadClients, loadHooks, loadDeliveries]);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setRevealedKey(null);
    const body = {
      name: clientForm.name,
      scopes: clientForm.scopes,
      rateLimitPerMinute: clientForm.rateLimitPerMinute,
      allowedIps: clientForm.allowedIps || null,
    };
    if (clientForm.id) {
      const res = await apiSend(`/api/v1/api-clients/${clientForm.id}`, "PUT", body);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("کلاینت به‌روزرسانی شد.");
    } else {
      const res = await apiSend<Record<string, unknown>>("/api/v1/api-clients", "POST", body);
      if (res.error || !res.data) {
        setError(res.error ?? "خطا");
        return;
      }
      setRevealedKey(String(pick(res.data, "apiKey") ?? ""));
      setOk("کلاینت ساخته شد. کلید را همین حالا کپی کنید — دوباره نمایش داده نمی‌شود.");
    }
    setError(null);
    setClientForm(EMPTY_CLIENT);
    await loadClients();
  }

  async function rotateClient(id: string) {
    if (!confirm("کلید فعلی باطل می‌شود و یک کلید جدید ساخته می‌شود. ادامه؟")) return;
    setRevealedKey(null);
    const res = await apiSend<Record<string, unknown>>(`/api/v1/api-clients/${id}/rotate`, "POST");
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setRevealedKey(String(pick(res.data, "apiKey") ?? ""));
    setOk("کلید چرخانده شد. مقدار جدید را همین حالا کپی کنید.");
    await loadClients();
  }

  async function revokeClient(id: string) {
    if (!confirm("این کلید برای همیشه باطل می‌شود. ادامه؟")) return;
    const res = await apiSend(`/api/v1/api-clients/${id}/revoke`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("کلید باطل شد.");
    await loadClients();
  }

  async function saveHook(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setRevealedSecret(null);
    const body = { url: hookForm.url, description: hookForm.description, events: hookForm.events };
    if (hookForm.id) {
      const res = await apiSend(`/api/v1/webhooks/${hookForm.id}`, "PUT", body);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOk("وب‌هوک به‌روزرسانی شد.");
    } else {
      const res = await apiSend<Record<string, unknown>>("/api/v1/webhooks", "POST", body);
      if (res.error || !res.data) {
        setError(res.error ?? "خطا");
        return;
      }
      setRevealedSecret(String(pick(res.data, "secret") ?? ""));
      setOk("وب‌هوک ساخته شد. راز امضا را همین حالا کپی کنید.");
    }
    setError(null);
    setHookForm(EMPTY_HOOK);
    await loadHooks();
  }

  async function rotateSecret(id: string) {
    if (!confirm("راز امضای فعلی باطل می‌شود. ادامه؟")) return;
    const res = await apiSend<Record<string, unknown>>(`/api/v1/webhooks/${id}/rotate-secret`, "POST");
    if (res.error || !res.data) {
      setError(res.error ?? "خطا");
      return;
    }
    setRevealedSecret(String(pick(res.data, "secret") ?? ""));
    setOk("راز امضا چرخانده شد.");
  }

  async function setHookActive(id: string, active: boolean) {
    const res = await apiSend(`/api/v1/webhooks/${id}/${active ? "enable" : "disable"}`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk(active ? "وب‌هوک فعال شد." : "وب‌هوک غیرفعال شد.");
    await loadHooks();
  }

  async function deleteHook(id: string) {
    if (!confirm("این وب‌هوک حذف می‌شود. ادامه؟")) return;
    const res = await apiSend(`/api/v1/webhooks/${id}`, "DELETE");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("وب‌هوک حذف شد.");
    await loadHooks();
  }

  async function testHook(id: string) {
    const res = await apiSend(`/api/v1/webhooks/${id}/test`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("رویداد آزمایشی در صف ارسال قرار گرفت.");
    setTab("deliveries");
    setDeliverySubId(id);
    setDeliveryPage(1);
  }

  async function redeliver(id: string) {
    const res = await apiSend(`/api/v1/webhooks/deliveries/${id}/redeliver`, "POST");
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("ارسال دوباره در صف قرار گرفت.");
    await loadDeliveries();
  }

  const clientColumns: GridColumn<ClientRow>[] = [
    { key: "n", header: "نام", render: (r) => r.name },
    { key: "k", header: "شناسه کلید", ltr: true, render: (r) => r.keyId },
    { key: "s", header: "دسترسی‌ها", render: (r) => r.scopes.map((c) => catalog.scopes.find((x) => x.code === c)?.nameFa ?? c).join("، ") },
    { key: "rate", header: "سقف/دقیقه", ltr: true, render: (r) => String(r.rateLimitPerMinute) },
    { key: "st", header: "وضعیت", render: (r) => (r.revokedAtUtc ? "باطل‌شده" : r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "a",
      header: "اقدام",
      render: (r) => (
        <div className="page-actions">
          <button type="button" className="btn-ghost" disabled={!!r.revokedAtUtc} onClick={() => setClientForm({ id: r.id, name: r.name, scopes: r.scopes, rateLimitPerMinute: r.rateLimitPerMinute, allowedIps: r.allowedIps ?? "" })}>
            ویرایش
          </button>
          <button type="button" className="btn-ghost" disabled={!!r.revokedAtUtc} onClick={() => void rotateClient(r.id)}>
            چرخش کلید
          </button>
          <button type="button" className="btn-ghost" disabled={!!r.revokedAtUtc} onClick={() => void revokeClient(r.id)}>
            ابطال
          </button>
        </div>
      ),
    },
  ];

  const hookColumns: GridColumn<HookRow>[] = [
    { key: "u", header: "نشانی", ltr: true, render: (r) => r.url },
    { key: "e", header: "رویدادها", render: (r) => r.events.map((t) => (t === "*" ? "همه" : catalog.events.find((x) => x.type === t)?.nameFa ?? t)).join("، ") },
    { key: "st", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : `غیرفعال${r.disabledReason ? ` — ${r.disabledReason}` : ""}`) },
    { key: "f", header: "خطاهای پیاپی", ltr: true, render: (r) => String(r.consecutiveFailures) },
    {
      key: "a",
      header: "اقدام",
      render: (r) => (
        <div className="page-actions">
          <button type="button" className="btn-ghost" onClick={() => setHookForm({ id: r.id, url: r.url, description: r.description, events: r.events })}>
            ویرایش
          </button>
          <button type="button" className="btn-ghost" onClick={() => void rotateSecret(r.id)}>
            چرخش راز
          </button>
          <button type="button" className="btn-ghost" onClick={() => void setHookActive(r.id, !r.isActive)}>
            {r.isActive ? "غیرفعال" : "فعال"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => void testHook(r.id)}>
            آزمایش
          </button>
          <button type="button" className="btn-ghost" onClick={() => void deleteHook(r.id)}>
            حذف
          </button>
        </div>
      ),
    },
  ];

  const deliveryColumns: GridColumn<DeliveryRow>[] = [
    { key: "t", header: "رویداد", render: (r) => catalog.events.find((x) => x.type === r.eventType)?.nameFa ?? r.eventType },
    { key: "s", header: "وضعیت", render: (r) => STATUS_FA[r.status] ?? r.status },
    { key: "a", header: "تلاش", ltr: true, render: (r) => String(r.attempts) },
    { key: "c", header: "کد HTTP", ltr: true, render: (r) => (r.lastStatusCode == null ? "—" : String(r.lastStatusCode)) },
    { key: "e", header: "خطا", render: (r) => r.lastError ?? "—" },
    {
      key: "x",
      header: "اقدام",
      render: (r) =>
        r.status === "Succeeded" ? null : (
          <button type="button" className="btn-ghost" onClick={() => void redeliver(r.id)}>
            ارسال دوباره
          </button>
        ),
    },
  ];

  return (
    <AppShell title="API باز و وب‌هوک‌ها">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}

        <div className="page-actions">
          {(
            [
              ["clients", "کلیدهای API"],
              ["webhooks", "وب‌هوک‌ها"],
              ["deliveries", "لاگ ارسال"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "btn-secondary" : "btn-ghost"} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {(revealedKey || revealedSecret) && (
          <section className="panel stack" style={{ borderColor: "var(--accent, #0d7377)" }}>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>مقدار محرمانه — فقط همین‌بار</h2>
            <p className="muted" style={{ margin: 0 }}>
              این مقدار دوباره از سرور قابل بازیابی نیست. آن را در سامانه وب‌سایت خود ذخیره کنید.
            </p>
            <code className="ltr" style={{ wordBreak: "break-all", display: "block", padding: "0.75rem", background: "var(--surface-2, #f4f4f5)" }}>
              {revealedKey ?? revealedSecret}
            </code>
            <div className="page-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedKey ?? revealedSecret ?? "");
                  setOk("کپی شد.");
                }}
              >
                کپی
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setRevealedKey(null);
                  setRevealedSecret(null);
                }}
              >
                پنهان کردن
              </button>
            </div>
          </section>
        )}

        {tab === "clients" ? (
          <>
            <section className="panel stack">
              <h2 style={{ margin: 0, fontSize: "1rem" }}>{clientForm.id ? "ویرایش کلاینت" : "کلاینت جدید (سایت / فروشگاه)"}</h2>
              <form className="stack" onSubmit={saveClient}>
                <div className="form-grid">
                  <label>
                    نام
                    <input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required />
                  </label>
                  <label>
                    سقف درخواست در دقیقه
                    <input
                      className="ltr"
                      type="number"
                      min={1}
                      max={6000}
                      value={clientForm.rateLimitPerMinute}
                      onChange={(e) => setClientForm({ ...clientForm, rateLimitPerMinute: Number(e.target.value) || 60 })}
                    />
                  </label>
                  <label>
                    IPهای مجاز (اختیاری، با ویرگول)
                    <input className="ltr" value={clientForm.allowedIps} onChange={(e) => setClientForm({ ...clientForm, allowedIps: e.target.value })} placeholder="203.0.113.10" />
                  </label>
                </div>
                <fieldset>
                  <legend>دسترسی‌ها (scopes)</legend>
                  <div className="page-actions">
                    {catalog.scopes.map((s) => (
                      <label key={s.code}>
                        <span>
                          <input type="checkbox" checked={clientForm.scopes.includes(s.code)} onChange={() => setClientForm({ ...clientForm, scopes: toggle(clientForm.scopes, s.code) })} /> {s.nameFa}
                          <span className="ltr muted"> ({s.code})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="page-actions">
                  <button type="submit" className="btn-primary" disabled={clientForm.scopes.length === 0}>
                    {clientForm.id ? "ذخیره" : "ایجاد و نمایش کلید"}
                  </button>
                  {clientForm.id ? (
                    <button type="button" className="btn-ghost" onClick={() => setClientForm(EMPTY_CLIENT)}>
                      انصراف
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
            <div className="panel">
              <DataGrid
                columns={clientColumns}
                rows={clients}
                totalCount={clientTotal}
                page={clientPage}
                pageSize={20}
                onPageChange={setClientPage}
                filterValue={clientSearch}
                onFilterChange={(v) => {
                  setClientPage(1);
                  setClientSearch(v);
                }}
                filterPlaceholder="جستجوی نام یا شناسه کلید…"
                rowKey={(r) => r.id}
                loading={loading}
                emptyTitle="کلاینتی ثبت نشده"
              />
            </div>
          </>
        ) : null}

        {tab === "webhooks" ? (
          <>
            <section className="panel stack">
              <h2 style={{ margin: 0, fontSize: "1rem" }}>{hookForm.id ? "ویرایش وب‌هوک" : "وب‌هوک جدید"}</h2>
              <p className="muted" style={{ margin: 0 }}>
                فقط HTTPS. امضا: <span className="ltr">X-Webhook-Signature: t=…,v1=HMACSHA256(secret, &quot;{'{'}t{'}'}.body&quot;)</span>
              </p>
              <form className="stack" onSubmit={saveHook}>
                <div className="form-grid">
                  <label>
                    نشانی HTTPS
                    <input className="ltr" value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} required placeholder="https://shop.example.com/hooks/accounting" />
                  </label>
                  <label>
                    توضیح
                    <textarea
                      className="field-control"
                      rows={2}
                      value={hookForm.description}
                      onChange={(e) => setHookForm({ ...hookForm, description: e.target.value })}
                    />
                  </label>
                </div>
                <fieldset>
                  <legend>رویدادها</legend>
                  <div className="page-actions">
                    <label>
                      <span>
                        <input type="checkbox" checked={hookForm.events.includes("*")} onChange={() => setHookForm({ ...hookForm, events: toggle(hookForm.events, "*") })} /> همه رویدادها
                      </span>
                    </label>
                    {catalog.events.map((ev) => (
                      <label key={ev.type}>
                        <span>
                          <input
                            type="checkbox"
                            checked={hookForm.events.includes(ev.type)}
                            onChange={() => setHookForm({ ...hookForm, events: toggle(hookForm.events, ev.type) })}
                            disabled={hookForm.events.includes("*")}
                          />{" "}
                          {ev.nameFa}
                          <span className="ltr muted"> ({ev.type})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="page-actions">
                  <button type="submit" className="btn-primary" disabled={hookForm.events.length === 0}>
                    {hookForm.id ? "ذخیره" : "ایجاد و نمایش راز"}
                  </button>
                  {hookForm.id ? (
                    <button type="button" className="btn-ghost" onClick={() => setHookForm(EMPTY_HOOK)}>
                      انصراف
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
            <div className="panel">
              <DataGrid columns={hookColumns} rows={hooks} totalCount={hookTotal} page={hookPage} pageSize={20} onPageChange={setHookPage} rowKey={(r) => r.id} loading={loading} emptyTitle="وب‌هوکی ثبت نشده" />
            </div>
          </>
        ) : null}

        {tab === "deliveries" ? (
          <>
            <section className="panel form-grid">
              <label>
                وضعیت
                <select value={deliveryStatus} onChange={(e) => { setDeliveryPage(1); setDeliveryStatus(e.target.value); }}>
                  <option value="">همه</option>
                  {Object.entries(STATUS_FA).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                شناسه اشتراک (اختیاری)
                <input className="ltr" value={deliverySubId} onChange={(e) => { setDeliveryPage(1); setDeliverySubId(e.target.value); }} />
              </label>
            </section>
            <div className="panel">
              <DataGrid columns={deliveryColumns} rows={deliveries} totalCount={deliveryTotal} page={deliveryPage} pageSize={20} onPageChange={setDeliveryPage} rowKey={(r) => r.id} loading={loading} emptyTitle="ارسالی ثبت نشده" />
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
