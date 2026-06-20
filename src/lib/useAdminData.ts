import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useErrorState } from './useErrorState';
import {
  AdminRpcError,
  fetchAdminStats, fetchAdminUsers, fetchAuditLog, fetchRevenue, fetchFeatureFlags,
  rpcSetUserPlan, rpcSuspendUser, rpcExtendPlan, rpcSetLifetimeSlots,
  rpcSetFeatureFlag, rpcSetUserTest,
  type AdminStats, type AdminUser, type AuditEntry, type AdminRevenue,
  type FeatureFlag, type Plan,
} from './admin';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useAdminData(user: User | null) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const { error, setError, clearError } = useErrorState();

  const [planChanging, setPlanChanging] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [slotsSaving, setSlotsSaving] = useState(false);
  const [flagToggling, setFlagToggling] = useState<string | null>(null);
  const [markingTest, setMarkingTest] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([fetchAdminStats(), fetchAdminUsers()])
      .then(([statsData, usersData]) => {
        if (cancelled) return;
        setIsAdmin(true);
        setStats(statsData);
        setUsers(usersData);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AdminRpcError && e.code === '42501') {
          setIsAdmin(false);
        } else {
          setIsAdmin(false);
          setError(errMsg(e));
        }
      });
    return () => { cancelled = true; };
  }, [user, setError]);

  const loadAuditLog = async () => {
    if (auditLog !== null) return;
    setAuditLoading(true);
    try {
      setAuditLog(await fetchAuditLog());
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setAuditLoading(false);
  };

  const loadRevenue = async () => {
    if (revenue !== null) return;
    try {
      setRevenue(await fetchRevenue());
    } catch (e: unknown) {
      setError(errMsg(e));
    }
  };

  const loadFlags = async () => {
    if (flags !== null) return;
    try {
      setFlags(await fetchFeatureFlags());
    } catch (e: unknown) {
      setError(errMsg(e));
    }
  };

  const handlePlanChange = async (u: AdminUser, next: Plan) => {
    if (next === u.plan) return;
    setPlanChanging(u.id);
    clearError();
    try {
      await rpcSetUserPlan(u.id, next);
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, plan: next } : x) ?? prev);
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setPlanChanging(null);
  };

  const handleSuspend = async (u: AdminUser) => {
    setSuspending(u.id);
    clearError();
    try {
      await rpcSuspendUser(u.id, !u.suspended);
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, suspended: !u.suspended } : x) ?? prev);
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setSuspending(null);
  };

  const handleExtendPlan = async (u: AdminUser) => {
    setExtending(u.id);
    clearError();
    try {
      await rpcExtendPlan(u.id, 7);
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, plan: 'pro' as Plan } : x) ?? prev);
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setExtending(null);
  };

  const handleSaveSlots = async (n: number) => {
    if (isNaN(n) || n < 0) return;
    setSlotsSaving(true);
    clearError();
    try {
      await rpcSetLifetimeSlots(n);
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setSlotsSaving(false);
  };

  const handleToggleFlag = async (key: string, enabled: boolean) => {
    setFlagToggling(key);
    clearError();
    try {
      await rpcSetFeatureFlag(key, enabled);
      setFlags((prev) => prev?.map((f) => f.key === key ? { ...f, enabled } : f) ?? prev);
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setFlagToggling(null);
  };

  const handleMarkTest = async (u: AdminUser) => {
    setMarkingTest(u.id);
    clearError();
    const next = !u.is_test;
    try {
      await rpcSetUserTest(u.id, next);
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, is_test: next } : x) ?? prev);
    } catch (e: unknown) {
      setError(errMsg(e));
    }
    setMarkingTest(null);
  };

  return {
    stats, users, isAdmin, error, clearError,
    auditLog, auditLoading, revenue, flags,
    planChanging, suspending, extending, slotsSaving, flagToggling, markingTest,
    loadAuditLog, loadRevenue, loadFlags,
    handlePlanChange, handleSuspend, handleExtendPlan, handleSaveSlots,
    handleToggleFlag, handleMarkTest,
  };
}
