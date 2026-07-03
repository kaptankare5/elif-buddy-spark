import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { setGamePremium } from "@/pages/games/_shared";
import { hasProEntitlement, addCustomerInfoListener, isNativePlatform } from "@/lib/purchases";

// Artık tek plan: "pro". Geriye dönük uyumluluk için tier alanı kalıyor.
export type PlanTier = "free" | "pro";

interface SubscriptionState {
  isPremium: boolean;
  isAdmin: boolean;
  hasSuperMode: boolean;
  tier: PlanTier;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SubscriptionState>({
  isPremium: false,
  isAdmin: false,
  hasSuperMode: false,
  tier: "free",
  loading: true,
  refresh: async () => {},
});

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const [isRcPro, setIsRcPro] = useState(false);
  const [isLegacySub, setIsLegacySub] = useState(false); // web-only fallback (eski aboneler)
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    // RevenueCat entitlement (native)
    if (isNativePlatform()) {
      try { setIsRcPro(await hasProEntitlement()); } catch { setIsRcPro(false); }
    }
    // Supabase: admin rolü + eski abonelik (web'de RC yoksa devreye girer)
    if (session?.user) {
      const [{ data: sub }, { data: roles }] = await Promise.all([
        supabase.from("subscriptions").select("status, expires_at").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
      ]);
      const active = sub?.status === "active" && (!sub.expires_at || new Date(sub.expires_at) > new Date());
      setIsLegacySub(!!active);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    } else {
      setIsLegacySub(false);
      setIsAdmin(false);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void fetchStatus();
  }, [authLoading, fetchStatus]);

  // RC canlı güncellemeleri dinle
  useEffect(() => {
    let dispose: (() => void) | undefined;
    (async () => {
      dispose = await addCustomerInfoListener((pro) => setIsRcPro(pro));
    })();
    return () => { dispose?.(); };
  }, []);

  const isPremium = isRcPro || isLegacySub || isAdmin;
  const hasSuperMode = isPremium; // Tek plan: pro her şeyi açar
  const tier: PlanTier = isPremium ? "pro" : "free";

  useEffect(() => { setGamePremium(isPremium); }, [isPremium]);

  const value = useMemo(
    () => ({ isPremium, isAdmin, hasSuperMode, tier, loading, refresh: fetchStatus }),
    [isPremium, isAdmin, hasSuperMode, tier, loading, fetchStatus],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSubscription = () => useContext(Ctx);
