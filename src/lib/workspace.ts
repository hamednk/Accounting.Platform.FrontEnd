export type WorkspaceState = {
  companyId: string | null;
  companyName: string | null;
  periodId: string | null;
  periodName: string | null;
};

const KEY = "accounting.workspace";

export function readWorkspace(): WorkspaceState {
  if (typeof window === "undefined") {
    return { companyId: null, companyName: null, periodId: null, periodName: null };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { companyId: null, companyName: null, periodId: null, periodName: null };
    return JSON.parse(raw) as WorkspaceState;
  } catch {
    return { companyId: null, companyName: null, periodId: null, periodName: null };
  }
}

export function saveWorkspace(next: WorkspaceState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  if (next.companyId) {
    document.cookie = `company_id=${encodeURIComponent(next.companyId)}; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`;
  }
  if (next.periodId) {
    document.cookie = `period_id=${encodeURIComponent(next.periodId)}; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`;
  }
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
