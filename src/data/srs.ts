// 4 seviyeli tekrar (SRS) sistemi + "Öğrenme Gücü" (learning power) metriği.
// Mantık, kullanıcının verdiği Unity/Firebase scriptindekiyle uyumludur:
// - İlk 2 karşılaşma 2 doğru ile geçtiyse harf "biliyordu" sayılır.
// - 3+ karşılaşmada yanlış cevap ve seviye < 3 ise "biliyordu = false" olur.
// - Seviye 3'e ilk kez ulaştığında ve biliyordu değilse "öğrenildi" anı kaydedilir.
// - Sadece "biliyordu = false" olan harflerin soru süresi öğrenme gücüne katkı verir.

import { useEffect, useState } from "react";
import { findTopicOfItem, flattenItems } from "@/data/subjects";

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
  consecutiveCorrect?: number; // Aynı harfte üst üste doğru sayısı (yanlışta sıfırlanır) — L4 mandalı için

  // Akıcılık (tepki süresi) sinyali — bilim: doğru ama YAVAŞ cevap kırılgan
  // izdir (erişim gücü düşük); hızlı+doğru = otomatiklik. Latency, gelecekteki
  // hatırlamayı öngörür (Pavlik & Anderson; erişim gücü, Bjork).
  lastMs?: number;         // son cevap süresi (ms)
  fragile?: boolean;       // doğru ama yavaş → önce geri getir (bakım önceliği)

  // FSRS-lite (yarı-ömür modeli, Duolingo HLR / FSRS DSR'den sadeleştirilmiş):
  // stab = hafızanın YARI-ÖMRÜ (gün): hatırlama olasılığı R = 2^(−geçenGün/stab).
  // Doğru geri getirme stab'ı BÜYÜTÜR — tam unutmak üzereyken (R düşük) doğruysa
  // ÇOK büyütür (istenen zorluk, Bjork); taze tekrarda az büyür (ezber kramponu
  // işe yaramaz). Yanlış stab'ı küçültür. Seçici bileti (1−R)'ye göre verir →
  // "en unutulmak üzere olan önce". Seviye merdiveni UI/kilit için aynen kalır.
  stab?: number;           // yarı-ömür (gün)
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
//
// HOCA MODU: cihazda birden çok öğrenci profili tutulabilir. Aktif öğrenci
// seçiliyken tüm SRS okuma/yazma o öğrencinin anahtarına gider — harf
// seviyeleri, kilitli bölümler, konu ilerlemesi öğrenciye özeldir ve
// geçişte kaldığı yerden devam eder. null = cihaz sahibi (varsayılan).
let _activeStudent: string | null = null;
try {
  if (typeof window !== "undefined") {
    _activeStudent = localStorage.getItem("elifba-active-student-v1") || null;
  }
} catch { /* ignore */ }

export function setActiveStudentScope(sid: string | null) {
  _activeStudent = sid || null;
  if (typeof window === "undefined") return;
  try {
    if (sid) localStorage.setItem("elifba-active-student-v1", sid);
    else localStorage.removeItem("elifba-active-student-v1");
  } catch { /* ignore */ }
  // Tüm ekranlar (Index/Topic/Flashcard/oyun havuzu) yeni öğrencinin
  // verileriyle tazelensin.
  try { window.dispatchEvent(new Event(EVENT("quiz"))); } catch { /* */ }
  try { window.dispatchEvent(new Event(EVENT("games"))); } catch { /* */ }
  try { window.dispatchEvent(new Event(PROGRESS_EVENT)); } catch { /* */ }
}
export function getActiveStudentScope(): string | null { return _activeStudent; }

