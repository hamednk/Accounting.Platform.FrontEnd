"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  addJalaliMonths,
  dateToJalali,
  daysInJalaliMonth,
  formatJalaliParts,
  jalaliWeekdayIndex,
  monthNameFa,
  parseJalali,
  todayJalali,
  weekdaysFa,
  type JalaliParts,
} from "@/lib/jalali";

type Props = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
};

export function JalaliDatePicker({
  value,
  onChange,
  required,
  disabled,
  id,
  name,
  "aria-label": ariaLabel,
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseJalali(value);
  const [view, setView] = useState<JalaliParts>(() => selected ?? dateToJalali(new Date()));

  useEffect(() => {
    if (selected) setView({ year: selected.year, month: selected.month, day: 1 });
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first: JalaliParts = { year: view.year, month: view.month, day: 1 };
    const startPad = jalaliWeekdayIndex(first);
    const dim = daysInJalaliMonth(view.year, view.month);
    const list: Array<{ day: number | null; parts?: JalaliParts }> = [];
    for (let i = 0; i < startPad; i += 1) list.push({ day: null });
    for (let d = 1; d <= dim; d += 1) {
      list.push({ day: d, parts: { year: view.year, month: view.month, day: d } });
    }
    while (list.length % 7 !== 0) list.push({ day: null });
    return list;
  }, [view.year, view.month]);

  const display = selected ? formatJalaliParts(selected) : value;

  function pick(parts: JalaliParts) {
    onChange(formatJalaliParts(parts));
    setOpen(false);
  }

  function goToday() {
    const t = todayJalali();
    onChange(t);
    const p = parseJalali(t);
    if (p) setView(p);
    setOpen(false);
  }

  return (
    <div className="jdp" ref={rootRef}>
      <div className="jdp-field">
        <input
          id={inputId}
          name={name}
          className="ltr"
          value={display}
          readOnly
          required={required}
          disabled={disabled}
          aria-label={ariaLabel ?? "تاریخ شمسی"}
          aria-haspopup="dialog"
          aria-expanded={open}
          placeholder="۱۴۰۴/۰۱/۰۱"
          onClick={() => !disabled && setOpen((v) => !v)}
          onFocus={() => !disabled && setOpen(true)}
        />
        <button
          type="button"
          className="jdp-toggle"
          disabled={disabled}
          aria-label="باز کردن تقویم شمسی"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open ? (
        <div className="jdp-pop" role="dialog" aria-label="انتخاب تاریخ شمسی">
          <div className="jdp-nav">
            <button type="button" className="btn-ghost" onClick={() => setView((v) => addJalaliMonths(v, -1))} aria-label="ماه قبل">
              ‹
            </button>
            <div className="jdp-title">
              <select
                aria-label="ماه"
                value={view.month}
                onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value), day: 1 }))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthNameFa(m)}
                  </option>
                ))}
              </select>
              <input
                className="ltr jdp-year"
                aria-label="سال"
                type="number"
                value={view.year}
                onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) || v.year, day: 1 }))}
              />
            </div>
            <button type="button" className="btn-ghost" onClick={() => setView((v) => addJalaliMonths(v, 1))} aria-label="ماه بعد">
              ›
            </button>
          </div>
          <div className="jdp-weekdays">
            {weekdaysFa().map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="jdp-grid">
            {cells.map((c, idx) =>
              c.day && c.parts ? (
                <button
                  key={idx}
                  type="button"
                  className={
                    selected &&
                    selected.year === c.parts.year &&
                    selected.month === c.parts.month &&
                    selected.day === c.parts.day
                      ? "jdp-day is-selected"
                      : "jdp-day"
                  }
                  onClick={() => pick(c.parts!)}
                >
                  {c.day}
                </button>
              ) : (
                <span key={idx} className="jdp-day is-empty" />
              ),
            )}
          </div>
          <div className="jdp-footer">
            <button type="button" className="btn-secondary" onClick={goToday}>
              امروز
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              بستن
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
