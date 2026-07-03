// 4 seviyeli tekrar (SRS) sistemi + "Öğrenme Gücü" (learning power) metriği.
// Mantık, kullanıcının verdiği Unity/Firebase scriptindekiyle uyumludur:
// - İlk 2 karşılaşma 2 doğru ile geçtiyse harf "biliyordu" sayılır.
// - 3+ karşılaşmada yanlış cevap ve seviye < 3 ise "biliyordu = false" olur.
// - Seviye 3'e ilk kez ulaştığında ve biliyordu değilse "öğrenildi" anı kaydedilir.
// - Sadece "biliyordu = false" olan harflerin soru süresi öğrenme gücüne katkı verir.

import { useEffect, useState } from "react";
import { findTopicOfItem } from "@/data/subjects";

export type Level = 1 | 2 | 3 | 4;
export type Namespace = "quiz" | "games";

export interface LetterSrsEntry {
  level: Level;
  correct: number;
  total: number;
  seen: number; // bu seviyedeki gösterim sayısı (çeşitlilik için)
  lastSeen: number;

  // Öğrenme gücü için ek alanlar
  totalMs?: number;        // Tüm karşılaşmaların toplam cevap süresi (ms)
  msToLearn?: number;      // Seviye 3'e ulaştığı andaki toplam süre (ms)
  knewBefore?: boolean;    // Daha önce biliyordu mu?
  learnedAt?: number;      // Seviye 3'e ilk ulaştığı epoch ms
}

export type TopicSrs = Record<string, LetterSrsEntry>;
export type SrsState = Record<string, TopicSrs>;

// Aktif kullanıcı kapsamı — farklı hesapların ilerlemesi karışmasın diye
// localStorage anahtarına user_id ekleniyor.
let _activeUid: string | null = null;
const EVENT = (ns: Namespace) => `elifba-srs-${ns}-updated`;
const PROGRESS_EVENT = "elifba-progress-updated";

export function setActiveSrsUser(uid: string | null) {
  _activeUid = uid || null;
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new Event(EVENT("quiz"))); } catch { /* */ }
    try { window.dispatchEvent(new Event(EVENT("games"))); } catch { /* */ }
    try { window.dispatchEvent(new Event(PROGRESS_EVENT)); } catch { /* */ }
  }
}
export function getActiveSrsUser(): string | null { return _activeUid; }

// Local-first: ilerleme verisi cihaza bağlıdır, hesaba değil. Aynı cihazda
// giriş yapsan da yapmasan da aynı önbellek kullanılır (kullanıcı isteği).
const KEY = (ns: Namespace) => `elifba-srs-${ns}-guest-v1`;

export function clearUserLocalSrs(uid: string | null) {
  if (typeof window === "undefined" || !uid) return;
  for (const ns of ["quiz", "games"] as Namespace[]) {
    try { localStorage.removeItem(`elifba-srs-${ns}-${uid}-v1`); } catch { /* */ }
  }
}

// Misafir SRS verisinde kayıt var mı?
export function hasGuestData(): boolean {
  if (typeof window === "undefined") return false;
  for (const ns of ["quiz", "games"] as Namespace[]) {
    try {
      const raw = localStorage.getItem(`elifba-srs-${ns}-guest-v1`)
        || localStorage.getItem(`elifba-srs-${ns}-v1`);
      if (!raw) continue;
      const s = JSON.parse(raw);
      for (const t of Object.values(s)) {
        if (t && Object.keys(t as object).length > 0) return true;
      }
    } catch { /* */ }
  }
  return false;
}