const KEY = (ns: Namespace) =>
  _activeStudent
    ? `elifba-srs-${ns}-student-${_activeStudent}-v1`
    : `elifba-srs-${ns}-guest-v1`;

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
  // Yerleştirme (atlanan konu / ara-kontrol) verisini de temizle — sıfırlanan
  // çocukta konular hâlâ "atlanmış" görünmesin. (placement.ts import etmeden,
  // döngüsel bağımlılık olmasın diye anahtar doğrudan silinir.)
  if (scope === "guest" || scope === "all") {
    try { localStorage.removeItem("elifba-placement-guest-v1"); } catch { /* */ }
  }
  if (_activeStudent) {
    try { localStorage.removeItem(`elifba-placement-student-${_activeStudent}-v1`); } catch { /* */ }
  }
  try { window.dispatchEvent(new Event("elifba-placement-updated")); } catch { /* */ }
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

// Seviye ağırlıkları — "%85 kuralı"na (Wilson ve ark. 2019: optimal öğrenme
// ~%15 hata oranında gerçekleşir) yaklaşmak için düşük seviyeli (zorlanılan)
// öğeler ağırlıklı sorulur; ustalaşılanlar (L3-L4) düşük oranda "bakım
// tekrarı" olarak karışır (aralıklı tekrar + serpiştirme: eski bölümlerin
// harfleri hiç kaybolmaz, seyrek geri gelir → unutma eğrisi kırılır).
function waterfallWeights(filledLevels: Level[]): Record<Level, number> {
  const w: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const sorted = [...filledLevels].sort((a, b) => a - b);
  if (sorted.length === 4) { w[1] = 55; w[2] = 20; w[3] = 10; w[4] = 15; }
  else if (sorted.length === 3) { w[sorted[0]] = 65; w[sorted[1]] = 25; w[sorted[2]] = 10; }
  else if (sorted.length === 2) { w[sorted[0]] = 70; w[sorted[1]] = 30; }
  else if (sorted.length === 1) { w[sorted[0]] = 100; }
  return w;
}

export function pickNextLetter(ns: Namespace, topicId: string, letterIds: string[]): string {
  ensureLetters(ns, topicId, letterIds);
  const s = load(ns);
  return pickNextLetterFromTopic(s[topicId] || {}, letterIds);
}

// Son sorulan öğe — aynı sorunun art arda gelmesini önler (ardışık tekrar
// yerine aralıklı geri getirme: Cepeda 2006). Modül düzeyinde tutulur;
// test/flashcard/oyunlar ardışık çağırdığı için tek değer yeterli.
let _lastPickedId: string | null = null;

// Kur'an sıklığı biletleri: çekirdek müfredat öğeleri 3 (yüksek ve eşit);
// yalnız Ekstralar item.weight ile 2/1'e iner. Seviye şelalesini DEĞİŞTİRMEZ —
// ağırlık sadece aynı seviyedeki adaylar arasında bilet sayısını belirler
// (en fazla 3:1; zayıflık her zaman daha güçlü bilet).
let _weightMap: Map<string, number> | null = null;
function itemWeight(id: string): number {
  if (!_weightMap) {
    _weightMap = new Map();
    for (const it of flattenItems()) if (it.weight) _weightMap.set(it.id, it.weight);
  }
  return _weightMap.get(id) ?? 3;
}

// UYARLANIR ZORLUK (akış / "%85 kuralı"): son cevapların doğruluğuna göre
// seviye şelalesini NAZİKÇE eğer — çocuğu akış kanalında tutar. Çok zorlanınca
// (doğruluk düşük) bilinen/kolay öğelere kayar (güven toplatır, oranı yukarı
// çeker); çok kolaysa (uçuyorsa) zayıf/yeni öğelerle zorlar. Merkezi tek yer:
// tüm oyunlara + testlere etki eder. Seviye ilerlemesini değiştirmez; sadece
// bir sonraki sorunun seviyesini seçme olasılığını kaydırır. Geçici — doğruluk
// normale dönünce ağırlıklar da normale döner (zayıf öğeler kaybolmaz).
const _recent: boolean[] = [];
function pushRecent(correct: boolean) {
  _recent.push(correct);
  if (_recent.length > 12) _recent.shift();
}
function recentAccuracy(): number | null {
  if (_recent.length < 6) return null; // güvenilir sinyal için en az 6 cevap
  return _recent.reduce((a, b) => a + (b ? 1 : 0), 0) / _recent.length;
}

