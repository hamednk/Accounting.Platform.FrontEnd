import { clearSession, getAccessToken, readSession } from "@/lib/auth";
import { buildProblem, networkProblem, rememberProblem, type ApiProblem } from "@/lib/errors";
import { readWorkspace } from "@/lib/workspace";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type ApiResult<T> = {
  data?: T;
  error?: string;
  problem?: ApiProblem;
  status?: number;
};

function authHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const session = readSession();
  if (session?.user.tenantId) headers["X-Tenant-Id"] = session.user.tenantId;
  const ws = readWorkspace();
  if (ws.companyId) headers["X-Company-Id"] = ws.companyId;
  if (ws.periodId) headers["X-Fiscal-Period-Id"] = ws.periodId;
  if (extra) {
    new Headers(extra).forEach((v, k) => {
      headers[k] = v;
    });
  }
  return headers;
}

function normalizePaged<T>(data: unknown): PagedResult<T> {
  const raw = (data ?? {}) as Record<string, unknown>;
  const items = (raw.items ?? raw.Items ?? []) as T[];
  return {
    items,
    page: Number(raw.page ?? raw.Page ?? 1),
    pageSize: Number(raw.pageSize ?? raw.PageSize ?? items.length),
    totalCount: Number(raw.totalCount ?? raw.TotalCount ?? items.length),
  };
}

let redirectingToLogin = false;

function handleUnauthorized(path: string) {
  if (typeof window === "undefined" || path.startsWith("/api/v1/auth/") || redirectingToLogin) return;
  redirectingToLogin = true;
  clearSession();
  const next = encodeURIComponent(window.location.pathname);
  window.setTimeout(() => {
    window.location.replace(`/login?next=${next}&reason=expired`);
  }, 1200);
}

async function toFailure<T>(res: Response, path: string): Promise<ApiResult<T>> {
  const text = await res.text().catch(() => "");
  let body: Record<string, unknown> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { detail: text.slice(0, 400) };
    }
  }
  const problem = buildProblem(res.status, body, path.startsWith("/api/v1/auth/"));
  if (res.status === 401) handleUnauthorized(path);
  return { error: rememberProblem(problem), problem, status: res.status };
}

function toNetworkFailure<T>(): ApiResult<T> {
  const problem = networkProblem();
  return { error: rememberProblem(problem), problem, status: 0 };
}

/** Parse Problem Details (or plain text) from a failed Response into a user-facing ApiResult. */
export async function apiFailureFromResponse<T = never>(res: Response, path = ""): Promise<ApiResult<T>> {
  return toFailure<T>(res, path);
}

/** Download a binary/text file; on HTTP error returns the same structured error as apiGet/apiSend. */
export async function apiDownload(
  path: string,
  init?: RequestInit & { accept?: string },
): Promise<ApiResult<{ blob: Blob; fileName: string }>> {
  try {
    const headers = authHeaders({
      Accept: init?.accept ?? "*/*",
      ...(init?.headers as Record<string, string> | undefined),
    });
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers,
    });
    if (!res.ok) return toFailure(res, path);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1].replace(/"/g, "")) : path.split("/").pop() ?? "download";
    return { data: { blob, fileName }, status: res.status };
  } catch {
    return toNetworkFailure();
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: authHeaders(init?.headers),
    });
    if (!res.ok) return toFailure<T>(res, path);
    return { data: (await res.json()) as T, status: res.status };
  } catch {
    return toNetworkFailure<T>();
  }
}

export async function apiGetPaged<T>(path: string): Promise<ApiResult<PagedResult<T>>> {
  const res = await apiGet<unknown>(path);
  if (res.error) return { error: res.error, problem: res.problem, status: res.status };
  return { data: normalizePaged<T>(res.data), status: res.status };
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
  idempotencyKey?: string,
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      ...authHeaders(),
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      cache: "no-store",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return toFailure<T>(res, path);
    if (res.status === 204) return { data: undefined as T, status: res.status };
    const text = await res.text();
    return { data: (text ? JSON.parse(text) : undefined) as T, status: res.status };
  } catch {
    return toNetworkFailure<T>();
  }
}

export { API_BASE };
