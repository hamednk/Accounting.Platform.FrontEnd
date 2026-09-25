"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ErrorState } from "@/components/ui/StateViews";

type ConfirmActionProps = {
  title: string;
  consequences: string[];
  reference?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  children: (open: () => void) => React.ReactNode;
};

/** Safe confirmation for post / reverse / close / reopen — never looks like ordinary save. */
export function ConfirmAction({
  title,
  consequences,
  reference,
  confirmLabel = "تأیید عملیات مالی",
  onConfirm,
  children,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setError(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }, [onConfirm]);

  return (
    <>
      {children(() => setOpen(true))}
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <h2 id={titleId}>{title}</h2>
          <p className="confirm-warn">این عملیات مالی است و قابل ذخیرهٔ معمولی نیست.</p>
          {reference ? (
            <p className="confirm-ref">
              مرجع: <span className="ltr">{reference}</span>
            </p>
          ) : null}
          <ul>
            {consequences.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {error ? <ErrorState message={error} onDismiss={() => setError(null)} /> : null}
          <div className="confirm-actions">
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              انصراف
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? "در حال اجرا…" : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