// ---- DEBUG (yalnız test modunda HUD'da gösterilir) ----
// Uyarlanır zorluğun elle doğrulanması için: anlık doğruluk + hangi bantta.
export interface AdaptiveDebug { count: number; accuracy: number | null; band: string; recent: boolean[] }
export function getAdaptiveDebug(): AdaptiveDebug {
  const acc = recentAccuracy();
  let band: string;
  if (_recent.length < 4) band = "ISINMA (kolay)";
  else if (acc === null) band = "— (veri az)";
  else if (acc < 0.70) band = "ZORLANIYOR → kolaylaştı";
  else if (acc > 0.92) band = "UÇUYOR → zorlaştı";
  else band = "NORMAL (~%85)";
  return { count: _recent.length, accuracy: acc, band, recent: [..._recent] };
}
// Akıcılık eşiği: bu süreden (ms) uzun doğru cevap "yavaş/kırılgan" sayılır.
// Çocuk sesi dinleyip dokunuyor → taban ~2sn; 5sn üstü gerçekten tereddüt.
const FLUENT_MS = 5000;

// ---- FSRS-lite (yarı-ömür) parametreleri ----
const HL_MIN = 0.25;        // gün — dip (yanlış sonrası bile sıfırlanmaz)
const HL_MAX = 90;          // gün — tavan
const HL_FIRST_FLUENT = 0.7;   // ilk başarılı geri getirme (hızlı)
const HL_FIRST_SLOW = 0.4;     // ilk başarılı geri getirme (yavaş)
const HL_FIRST_WRONG = 0.25;   // ilk karşılaşma yanlış
const HL_GROWTH = 2.2;      // büyüme katsayısı: S *= 1 + G·(1−R)·akıcılık
const HL_MIN_GROWTH = 1.15; // taze tekrarda bile küçük ilerleme (kaçış payı)
const HL_WRONG_SHRINK = 0.3;

// Eski kayıtlarda stab yok → seviyeden makul yarı-ömür türet (göç köprüsü).
function deriveStab(e: LetterSrsEntry | undefined): number {
  if (!e) return HL_MIN;
  if (typeof e.stab === "number" && e.stab > 0) return e.stab;
  return e.level >= 4 ? 7 : e.level === 3 ? 3 : e.level === 2 ? 1 : 0.4;
}

// Şu anki hatırlama olasılığı R (0..1). Hiç görülmemişse 0 (en acil).
export function retrievabilityOf(e: LetterSrsEntry | undefined, now: number): number {
  if (!e || !e.lastSeen || (e.seen ?? 0) === 0) return 0;
  const days = Math.max(0, (now - e.lastSeen) / 86_400_000);
  const r = Math.pow(2, -days / deriveStab(e));
  return r < 0 ? 0 : r > 1 ? 1 : r;
}

// ---- Akış bandı (tek merkez) — seçici, K kapısı ve bakım payı bunu kullanır ----
export type FlowBand = "warmup" | "struggling" | "normal" | "flying";
export function getFlowBand(): FlowBand {
  if (_recent.length < 4) return "warmup";
  const acc = recentAccuracy();
  if (acc === null) return "warmup";
  if (acc < 0.70) return "struggling";
  if (acc > 0.92) return "flying";
  return "normal";
}

// Son seçilen öğenin "neden seçildiği": seviye + bilet (sıklık × aciliyet × kırılganlık).
// stale alanı artık ACİLİYET çarpanıdır (1 + 2·(1−R)); retr/hl FSRS-lite gözlemi.
export interface LastPickInfo {
  id: string; level: number; weight: number; stale: number; ticket: number; days: number;
  fragile?: boolean; retr?: number; hl?: number;
}
let _lastPickInfo: LastPickInfo | null = null;
export function getLastPickInfo(): LastPickInfo | null { return _lastPickInfo; }

