"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { ErrorState, SuccessBanner } from "@/components/ui/StateViews";
import { apiGet, apiGetPaged, apiSend } from "@/lib/api";

type UserRow = { id: string; userName: string; displayName: string; email: string; isActive: boolean; roles: string[] };
type Role = { id: string; code: string; name: string; permissions: string[] };
type Perm = { code: string; name: string; group: string };

function pick<T>(r: Record<string, unknown>, k: string): T {
  return (r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)]) as T;
}

const EMPTY_USER = { id: "", userName: "", displayName: "", email: "", password: "", isActive: true, roles: ["CLERK"] as string[] };

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<Perm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [roleForm, setRoleForm] = useState<{ id: string; code: string; name: string; permissions: string[] }>({ id: "", code: "", name: "", permissions: [] });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) q.set("search", search);
    const res = await apiGetPaged<Record<string, unknown>>(`/api/v1/identity/users?${q.toString()}`);
    if (res.error) setError(res.error);
    setUsers(
      (res.data?.items ?? []).map((r) => ({
        id: String(pick(r, "id")),
        userName: String(pick(r, "userName") ?? ""),
        displayName: String(pick(r, "displayName") ?? ""),
        email: String(pick(r, "email") ?? ""),
        isActive: pick<boolean>(r, "isActive") !== false,
        roles: (pick<string[]>(r, "roles") ?? []).map(String),
      })),
    );
    setTotal(res.data?.totalCount ?? 0);
    setLoading(false);
  }, [page, search]);

  const loadRoles = useCallback(async () => {
    const [rRes, pRes] = await Promise.all([
      apiGet<Record<string, unknown>[]>("/api/v1/identity/roles"),
      apiGet<Record<string, unknown>[]>("/api/v1/identity/permissions"),
    ]);
    setRoles(
      (rRes.data ?? []).map((r) => ({
        id: String(pick(r, "id")),
        code: String(pick(r, "code")),
        name: String(pick(r, "name")),
        permissions: (pick<string[]>(r, "permissions") ?? []).map(String),
      })),
    );
    setCatalog((pRes.data ?? []).map((p) => ({ code: String(pick(p, "code")), name: String(pick(p, "name")), group: String(pick(p, "group")) })));
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    const res = form.id
      ? await apiSend(`/api/v1/identity/users/${form.id}`, "PUT", {
          displayName: form.displayName,
          email: form.email,
          isActive: form.isActive,
          roleCodes: form.roles,
        })
      : await apiSend("/api/v1/identity/users", "POST", {
          userName: form.userName,
          password: form.password,
          displayName: form.displayName,
          email: form.email,
          roleCodes: form.roles,
        });
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setOk(form.id ? "کاربر ویرایش شد." : "کاربر ایجاد شد.");
    setForm(EMPTY_USER);
    await loadUsers();
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    const res = await apiSend(`/api/v1/identity/users/${resetFor}/reset-password`, "POST", { newPassword });
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk("رمز عبور تغییر کرد.");
    setResetFor(null);
    setNewPassword("");
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    const body = { code: roleForm.code, name: roleForm.name, permissions: roleForm.permissions };
    const res = roleForm.id
      ? await apiSend(`/api/v1/identity/roles/${roleForm.id}`, "PUT", body)
      : await apiSend("/api/v1/identity/roles", "POST", body);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setOk("نقش ذخیره شد.");
    setRoleForm({ id: "", code: "", name: "", permissions: [] });
    await loadRoles();
  }

  const columns: GridColumn<UserRow>[] = [
    { key: "u", header: "نام کاربری", ltr: true, render: (r) => r.userName },
    { key: "n", header: "نام نمایشی", render: (r) => r.displayName },
    { key: "r", header: "نقش‌ها", render: (r) => r.roles.map((c) => roles.find((x) => x.code === c)?.name ?? c).join("، ") },
    { key: "s", header: "وضعیت", render: (r) => (r.isActive ? "فعال" : "غیرفعال") },
    {
      key: "a",
      header: "اقدام",
      render: (r) => (
        <div className="page-actions">
          <button type="button" className="btn-ghost" onClick={() => setForm({ ...r, password: "" })}>
            ویرایش
          </button>
          <button type="button" className="btn-ghost" onClick={() => setResetFor(r.id)}>
            تغییر رمز
          </button>
        </div>
      ),
    },
  ];

  const groups = Array.from(new Set(catalog.map((p) => p.group)));

  return (
    <AppShell title="کاربران و نقش‌ها">
      <div className="stack">
        {ok ? <SuccessBanner message={ok} /> : null}
        {error ? <ErrorState message={error} /> : null}

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>{form.id ? `ویرایش کاربر ${form.userName}` : "کاربر جدید"}</h2>
          <form className="stack" onSubmit={saveUser}>
            <div className="form-grid">
              <label>
                نام کاربری
                <input className="ltr" value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} required disabled={!!form.id} autoComplete="off" />
              </label>
              <label>
                نام نمایشی
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
              </label>
              <label>
                ایمیل
                <input className="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              {!form.id ? (
                <label>
                  رمز اولیه (حداقل ۸ کاراکتر، حرف و عدد)
                  <input className="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
                </label>
              ) : (
                <label>
                  <span>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال
                  </span>
                </label>
              )}
            </div>
            <fieldset className="stack">
              <legend>نقش‌ها</legend>
              <div className="page-actions">
                {roles.map((r) => (
                  <label key={r.id}>
                    <span>
                      <input type="checkbox" checked={form.roles.includes(r.code)} onChange={() => setForm({ ...form, roles: toggle(form.roles, r.code) })} /> {r.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="page-actions">
              <button type="submit" className="btn-primary">
                {form.id ? "ذخیره" : "ایجاد کاربر"}
              </button>
              {form.id ? (
                <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY_USER)}>
                  انصراف
                </button>
              ) : null}
            </div>
          </form>
        </section>

        {resetFor ? (
          <section className="panel stack">
            <h2 style={{ margin: 0, fontSize: "1rem" }}>تغییر رمز {users.find((u) => u.id === resetFor)?.userName}</h2>
            <form className="form-grid" onSubmit={resetPassword}>
              <label>
                رمز جدید
                <input className="ltr" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
              </label>
              <div className="page-actions" style={{ alignSelf: "end" }}>
                <button type="submit" className="btn-primary">
                  ثبت رمز
                </button>
                <button type="button" className="btn-ghost" onClick={() => setResetFor(null)}>
                  انصراف
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <div className="panel">
          <DataGrid
            columns={columns}
            rows={users}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            filterValue={search}
            onFilterChange={(v) => {
              setPage(1);
              setSearch(v);
            }}
            filterPlaceholder="جستجوی نام کاربری یا نام…"
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="کاربری یافت نشد"
          />
        </div>

        <section className="panel stack">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>نقش‌ها و مجوزها</h2>
          <div className="page-actions">
            {roles.map((r) => (
              <button key={r.id} type="button" className={roleForm.id === r.id ? "btn-secondary" : "btn-ghost"} onClick={() => setRoleForm({ ...r })}>
                {r.name} <span className="ltr muted">({r.code})</span>
              </button>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setRoleForm({ id: "", code: "", name: "", permissions: [] })}>
              + نقش جدید
            </button>
          </div>
          <form className="stack" onSubmit={saveRole}>
            <div className="form-grid">
              <label>
                کد نقش
                <input className="ltr" value={roleForm.code} onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })} required disabled={!!roleForm.id} />
              </label>
              <label>
                نام نقش
                <input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} required />
              </label>
            </div>
            {groups.map((g) => (
              <fieldset key={g}>
                <legend>{g}</legend>
                <div className="page-actions">
                  {catalog
                    .filter((p) => p.group === g)
                    .map((p) => (
                      <label key={p.code} title={p.code}>
                        <span>
                          <input
                            type="checkbox"
                            checked={roleForm.permissions.includes(p.code)}
                            onChange={() => setRoleForm({ ...roleForm, permissions: toggle(roleForm.permissions, p.code) })}
                          />{" "}
                          {p.name}
                        </span>
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
            <div>
              <button type="submit" className="btn-primary">
                ذخیره نقش
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
