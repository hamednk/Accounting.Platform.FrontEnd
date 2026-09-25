export type AuthUser = {
  id: string;
  tenantId: string;
  userName: string;
  displayName: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  tokenType: string;
  expiresAtUtc: string;
  user: AuthUser;
  roles: string[];
};

const STORAGE_KEY = "accounting.auth";

function mapUser(raw: Record<string, unknown>): AuthUser {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    tenantId: String(raw.tenantId ?? raw.TenantId ?? ""),
    userName: String(raw.userName ?? raw.UserName ?? ""),
    displayName: String(raw.displayName ?? raw.DisplayName ?? ""),
    email: String(raw.email ?? raw.Email ?? ""),
  };
}

export function saveSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  document.cookie = `access_token=${encodeURIComponent(session.accessToken)}; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`;
  document.cookie = `tenant_id=${encodeURIComponent(session.user.tenantId)}; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = "access_token=; path=/; max-age=0";
  document.cookie = "tenant_id=; path=/; max-age=0";
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession & { user: Record<string, unknown> };
    if (!parsed.accessToken) return null;
    if (parsed.expiresAtUtc && new Date(parsed.expiresAtUtc).getTime() < Date.now()) {
      clearSession();
      return null;
    }
    return {
      ...parsed,
      user: mapUser(parsed.user as unknown as Record<string, unknown>),
    };
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return readSession()?.accessToken ?? null;
}

export function normalizeAuthResponse(data: Record<string, unknown>): AuthSession {
  const userRaw = (data.user ?? data.User ?? {}) as Record<string, unknown>;
  return {
    accessToken: String(data.accessToken ?? data.AccessToken ?? ""),
    tokenType: String(data.tokenType ?? data.TokenType ?? "Bearer"),
    expiresAtUtc: String(data.expiresAtUtc ?? data.ExpiresAtUtc ?? ""),
    user: mapUser(userRaw),
    roles: (data.roles ?? data.Roles ?? []) as string[],
  };
}