// ÖĞRENME SETİ KAPISI (Problem 1 — bilişsel yük + akış): Aynı anda "öğrenilmekte
// olan" (görülmüş ama L3'e ulaşmamış) harf sayısı K'yı geçtiyse YA DA çocuk
// zorlanıyorsa (akış bandı düşük), sistem YENİ harf TANITMAZ — eldeki set
// pekişene kadar üzerine yük bindirmez. Çocuk çalışma belleği sınırlıdır
// (Miller/Sweller); zorlanırken yeni sembol akıtmak akışı kırar, bırakmayı
// tetikler. Set boşalınca (bir harf L3+ olunca) ve doğruluk toparlayınca
// sıradaki harf müfredat sırasıyla tanıtılır.
export const LEARNING_SET_K = 3;
export interface IntroGateInfo {
  inProgress: number;  // görülmüş ama L3'e ulaşmamış (öğrenilmekte)
  k: number;
  struggling: boolean; // son doğruluk < %70
  gated: boolean;      // yeni harf tanıtımı şu an bastırıldı mı
  nextUnseen: string | null;
}
let _introGate: IntroGateInfo | null = null;
export function getIntroGateInfo(): IntroGateInfo | null { return _introGate; }

// Yalnız test/simülasyon için: seçicinin modül-düzeyi global durumunu sıfırla
// (uyarlanır band tamponu + son seçim izleri). Üretim akışında çağrılmaz.
export function __resetSelectorState() {
  _recent.length = 0;
  _lastPickedId = null;
  _lastPickInfo = null;
  _introGate = null;
}

