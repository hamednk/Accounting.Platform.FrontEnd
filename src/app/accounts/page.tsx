"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ACCOUNT_TYPE, ACCOUNT_TYPE_OPTIONS, accountLevelFa, accountTypeFa } from "@/lib/labels";

type Account = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  parentId: string | null;
  level: string;
  isPostable: boolean;
  isActive: boolean;
};

function mapAccount(r: Record<string, unknown>): Account {
  return {
    id: String(r.id ?? r.Id),
    code: String(r.code ?? r.Code ?? ""),
    name: String(r.name ?? r.Name ?? ""),
    accountType: String(r.accountType ?? r.AccountType ?? ""),
    parentId: (r.parentId ?? r.ParentId ?? null) as string | null,
    level: String(r.level ?? r.Level ?? ""),
    isPostable: Boolean(r.isPostable ?? r.IsPostable),
    isActive: Boolean(r.isActive ?? r.IsActive ?? true),
  };
}

const ACCOUNT_TYPE_BY_NAME: Record<string, number> = ACCOUNT_TYPE;

export default function AccountsPage() {
  const { workspace } = useWorkspace();
  const [tree, setTree] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [selected, setSelected] = useState<Account | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<number>(ACCOUNT_TYPE.Asset);
  const [asChild, setAsChild] = useState(true);
  const [editName, setEditName] = useState("");
  const [moveTarget, setMoveTarget] = useState<string>("");

  const loadTree = useCallback(async () => {
    const res = await apiGet<Record<string, unknown>[]>("/api/v1/accounts/tree");
    if (res.error) {
      setError(res.error);
      return;
    }
    setTree((res.data ?? []).map(mapAccount));
  }, []);

  const loadGrid = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search.trim()) q.set("search", search.trim());
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/accounts?${q.toString()}`);
    if (res.error) {
      setError(res.error);
      setRows([]);
    } else {
      setRows((res.data?.items ?? []).map(mapAccount));
      setTotal(res.data?.totalCount ?? 0);
    }
    setLoading(false);
  }, [page, search]);

  const reload = useCallback(async () => {
    setError(null);
    await Promise.all([loadTree(), loadGrid()]);
  }, [loadTree, loadGrid]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  const children = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const a of tree) {
      const key = a.parentId ?? "root";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((x, y) => x.code.localeCompare(y.code));
    return map;
  }, [tree]);

  function select(a: Account) {
    setSelected(a);
    setEditName(a.name);
    setMoveTarget(a.parentId ?? "");
    setAccountType(ACCOUNT_TYPE_BY_NAME[a.accountType] ?? ACCOUNT_TYPE.Asset);
    setCode(a.code);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace.companyId) {
      setError("ابتدا از نوار بالا یا صفحه راه‌اندازی، شرکت را انتخاب کنید.");
      return;
    }
    setOk(null);
    const parentId = asChild && selected ? selected.id : null;
    const res = await apiSend("/api/v1/accounts", "POST", { code, name, accountType, parentId });
    if (res.error) {
      setError(res.error);
      return;
    }
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
    setName("");
    setOk("حساب ایجاد شد.");
    await reload();
  }

  async function saveSelected(isActive: boolean) {
    if (!selected) return;
    const res = await apiSend(`/api/v1/accounts/${selected.id}`, "PUT", { name: editName, isActive });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk(isActive === selected.isActive ? "حساب ویرایش شد." : isActive ? "حساب فعال شد." : "حساب غیرفعال شد.");
    setSelected({ ...selected, name: editName, isActive });
    await reload();
  }

  async function moveSelected() {
    if (!selected) return;
    const res = await apiSend(`/api/v1/accounts/${selected.id}/move`, "POST", { newParentId: moveTarget || null });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("حساب جابه‌جا شد.");
    await reload();
  }

  async function deleteAccount(account: Account) {
    const res = await apiSend(`/api/v1/accounts/${account.id}`, "DELETE");
    if (res.error) throw new Error(res.error);
    setOk(`حساب ${account.code} حذف شد.`);
    if (selected?.id === account.id) setSelected(null);
    await reload();
  }

  function renderNode(a: Account, depth: number): React.ReactNode {
    const kids = children.get(a.id) ?? [];
    const open = expanded.has(a.id);
    return (
      <li key={a.id}>
        <div
          className={`tree-row${selected?.id === a.id ? " tree-row--active" : ""}${a.isActive ? "" : " muted"}`}
          style={{ paddingInlineStart: `${depth * 1.1}rem` }}
        >
          {kids.length > 0 ? (
            <button type="button" className="tree-toggle" onClick={() => toggle(a.id)} aria-label={open ? "بستن" : "باز کردن"}>
              {open ? "−" : "+"}
            </button>
          ) : (
            <span className="tree-toggle" aria-hidden />
          )}
          <button type="button" className="tree-label" onClick={() => select(a)}>
            <span className="ltr">{a.code}</span> {a.name}
            <small className="muted"> · {accountLevelFa(a.level)}{a.isPostable ? " · قابل ثبت" : ""}</small>
          </button>
        </div>
        {open && kids.length > 0 ? <ul className="tree-list">{kids.map((k) => renderNode(k, depth + 1))}</ul> : null}
      </li>
    );
  }

  const roots = children.get("root") ?? [];
  const headerOptions = tree.filter((a) => a.id !== selected?.id && a.level !== "Detail");

  const columns: GridColumn<Account>[] = [
    { key: "code", header: "کد", ltr: true, render: (r) => r.code },
    { key: "name", header: "نام", render: (r) => r.name },
    { key: "type", header: "نوع", render: (r) => accountTypeFa(r.accountType) },
    { key: "level", header: "سطح", render: (r) => accountLevelFa(r.level) },
    { key: "postable", header: "قابل ثبت", render: (r) => (r.isPostable ? "بله" : "خیر") },
    { key: "active", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "actions",
      header: "اقدام",
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => select(r)}>
            ویرایش
          </button>
          <ConfirmAction
            title="حذف حساب"
            consequences={[
              `حساب ${r.code} حذف می‌شود.`,
              "اگر زیرحساب، گردش سندی یا الگوی تکراری داشته باشد حذف مجاز نیست — غیرفعال کنید.",
            ]}
            reference={r.code}
            confirmLabel="حذف حساب"
            onConfirm={() => deleteAccount(r)}
          >
            {(open) => (
              <button type="button" className="btn-danger btn-sm" onClick={open}>
                حذف
              </button>
            )}
          </ConfirmAction>
          <Link className="btn-ghost btn-sm" href={`/reports/account-ledger?accountId=${r.id}`}>
            دفتر
          </Link>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      title="سرفصل حساب‌ها"
      actions={
        <Link className="btn-secondary" href="/setup">
          راه‌اندازی / سرفصل نمونه
        </Link>
      }
    >
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {!workspace.companyId ? (
          <div className="panel">
            شرکت انتخاب نشده — به <Link href="/setup">راه‌اندازی</Link> بروید.
          </div>
        ) : null}

        <div className="split">
          <section className="panel stack">
            <h2 className="section-title">درخت حساب‌ها</h2>
            {roots.length === 0 ? <p className="muted">حسابی ثبت نشده.</p> : <ul className="tree-list">{roots.map((r) => renderNode(r, 0))}</ul>}
          </section>

          <section className="stack">
            <form className="panel form-grid" onSubmit={createAccount}>
              <h2 className="section-title" style={{ gridColumn: "1 / -1" }}>
                حساب جدید {asChild && selected ? `زیر «${selected.code} ${selected.name}»` : "(سطح گروه)"}
              </h2>
              <label>
                کد حساب
                <input className="ltr" value={code} onChange={(e) => setCode(e.target.value)} required />
              </label>
              <label>
                نام حساب
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                نوع
                <select value={accountType} onChange={(e) => setAccountType(Number(e.target.value))} disabled={asChild && !!selected}>
                  {ACCOUNT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={asChild} onChange={(e) => setAsChild(e.target.checked)} />
                زیرمجموعه حساب انتخاب‌شده
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-primary">
                  ایجاد حساب
                </button>
              </div>
            </form>

            {selected ? (
              <div className="panel form-grid">
                <h2 className="section-title" style={{ gridColumn: "1 / -1" }}>
                  ویرایش <span className="ltr">{selected.code}</span> — {accountLevelFa(selected.level)}
                </h2>
                <label>
                  نام
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </label>
                <div className="page-actions" style={{ alignSelf: "end" }}>
                  <button type="button" className="btn-primary" onClick={() => void saveSelected(selected.isActive)}>
                    ذخیره نام
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void saveSelected(!selected.isActive)}>
                    {selected.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                  <ConfirmAction
                    title="حذف حساب"
                    consequences={[
                      `حساب ${selected.code} حذف می‌شود.`,
                      "در صورت استفاده، حذف مجاز نیست — از غیرفعال‌سازی استفاده کنید.",
                    ]}
                    reference={selected.code}
                    confirmLabel="حذف حساب"
                    onConfirm={() => deleteAccount(selected)}
                  >
                    {(open) => (
                      <button type="button" className="btn-danger btn-sm" onClick={open}>
                        حذف
                      </button>
                    )}
                  </ConfirmAction>
                  <Link className="btn-ghost" href={`/reports/account-ledger?accountId=${selected.id}`}>
                    دفتر معین
                  </Link>
                </div>
                <label>
                  انتقال به زیر
                  <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                    <option value="">— سطح گروه (ریشه) —</option>
                    {headerOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ alignSelf: "end" }}>
                  <button type="button" className="btn-secondary" onClick={() => void moveSelected()}>
                    انتقال
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted panel">برای ویرایش، انتقال یا افزودن زیرحساب، یک حساب را از درخت انتخاب کنید.</p>
            )}
          </section>
        </div>

        <div className="panel">
          <DataGrid
            columns={columns}
            rows={rows}
            totalCount={total}
            page={page}
            pageSize={50}
            onPageChange={setPage}
            filterValue={search}
            onFilterChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            filterPlaceholder="جستجوی کد یا نام…"
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="حسابی ثبت نشده"
          />
        </div>
      </div>
    </AppShell>
  );
}
