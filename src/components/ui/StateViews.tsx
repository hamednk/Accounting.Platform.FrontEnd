"use client";

import { useEffect, useRef, useState } from "react";
import { lookupProblem, type ApiProblem, type ErrorKind } from "@/lib/errors";

export function LoadingState({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div className="state-box" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state-box state-empty">
      <div className="state-empty-icon" aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9h18M8 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <strong>{title}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

function AlertIcon({ tone }: { tone: "danger" | "warning" | "info" | "success" }) {
  if (tone === "success") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
        <path d="m7.5 12.5 3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "info") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v4.5M12 17v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function toneFor(kind: ErrorKind | undefined): "danger" | "warning" | "info" {
  if (kind === "validation" || kind === "business" || kind === "conflict" || kind === "notFound") return "warning";
  if (kind === "auth" || kind === "forbidden") return "info";
  return "danger";
}

function looksEnglishNoise(text: string): boolean {
  return /internal\s*server\s*error|an error occurred|http error|^error$/i.test(text);
}

export function ErrorState({
  message,
  problem,
  onRetry,
  onDismiss,
}: {
  message: string;
  problem?: ApiProblem;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const details = problem ?? lookupProblem(message);
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHidden(false);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [message]);

  if (hidden) return null;

  const tone = toneFor(details?.kind);
  const rawText = details?.message ?? message;
  const title =
    details?.title && !looksEnglishNoise(details.title)
      ? details.title
      : looksEnglishNoise(message)
        ? "خطای داخلی سامانه"
        : "خطا در انجام عملیات";
  const text = looksEnglishNoise(rawText)
    ? "عملیات کامل نشد. شرکت و دوره مالی را بررسی کنید؛ اگر ادامه داشت کد پیگیری را به پشتیبانی بدهید."
    : rawText;
  const canRetry = onRetry && details?.kind !== "validation" && details?.kind !== "auth";

  return (
    <div ref={ref} className={`alert alert-${tone}`} role="alert" aria-live="assertive">
      <span className="alert-icon">
        <AlertIcon tone={tone} />
      </span>
      <div className="alert-body">
        <strong className="alert-title">{title}</strong>
        <p className="alert-text">{text}</p>
        {details?.fieldErrors.length ? (
          <ul className="alert-list">
            {details.fieldErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        {details?.code || details?.correlationId || details?.status ? (
          <p className="alert-meta">
            {details.status ? (
              <span>
                وضعیت HTTP: <span className="ltr">{details.status}</span>
              </span>
            ) : null}
            {details.code ? (
              <span>
                کد خطا: <span className="ltr code-chip">{details.code}</span>
              </span>
            ) : null}
            {details.correlationId ? (
              <span>
                کد پیگیری: <span className="ltr">{details.correlationId}</span>
              </span>
            ) : null}
          </p>
        ) : null}
        {(canRetry || onDismiss) && (
          <div className="alert-actions">
            {canRetry ? (
              <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
                تلاش مجدد
              </button>
            ) : null}
          </div>
        )}
      </div>
      <button
        type="button"
        className="alert-close"
        aria-label="بستن پیام"
        onClick={() => {
          setHidden(true);
          onDismiss?.();
        }}
      >
        ×
      </button>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    const t = window.setTimeout(() => setHidden(true), 6000);
    return () => window.clearTimeout(t);
  }, [message]);

  if (hidden) return null;

  return (
    <div className="alert alert-success" role="status" aria-live="polite">
      <span className="alert-icon">
        <AlertIcon tone="success" />
      </span>
      <div className="alert-body">
        <p className="alert-text">{message}</p>
      </div>
      <button type="button" className="alert-close" aria-label="بستن پیام" onClick={() => setHidden(true)}>
        ×
      </button>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title ? <h2 className="panel-title">{title}</h2> : null}
            {description ? <p className="panel-desc muted">{description}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