export function pickNextLetterFromTopic(topic: TopicSrs, letterIds: string[]): string {
  // 1) Öğrenme seti kapısı: kaç harf "öğrenilmekte" (görülmüş, L3 altı) + ilk
  //    görülmemiş harf hangisi? (müfredat sırası korunur — i+1 ilkesi).
  let inProgress = 0;
  let seenCount = 0;
  let firstUnseen: string | null = null;
  for (const id of letterIds) {
    const e = topic[id];
    const seen = (e?.seen ?? 0) > 0;
    if (!seen) { if (firstUnseen === null) firstUnseen = id; continue; }
    seenCount++;
    if (((e?.level ?? 1) as Level) < 3) inProgress++;
  }
  const band = getFlowBand();
  const struggling = band === "struggling";
  // DİNAMİK K: uçarken (yüksek doğruluk) set genişler → yeni harf daha erken
  // gelir (zorlaşma = taze içerik); normalde 3. Zorlanırken kapı zaten kapalı.
  const effK = band === "flying" ? LEARNING_SET_K + 2 : LEARNING_SET_K;
  // Set dolu veya zorlanıyorsa yeni harf tanıtma. Ama hiç görülmüş harf yoksa
  // (taze konu) kapı çalışmaz — başlamak için ilk harf her zaman tanıtılır.
  const gateNew = seenCount > 0 && (inProgress >= effK || struggling);
  const introduce = firstUnseen !== null && !gateNew;
  _introGate = {
    inProgress, k: effK, struggling,
    gated: firstUnseen !== null && gateNew, nextUnseen: firstUnseen,
  };
  if (introduce && firstUnseen) {
    _lastPickedId = firstUnseen;
    _lastPickInfo = { id: firstUnseen, level: 0, weight: itemWeight(firstUnseen), stale: 1, ticket: 0, days: 0 };
    return firstUnseen;
  }

  // Kapı kapalıysa seçim YALNIZ görülmüş harfler arasında yapılır — yeni harfler
  // sırada bekler, eldeki set pekişir.
  const pickIds = seenCount > 0 ? letterIds.filter((id) => (topic[id]?.seen ?? 0) > 0) : letterIds;

  const byLevel: Record<Level, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const id of pickIds) {
    const e = topic[id] || { level: 1, seen: 0, lastSeen: 0 };
    byLevel[e.level as Level].push(id);
  }
  const filled: Level[] = ([1, 2, 3, 4] as Level[]).filter((l) => byLevel[l].length > 0);
  if (filled.length === 0) return pickIds[Math.floor(Math.random() * pickIds.length)];
  const w = waterfallWeights(filled);
  // Isınma + uyarlanır zorluk (seans yayı): ~%85 akış kanalını korur.
  const acc = recentAccuracy();
  if (filled.length > 1) {
    if (_recent.length < 4) {
      // ISINMA (seans başı, fresh açılış): kolay galibiyetler — alışkanlık
      // bilimi: en zor kısım BAŞLAMAK; düşük aktivasyon enerjisi = güçlü alışkanlık.
      w[1] *= 0.75; w[3] *= 1.2; w[4] *= 1.4;
    } else if (acc !== null) {
      if (acc < 0.70) { w[1] *= 0.55; w[2] *= 0.85; w[3] *= 1.4; w[4] *= 1.8; }   // zorlanıyor → kolaylaş
      else if (acc > 0.92) { w[1] *= 1.5; w[2] *= 1.2; w[3] *= 0.9; w[4] *= 0.55; } // uçuyor → zorlaş
    }
  }
  const total = filled.reduce((acc2, l) => acc2 + w[l], 0);
  let r = Math.random() * total;
  let chosenLevel: Level = filled[0];
  for (const l of filled) { r -= w[l]; if (r <= 0) { chosenLevel = l; break; } }

  // 2) Aynı öğe art arda gelmesin — seçilen seviyede başka aday varsa
  //    sonuncuyu ele; o seviyede tek aday oysa tüm havuzdan ele.
  let candidates = byLevel[chosenLevel];
  if (pickIds.length > 1) {
    const without = candidates.filter((id) => id !== _lastPickedId);
    if (without.length > 0) candidates = without;
    else candidates = pickIds.filter((id) => id !== _lastPickedId);
  }

  candidates = [...candidates].sort((a, b) => {
    const ea = topic[a] || { seen: 0, lastSeen: 0 };
    const eb = topic[b] || { seen: 0, lastSeen: 0 };
    if (ea.seen !== eb.seen) return ea.seen - eb.seen;
    return ea.lastSeen - eb.lastSeen; // en uzun süredir görülmeyen önce (aralık etkisi)
  });
  // En taze yarıdan çekiliş. Bilet = Kur'an sıklığı × ACİLİYET çarpanı.
  // FSRS-lite: aciliyet = 1 + 2·(1−R); R = 2^(−gün/yarıÖmür). Yani "en
  // unutulmak üzere olan" öğe en çok bileti alır — sabit takvim (3.5 gün)
  // yerine ÖĞEYE ÖZEL unutma eğrisi. Zayıf öğe (kısa yarı-ömür) saatler
  // içinde acilleşir; sağlam öğe (uzun yarı-ömür) haftalarca beklerse de
  // unutulmadan tam vaktinde geri gelir. Seviye seçimi değişmez.
  const now = Date.now();
  const urgMult = (id: string): number => 1 + 2 * (1 - retrievabilityOf(topic[id], now));
  // Kırılganlık çarpanı: doğru ama YAVAŞ ustalaşan öğe (fragile) daha çok bilet
  // alır → otomatiklik oturana kadar önce geri gelir (erişim gücü bakımı).
  const fragileMult = (id: string): number => (topic[id]?.fragile ? 1.5 : 1);
  const top = Math.max(1, Math.ceil(candidates.length * 0.5));
  const pool = candidates.slice(0, top);
  const tickets = pool.map((id) => itemWeight(id) * urgMult(id) * fragileMult(id));
  let rw = Math.random() * tickets.reduce((a, b) => a + b, 0);
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    rw -= tickets[i];
    if (rw <= 0) { pick = pool[i]; break; }
  }
  _lastPickedId = pick;
  const pe = topic[pick];
  const pdays = pe?.lastSeen ? (now - pe.lastSeen) / 86_400_000 : 0;
  _lastPickInfo = {
    id: pick, level: pe?.level ?? 1, weight: itemWeight(pick),
    stale: +urgMult(pick).toFixed(2),
    ticket: +(itemWeight(pick) * urgMult(pick) * fragileMult(pick)).toFixed(1),
    days: +pdays.toFixed(1), fragile: !!pe?.fragile,
    retr: +retrievabilityOf(pe, now).toFixed(2), hl: +deriveStab(pe).toFixed(1),
  };
  return pick;
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
  // FSRS-lite: cevap ANINDAKİ hatırlama olasılığı — lastSeen güncellenmeden ÖNCE.
  const wasFirst = (e.seen ?? 0) === 0;
  const prevR = retrievabilityOf(e, Date.now());
  pushRecent(correct); // uyarlanır zorluk sinyali (son 12 cevap)
  e.total += 1;
  e.seen += 1;
  e.lastSeen = Date.now();
  // Tepki süresi (akıcılık sinyali). Süre yoksa (aksiyon oyunları) NÖTR:
  // ne kırılgan işaretler ne L4'ü engeller.
  const rt = (typeof meta?.responseMs === "number" && meta.responseMs > 0)
    ? Math.min(meta.responseMs, 60_000) : undefined;
  if (rt !== undefined) { e.totalMs = (e.totalMs || 0) + rt; e.lastMs = rt; }
  const fluent = rt === undefined || rt <= FLUENT_MS;
  // Yarı-ömür güncellemesi: ilk karşılaşmada başlangıç değeri; sonra doğruda
  // (1−R) oranında büyüme (unutmak üzereyken kurtarılan iz en çok güçlenir,
  // taze tekrar az kazandırır), yanlışta küçülme. Yavaş-doğru yarım kazanır.
  if (wasFirst) {
    e.stab = correct ? (fluent ? HL_FIRST_FLUENT : HL_FIRST_SLOW) : HL_FIRST_WRONG;
  } else if (correct) {
    const growth = Math.max(HL_MIN_GROWTH, 1 + HL_GROWTH * (1 - prevR) * (fluent ? 1 : 0.5));
    e.stab = Math.min(HL_MAX, deriveStab(e) * growth);
  } else {
    e.stab = Math.max(HL_MIN, deriveStab(e) * HL_WRONG_SHRINK);
  }
  if (correct) {
    e.correct += 1;
    e.consecutiveCorrect = (e.consecutiveCorrect || 0) + 1;
    // Doğru ama yavaşsa kırılgan işaretle (önce geri gelsin); hızlıysa temizle.
    e.fragile = rt !== undefined && !fluent;
    if (e.level < 3) {
      // L1→L2, L2→L3: tek doğru yeterli
      e.level = ((e.level + 1) as Level);
    } else if (e.level === 3) {
      // L3→L4 (en üst = OTOMATİKLİK): üst üste 2 doğru VE akıcı (hızlı) olmalı.
      // Yavaş-doğru "biliyor ama tereddütlü" → henüz ustalık değil, L3'te kalır.
      if (e.consecutiveCorrect >= 2 && fluent) e.level = 4;
    }
  } else {
    // Yanlışta 2 seviye düş (kullanıcı isteği — sabit kalacak).
    e.consecutiveCorrect = 0;
    e.fragile = false;
    e.level = (Math.max(1, e.level - 2) as Level);
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

  // Günlük seri: her cevap günü aktif sayar (aynı gün içinde no-op)
  import("@/lib/streak").then((m) => m.recordStreakActivity()).catch(() => {});

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
  // Öğrenci profili aktifken buluta yazma — öğrencinin ilerlemesi hocanın
  // hesabına karışmasın (öğrenci verisi cihazda yaşar).
  if (uid && !_activeStudent) {
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
