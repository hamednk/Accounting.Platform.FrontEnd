"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiGet } from "@/lib/api";
import { readSession } from "@/lib/auth";
import { readWorkspace, saveWorkspace, type WorkspaceState } from "@/lib/workspace";

type Company = { id: string; code: string; name: string };
type Period = { id: string; name: string; periodNumber: number; status: string; startJalali: string; endJalali: string };

type WorkspaceCtx = {
  workspace: WorkspaceState;
  companies: Company[];
  periods: Period[];
  loading: boolean;
  setCompany: (company: Company | null) => void;
  setPeriod: (period: Period | null) => void;
  refresh: () => Promise<void>;
  ready: boolean;
};

const Ctx = createContext<WorkspaceCtx | null>(null);

function normCompany(raw: Record<string, unknown>): Company {
  return {
    id: String(raw.id ?? raw.Id),
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? ""),
  };
}

function normPeriod(raw: Record<string, unknown>): Period {
  return {
    id: String(raw.id ?? raw.Id),
    name: String(raw.name ?? raw.Name ?? ""),
    periodNumber: Number(raw.periodNumber ?? raw.PeriodNumber ?? 0),
    status: String(raw.status ?? raw.Status ?? ""),
    startJalali: String(raw.startJalali ?? raw.StartJalali ?? ""),
    endJalali: String(raw.endJalali ?? raw.EndJalali ?? ""),
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    companyId: null,
    companyName: null,
    periodId: null,
    periodName: null,
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!readSession()) {
      setReady(true);
      return;
    }
    setLoading(true);
    const current = readWorkspace();
    setWorkspace(current);
    const companiesRes = await apiGet<{ items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] }>(
      "/api/v1/companies?page=1&pageSize=100",
    );
    const list = ((companiesRes.data?.items ?? companiesRes.data?.Items ?? []) as Record<string, unknown>[]).map(
      normCompany,
    );
    setCompanies(list);

    let companyId = current.companyId;
    if (companyId && !list.some((c) => c.id === companyId)) companyId = null;
    if (!companyId && list.length > 0) companyId = list[0]!.id;

    let nextPeriods: Period[] = [];
    if (companyId) {
      const periodsRes = await apiGet<{ items?: Record<string, unknown>[]; Items?: Record<string, unknown>[] }>(
        `/api/v1/companies/${companyId}/fiscal-periods?page=1&pageSize=24`,
      );
      nextPeriods = ((periodsRes.data?.items ?? periodsRes.data?.Items ?? []) as Record<string, unknown>[]).map(
        normPeriod,
      );
      setPeriods(nextPeriods);
    } else {
      setPeriods([]);
    }

    let periodId = current.periodId;
    if (periodId && !nextPeriods.some((p) => p.id === periodId)) periodId = null;
    if (!periodId && nextPeriods.length > 0) periodId = nextPeriods[0]!.id;

    const company = list.find((c) => c.id === companyId) ?? null;
    const period = nextPeriods.find((p) => p.id === periodId) ?? null;
    const next: WorkspaceState = {
      companyId: company?.id ?? null,
      companyName: company ? `${company.code} — ${company.name}` : null,
      periodId: period?.id ?? null,
      periodName: period ? period.name : null,
    };
    saveWorkspace(next);
    setWorkspace(next);
    setLoading(false);
    setReady(true);
  }, []);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") {
      setReady(true);
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const setCompany = useCallback(
    (company: Company | null) => {
      const next: WorkspaceState = {
        companyId: company?.id ?? null,
        companyName: company ? `${company.code} — ${company.name}` : null,
        periodId: null,
        periodName: null,
      };
      saveWorkspace(next);
      setWorkspace(next);
      void refresh();
    },
    [refresh],
  );

  const setPeriod = useCallback((period: Period | null) => {
    setWorkspace((prev) => {
      const next = {
        ...prev,
        periodId: period?.id ?? null,
        periodName: period?.name ?? null,
      };
      saveWorkspace(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ workspace, companies, periods, loading, setCompany, setPeriod, refresh, ready }),
    [workspace, companies, periods, loading, setCompany, setPeriod, refresh, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
