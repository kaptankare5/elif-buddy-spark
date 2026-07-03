// Anonim öğrenme/oyun analitiği. Sadece veli onayı verildiyse sunucuya yazar.
// PII içermez; sadece user_id (auth uid), yaş aralığı, cinsiyet (opsiyonel) ve
// içerik kimlikleri (topic_id, letter_id, game_id) toplanır.
import { supabase } from "@/integrations/supabase/client";
import { getAge, ageBandFor } from "@/lib/age";

const CONSENT_KEY = "miniakil:analytics-consent";
const QUEUE_KEY = "miniakil:analytics-queue";
export const PROFILE_CACHE_KEY = "miniakil:profile-cache";

export type ProfileExtras = {
  age_band?: string | null;
  gender?: string | null;
  analytics_consent?: boolean;
};

export function consentGiven(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch { return false; }
}

export function setConsent(v: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, v ? "1" : "0");
    window.dispatchEvent(new Event("miniakil:consent-changed"));
  } catch { /* ignore */ }
}

function ageBand(): string {
  return ageBandFor(getAge());
}

export function getCachedProfile(): { age_band?: string; gender?: string; consent_at?: string } | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function platform(): string {
  if (typeof window === "undefined") return "web";
  // @ts-expect-error capacitor global
  if (window.Capacitor?.getPlatform) return window.Capacitor.getPlatform();
  return "web";
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ---- Profile (age_band / gender / consent) ----
export async function updateMyProfile(p: ProfileExtras) {
  const userId = await uid();
  if (!userId) return;
  const patch: {
    age_band?: string | null;
    gender?: string | null;
    analytics_consent?: boolean;
    consent_at?: string;
    platform?: string;
  } = { platform: platform() };
  if (p.age_band !== undefined) patch.age_band = p.age_band;
  if (p.gender !== undefined) patch.gender = p.gender;
  if (p.analytics_consent !== undefined) {
    patch.analytics_consent = p.analytics_consent;
    patch.consent_at = new Date().toISOString();
  }
  await supabase.from("profiles").update(patch).eq("user_id", userId);
  try {
    const prev = getCachedProfile() ?? {};
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      ...prev,
      ...(patch.age_band !== undefined ? { age_band: patch.age_band } : {}),
      ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
      ...(patch.consent_at ? { consent_at: patch.consent_at } : {}),
    }));
  } catch { /* ignore */ }
}

// ---- Game sessions ----
export async function startGameSession(gameId: string, topicId?: string | null): Promise<string | null> {
  if (!consentGiven()) return null;
  const userId = await uid();
  if (!userId) return null;
  const { getGameMode } = await import("@/lib/gameMode");
  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      user_id: userId,
      game_id: gameId,
      topic_id: topicId ?? null,
      age_band: ageBand(),
      platform: platform(),
      mode: getGameMode(),
    })
    .select("id")
    .single();
  if (error) return null;
  return data?.id ?? null;
}


export async function endGameSession(
  sessionId: string | null,
  stats: { correct?: number; wrong?: number; score?: number; completed?: boolean; startedAt: number },
) {
  if (!sessionId) return;
  const duration_ms = Math.max(0, Date.now() - stats.startedAt);
  await supabase
    .from("game_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_ms,
      correct: stats.correct ?? 0,
      wrong: stats.wrong ?? 0,
      score: stats.score ?? 0,
      completed: !!stats.completed,
    })
    .eq("id", sessionId);
}

// ---- Screen views ----
export async function trackScreen(path: string, durationMs?: number) {
  if (!consentGiven()) return;
  const userId = await uid();
  if (!userId) return;
  await supabase.from("screen_views").insert({
    user_id: userId,
    path,
    duration_ms: durationMs ?? null,
    age_band: ageBand(),
    platform: platform(),
  });
}

// ---- Learning milestones ----
// SRS seviyesi her ilk-defa-ulaştığında çağrılır. Aynı (user,topic,letter,level)
// için tek satır (UNIQUE). Conflict ignore — sessizce atla.
export async function trackMilestone(topicId: string, letterId: string, level: number) {
  if (!consentGiven()) return;
  const userId = await uid();
  if (!userId) return;
  await supabase.from("learning_milestones").insert({
    user_id: userId,
    topic_id: topicId,
    letter_id: letterId,
    level,
    age_band: ageBand(),
  });
  // Yakalanırsa unique conflict normaldir; sessizce yutarız.
}

// ---- Paywall ----
export type PaywallStep =
  | "viewed"
  | "plan_selected"
  | "checkout_started"
  | "purchased"
  | "abandoned";

export async function trackPaywall(step: PaywallStep, planId?: string | null) {
  if (!consentGiven()) return;
  const userId = await uid();
  if (!userId) return;
  await supabase.from("paywall_events").insert({
    user_id: userId,
    step,
    plan_id: planId ?? null,
    age_band: ageBand(),
    platform: platform(),
  });
}

// ---- Veri silme ----
export async function deleteMyAnalytics(): Promise<{ ok: boolean; error?: string }> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "not_authenticated" };
  const results = await Promise.all([
    supabase.from("game_sessions").delete().eq("user_id", userId),
    supabase.from("screen_views").delete().eq("user_id", userId),
    supabase.from("learning_milestones").delete().eq("user_id", userId),
    supabase.from("paywall_events").delete().eq("user_id", userId),
  ]);
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) return { ok: false, error: firstErr.message };
  return { ok: true };
}

// localStorage tabanlı queue (offline) — basit, gerektiğinde geliştirilir.
export function flushQueue() {
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
}
