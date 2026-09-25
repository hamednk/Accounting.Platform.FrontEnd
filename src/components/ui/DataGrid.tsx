"use client";

import { useMemo, useState } from "react";
import { EmptyState, LoadingState } from "@/components/ui/StateViews";

export type GridColumn<T> = {
  key: string;
  header: string;
  align?: "start" | "end" | "center";
  ltr?: boolean;
  render: (row: T) => React.ReactNode;
};

export type DataGridProps<T> = {
  columns: GridColumn<T>[];
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  savedViewKey?: string;
};

/** Reusable RTL data grid with server-side page/filter controls. */
export function DataGrid<T>({
  columns,
  rows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  filterValue,
  onFilterChange,
  filterPlaceholder = "جستجو و فیلتر…",
  rowKey,
  loading,
  emptyTitle = "موردی یافت نشد",
  emptyHint = "فیلتر را تغییر دهید یا مورد جدیدی ثبت کنید.",
  savedViewKey,
}: DataGridProps<T>) {
  const [localFilter, setLocalFilter] = useState(filterValue ?? "");
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const savedHint = useMemo(() => {
    if (!savedViewKey || typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(`view:${savedViewKey}`);
    } catch {
      return null;
    }
  }, [savedViewKey]);

  function saveView() {
    if (!savedViewKey || typeof window === "undefined") return;
    window.localStorage.setItem(`view:${savedViewKey}`, localFilter);
  }

  return (
    <div className="data-grid">
      <div className="grid-toolbar">
        {onFilterChange ? (
          <form
            className="grid-filter"
            onSubmit={(e) => {
              e.preventDefault();
              onFilterChange(localFilter);
              onPageChange(1);
            }}
          >
            <label className="sr-only" htmlFor="grid-filter">
              فیلتر
            </label>
            <input
              id="grid-filter"
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
              placeholder={filterPlaceholder}
              autoComplete="off"
            />
            <button type="submit" className="btn-secondary btn-sm">
              اعمال فیلتر
            </button>
            {savedViewKey ? (
              <button type="button" className="btn-ghost btn-sm" onClick={saveView}>
                ذخیره نما
              </button>
            ) : null}
          </form>
        ) : null}
        {savedHint ? <span className="muted">نما ذخیره‌شده: {savedHint}</span> : null}
      </div>

      {loading && rows.length === 0 ? (
        <LoadingState label="در حال بارگذاری جدول…" />
      ) : !loading && rows.length === 0 ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className="table-wrap" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{ textAlign: c.align ?? "start" }}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? "start" }} className={c.ltr ? "ltr" : undefined}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid-pager">
        <button type="button" className="btn-ghost btn-sm" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
          قبلی
        </button>
        <span className="muted">
          صفحه <span className="ltr">{page}</span> از <span className="ltr">{totalPages}</span> ·{" "}
          <span className="ltr">{totalCount}</span> ردیف
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
        </button>
      </div>
    </div>
  );
}