// Cihazdaki ilerleme verisini siler (bulut etkilenmez).
// scope: "active" = giriş yapan kullanıcı önbelleği, "guest" = misafir, "all" = ikisi de.
export function clearLocalProgress(scope: "active" | "guest" | "all") {
  if (typeof window === "undefined") return;
  const targets: string[] = [];
  if (scope === "guest" || scope === "all") targets.push("guest");
  if ((scope === "active" || scope === "all") && _activeUid) targets.push(_activeUid);
  for (const ns of ["quiz", "games"] as Namespace[]) {
    for (const t of targets) {
      try { localStorage.removeItem(`elifba-srs-${ns}-${t}-v1`); } catch { /* */ }
    }
    // Eski (kullanıcısız) anahtarı da temizle
    if (scope === "all" || scope === "guest") {
      try { localStorage.removeItem(`elifba-srs-${ns}-v1`); } catch { /* */ }
    }
    try { window.dispatchEvent(new Event(EVENT(ns))); } catch { /* */ }
  }
  try { window.dispatchEvent(new Event(PROGRESS_EVENT)); } catch { /* */ }
}

function load(ns: Namespace): SrsState {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY(ns)) || "{}"); } catch { return {}; }
}

function save(ns: Namespace, s: SrsState) {
  localStorage.setItem(KEY(ns), JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT(ns)));
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

type CloudLetterRow = {
  topic_id: string;
  letter_id: string;
  shown_count: number;
  correct_count: number;
  wrong_count?: number;
  level: number;
  total_response_ms: number | null;
  learned_at: string | null;
  time_to_learn_ms: number | null;
  knew_before: boolean | null;
  last_seen_at: string | null;
};

function rowToEntry(r: CloudLetterRow): LetterSrsEntry {
  return {
    level: Math.max(1, Math.min(4, r.level || 1)) as Level,
    correct: r.correct_count || 0,
    total: r.shown_count || 0,
    seen: r.shown_count || 0,
    lastSeen: r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0,
    totalMs: r.total_response_ms ?? 0,
    msToLearn: r.time_to_learn_ms ?? undefined,
    knewBefore: r.knew_before ?? undefined,
    learnedAt: r.learned_at ? new Date(r.learned_at).getTime() : undefined,
  };
}

function mergeCloudRowIntoLocal(ns: Namespace, row: CloudLetterRow) {
  if (typeof window === "undefined") return;
  const topicId = normalizeCloudTopic(row);
  const s = load(ns);
  if (!s[topicId]) s[topicId] = {};
  s[topicId][row.letter_id] = rowToEntry(row);
  save(ns, s);
}

function normalizeCloudTopic(row: CloudLetterRow): string {
  return findTopicOfItem(row.letter_id)?.topicId ?? row.topic_id;
}

function putCloudRow(state: SrsState, row: CloudLetterRow) {
  const topicId = normalizeCloudTopic(row);
  if (!state[topicId]) state[topicId] = {};
  const next = rowToEntry(row);
  const prev = state[topicId][row.letter_id];
  if (!prev || next.total > prev.total || (next.total === prev.total && next.lastSeen >= prev.lastSeen)) {
    state[topicId][row.letter_id] = next;
  }
}

export async function hydrateSrsFromCloud(_uid: string) {
  // Local-first: bulut verisi yerel önbelleğin üzerine yazılmaz.
  // Cihazdaki ilerleme tek doğru kaynaktır.
  return;
}

function ensureEntry(s: SrsState, topicId: string, letterId: string): LetterSrsEntry {
  if (!s[topicId]) s[topicId] = {};
  if (!s[topicId][letterId]) {
    s[topicId][letterId] = { level: 1, correct: 0, total: 0, seen: 0, lastSeen: 0, totalMs: 0 };
  }
  return s[topicId][letterId];
}

export function ensureLetters(ns: Namespace, topicId: string, letterIds: string[]) {
  const s = load(ns);
  let changed = false;
  for (const id of letterIds) {
    if (!s[topicId]?.[id]) { ensureEntry(s, topicId, id); changed = true; }
  }
  if (changed) save(ns, s);
}

function waterfallWeights(filledLevels: Level[]): Record<Level, number> {
  const w: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const sorted = [...filledLevels].sort((a, b) => a - b);
  if (sorted.length === 4) { w[1] = 60; w[2] = 15; w[3] = 10; w[4] = 15; }
  else if (sorted.length === 3) { w[sorted[0]] = 70; w[sorted[1]] = 20; w[sorted[2]] = 10; }
  else if (sorted.length === 2) { w[sorted[0]] = 70; w[sorted[1]] = 30; }
  else if (sorted.length === 1) { w[sorted[0]] = 100; }
  return w;
}

export function pickNextLetter(ns: Namespace, topicId: string, letterIds: string[]): string {
  ensureLetters(ns, topicId, letterIds);
  const s = load(ns);
  return pickNextLetterFromTopic(s[topicId] || {}, letterIds);
}

export function pickNextLetterFromTopic(topic: TopicSrs, letterIds: string[]): string {
  const byLevel: Record<Level, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const id of letterIds) {
    const e = topic[id] || { level: 1, seen: 0, lastSeen: 0 };
    byLevel[e.level as Level].push(id);
  }
  const filled: Level[] = ([1, 2, 3, 4] as Level[]).filter((l) => byLevel[l].length > 0);
  if (filled.length === 0) return letterIds[Math.floor(Math.random() * letterIds.length)];
  const w = waterfallWeights(filled);
  const total = filled.reduce((acc, l) => acc + w[l], 0);
  let r = Math.random() * total;
  let chosenLevel: Level = filled[0];
  for (const l of filled) { r -= w[l]; if (r <= 0) { chosenLevel = l; break; } }
  const candidates = byLevel[chosenLevel];
  candidates.sort((a, b) => {
    const ea = topic[a] || { seen: 0, lastSeen: 0 };
    const eb = topic[b] || { seen: 0, lastSeen: 0 };
    if (ea.seen !== eb.seen) return ea.seen - eb.seen;
    return ea.lastSeen - eb.lastSeen;
  });
  const top = Math.max(1, Math.ceil(candidates.length * 0.3));
  return candidates[Math.floor(Math.random() * top)];
}

export interface AnswerMeta {
  responseMs?: number;
  gameId?: string;
}

function dispatchCloudSaveFailure(error: unknown) {
  console.error("Bulut ilerleme kaydı başarısız:", error);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("elifba-progress-save-failed", { detail: error }));
  }
}

function recordLocalSrsAnswer(
  ns: Namespace,
  topicId: string,
  letterId: string,
  correct: boolean,
  meta?: AnswerMeta,
): LetterSrsEntry {
  const s = load(ns);
  const e = ensureEntry(s, topicId, letterId);
  const prevLevel = e.level;
  e.total += 1;
  e.seen += 1;
  e.lastSeen = Date.now();
  if (typeof meta?.responseMs === "number" && meta.responseMs > 0) {
    e.totalMs = (e.totalMs || 0) + Math.min(meta.responseMs, 60_000); // 60sn üst sınır (idle koruma)
  }
  if (correct) {
    e.correct += 1;
    if (e.level < 4) e.level = ((e.level + 1) as Level);
  } else {
    if (e.level > 1) e.level = ((e.level - 1) as Level);
  }

  // "Biliyordu" tespiti (Firebase mantığıyla)
  if (e.total <= 2) {
    // İlk iki karşılaşma 2 doğru ise → zaten biliyordu
    if (e.total === 2) e.knewBefore = (e.correct === 2);
  } else if (!correct && e.level < 3) {
    e.knewBefore = false;
  }

  // "Öğrenildi" anı: seviye 3+ a ilk ulaşıldığında ve biliyor değilse
  if (e.level >= 3 && !e.learnedAt && e.knewBefore !== true) {
    e.learnedAt = Date.now();
    e.msToLearn = e.totalMs || 0;
  }

  save(ns, s);

  // Milestone: seviye yükselişinde
  if (correct && e.level > prevLevel) {
    import("@/lib/analytics").then((m) => m.trackMilestone(topicId, letterId, e.level)).catch(() => {});
  }

  return e;
}

// Cevap kaydet → Local-first: her durumda cihaza yazılır. Giriş yapan
// kullanıcıda ek olarak buluta arka planda yedeklenir (okuma yapılmaz).
export async function recordSrsAnswer(
  ns: Namespace,
  topicId: string,
  letterId: string,
  correct: boolean,
  meta?: AnswerMeta,
): Promise<LetterSrsEntry | null> {
  const entry = recordLocalSrsAnswer(ns, topicId, letterId, correct, meta);
  const uid = getActiveSrsUser();
  if (uid) {
    // Fire-and-forget bulut yedeği — başarısız olsa bile yerel ilerleme korunur.
    import("@/data/cloudSync")
      .then(({ logAnswer }) => logAnswer({ topicId, letterId, correct, gameId: meta?.gameId, responseMs: meta?.responseMs }))
      .catch((error) => dispatchCloudSaveFailure(error));
  }
  return entry;
}

export function getNamespaceStats(ns: Namespace) {
  const s = load(ns);
  let total = 0, correct = 0;
  const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  Object.values(s).forEach((topic) => {
    Object.values(topic).forEach((e) => {
      total += e.total; correct += e.correct; levelCount[e.level] += 1;
    });
  });
  return { total, correct, percent: total === 0 ? 0 : Math.round((correct / total) * 100), levelCount };
}

// Bulut'tan profil-bazlı aggregate. Oturum açık değilse null döner — yerel kullan.
export async function getNamespaceStatsFromCloud(uid: string | null) {
  if (!uid) return null;
  try {
    const state = await getCloudSrsState(uid);
    if (!state) return null;
    let total = 0, correct = 0;
    const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    Object.values(state).forEach((topic) => {
      Object.values(topic).forEach((e) => {
        total += e.total;
        correct += e.correct;
        levelCount[e.level] += 1;
      });
    });
    return { total, correct, percent: total === 0 ? 0 : Math.round((correct / total) * 100), levelCount };
  } catch { return null; }
}

// Bulut'tan tam SRS state (konu+harf bazlı). Oturum yoksa null.
export async function getCloudSrsState(uid: string | null): Promise<SrsState | null> {
  if (!uid) return null;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase
      .from("letter_stats")
      .select("topic_id, letter_id, level, correct_count, shown_count, last_seen_at, total_response_ms, time_to_learn_ms, knew_before, learned_at")
      .eq("user_id", uid);
    if (error || !data) {
      if (error) dispatchCloudSaveFailure(error);
      return null;
    }
    const state: SrsState = {};
    for (const r of data as CloudLetterRow[]) {
      putCloudRow(state, r);
    }
    return state;
  } catch { return null; }
}

// Cihazdaki öğrenme gücü: yeni öğrenilen harflerin ortalama süresi (saniye)
export function getLearningPower(ns: Namespace): {
  learnedCount: number; knewCount: number; avgSeconds: number | null;
} {
  const s = load(ns);
  let totalMs = 0, learnedCount = 0, knewCount = 0;
  Object.values(s).forEach((topic) => {
    Object.values(topic).forEach((e) => {
      if (e.knewBefore === true) knewCount += 1;
      if (e.learnedAt && e.knewBefore !== true && (e.msToLearn || 0) > 0) {
        totalMs += e.msToLearn || 0; learnedCount += 1;
      }
    });
  });
  return {
    learnedCount, knewCount,
    avgSeconds: learnedCount > 0 ? Math.round((totalMs / learnedCount) / 100) / 10 : null,
  };
}

export function getTopicSrs(ns: Namespace, topicId: string): TopicSrs { return load(ns)[topicId] || {}; }

export function getLetterLevel(ns: Namespace, topicId: string, letterId: string): Level {
  const t = load(ns)[topicId]; return (t?.[letterId]?.level ?? 1) as Level;
}

export function resetTopicSrs(ns: Namespace, topicId: string) {
  const s = load(ns); delete s[topicId]; save(ns, s);
}
export function resetNamespace(ns: Namespace) { save(ns, {}); }

export function useSrsTick(ns: Namespace) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    window.addEventListener(EVENT(ns), h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVENT(ns), h); window.removeEventListener("storage", h); };
  }, [ns]);
  return tick;
}

export function recordLetterMastery(_letterId: string, _correct: boolean) { /* no-op */ }
