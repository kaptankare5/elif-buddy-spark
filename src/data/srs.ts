// 4 seviyeli tekrar (SRS) sistemi + "Öğrenme Gücü" (learning power) metriği.
// Mantık, kullanıcının verdiği Unity/Firebase scriptindekiyle uyumludur:
// - İlk 2 karşılaşma 2 doğru ile geçtiyse harf "biliyordu" sayılır.
// - 3+ karşılaşmada yanlış cevap ve seviye < 3 ise "biliyordu = false" olur.
// - Seviye 3'e ilk kez ulaştığında ve biliyordu değilse "öğrenildi" anı kaydedilir.
// - Sadece "biliyordu = false" olan harflerin soru süresi öğrenme gücüne katkı verir.

import { useEffect, useState } from "react";
import { findTopicOfItem, flattenItems } from "@/data/subjects";
import { itemHeat, setConfusionScope } from "@/lib/confusion";
import { reliability as auditReliability, setAuditScope } from "@/lib/audit";

/**
 * Seviye merdiveni. ⚠️ L5 SONRADAN EKLENDİ ve L4'ün ANLAMINI DEĞİŞTİRDİ:
 *   L1-L2-L3 → tek doğruyla ilerler (tanışma)
 *   L4 "ÖĞRENDİ"   → üst üste 2 doğru; aynı oturumda kazanılabilir (hızlı)
 *   L5 "USTALAŞTI" → kanıt puanı (MASTERY) + ayrı günler; en erken 5. günde
 * Neden: kanıt kuru L3→L4'e konunca çocuk günlerce ⭐⭐⭐'te PARK ediyordu —
 * merdivenin görünen kısmı durunca ilerleme hissi bitiyor. Üstelik L3
 * kurada en aç kova (bkz. waterfallWeights): orada biriken öğe seyrek
 * sorulup soru bütçesi yeni harflere kayıyordu (ölçüm: tanıtılan harf
 * 94 → 158, çocuk bilmediği harflere doğru koşuyordu). Şimdi hızlı rozet
 * L4'te duruyor, katı kanıt şartı L5'e taşındı.
 */
export type Level = 1 | 2 | 3 | 4 | 5;
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

  // ---- ARALIKLI TEKRAR TAKVİMİ (aşağıdaki SPACING) ----
  /**
   * Takvimde kaçıncı basamakta? 0 = henüz basamağa girmedi.
   * Basamak YALNIZ farklı bir GÜNDE verilen doğru cevapla ilerler.
   */
  step?: number;
  /**
   * Son DOĞRU cevabın günü (epoch gün). "Aynı gün sayılmaz" kuralının
   * dayanağı: aynı oturumda üst üste doğru yapmak basamak ilerletmez.
   */
  lastCorrectDay?: number;
  /**
   * USTALIK PUANI — L4 için biriken kanıt. Her FARKLI GÜNDEKİ doğru cevap
   * kanıtın cinsine göre puan ekler (bkz. MASTERY). Yanlışta yarılanır.
   */
  mastery?: number;
  /**
   * O GÜN İÇİN VERİLMİŞ kanıt puanı — "günün EN İYİ kanıtı" kuralının
   * dayanağı (bkz. `recordAnswer`). Gün değişince yeniden yazılır.
   */
  dayEvidence?: number;
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
  // Karışıklık ısısı ve denetim kaydı da öğrenciye özeldir
  // (bağımlılık tek yönlü: srs → confusion/audit)
  setConfusionScope(_activeStudent);
  setAuditScope(_activeStudent);
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
    level: Math.max(1, Math.min(5, r.level || 1)) as Level,
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
// ⚠️ L3 AÇ KOVA OLMAMALI. Eski tabloda L3 %10 ile L4'ün (%15) bile altındaydı;
// kanıt şartı L3→L4'e konunca öğeler orada birikti ve toplu hâlde %10'luk
// dilimi paylaşıp neredeyse hiç sorulmaz oldu — soru bütçesi L1'e, yani YENİ
// harflere kaydı ve çocuk bilmediği harflere doğru koştu (tanıtılan harf
// 94 → 158). Artık merdiven monoton iniyor: üst seviye daha seyrek gelir ama
// hiçbir seviye açlıktan ölmez. Asıl bakımı zaten vade sırası (isDue) yapıyor.
function waterfallWeights(filledLevels: Level[]): Record<Level, number> {
  const w: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const sorted = [...filledLevels].sort((a, b) => a - b);
  if (sorted.length === 5) { w[1] = 46; w[2] = 20; w[3] = 14; w[4] = 12; w[5] = 8; }
  else if (sorted.length === 4) { w[sorted[0]] = 52; w[sorted[1]] = 22; w[sorted[2]] = 15; w[sorted[3]] = 11; }
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
// Karışıklık biletine etki gücü: ısı 1.0 iken öğe ~2.6× daha sık gelir.
// Aciliyet (1..3×) ile aynı büyüklük sırasında — baskın değil, belirgin.
const CONFUSION_BOOST = 1.6;

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

// ---- ARALIKLI TEKRAR TAKVİMİ ----
//
// ⚠️ EN ÖNEMLİ KURAL: AYNI GÜN SAYILMAZ.
// Aynı oturumda üst üste doğru yapmak öğrenmez. 5. sınıf öğrencilerinde
// güne YAYILARAK öğrenilen kelimelerin akılda kalma oranı, tek seferde
// öğrenilenlerin ÜÇ KATI çıkıyor. Bebeklerde bile gün aşırı çalışan grup
// hem her gün çalışandan hem de tek günde çalışandan hızlı öğreniyor.
// Bu yüzden basamak yalnız FARKLI BİR GÜNDE verilen doğru cevapla ilerler.
//
// TAKVİM (Cepeda 2008, 1350 kişi): ne kadar uzun hatırlanacaksa ara o kadar
// uzar ama ORAN küçülür — 1 hafta için sürenin %20-40'ı, 1 yıl için %5-10'u.
// Aşağıdaki basamaklar bu eğriyi izler.
//
// SON BASAMAK = MEZUNİYET. Bahrick 733 kişiyi 50 yıl izledi: bilgi ilk 3-6
// yıl düşüyor, sonra 30 yıl SABİT kalıyor ("permastore"). Yılı devirmiş öğe
// programdan çıkar — sonsuza kadar tekrar sormanın karşılığı yok.
const SPACING = {
  /**
   * HEDEF HATIRLAMA — öğe tekrar sorulduğunda hatırlanıyor olma olasılığı.
   * ⚠️ Bu, Wilson'ın "%85 başarı oranı" kuralıyla AYNI ŞEY DEĞİL: o soruların
   * ZORLUĞUNU ayarlar, bu ise tekrarların NE KADAR SEYREK geleceğini.
   * Anki/FSRS varsayılanı 0.90; makul aralık 0.70-0.97.
   * Çocukta düşürmüyoruz: 0.85 daha az iş demek ama tekrar geldiğinde daha
   * çok yanlış demek, küçük çocukta bunun motivasyon bedeli sayısal
   * kazançtan büyük (ölçtük: sabit %85 bandında bırakma oranı çok yüksek).
   */
  DESIRED_RETENTION: 0.90,
  /**
   * ARALIK ÇARPANI — iş yükünü buradan düşürüyoruz, unutmayı göze alarak
   * değil. Bahrick: 13 tekrar × 56 gün ara = 26 tekrar × 14 gün ara, aynı
   * kalıcılık. Yani çarpanı 2 yapmak tekrar sayısını yarıya indirir.
   * İngilizce'de kelime sayısı büyüyünce (B1 ≈ 2000 kelime → günde 38 bakım
   * sorusu) tek ayarla yükü yarıya indirebilmek için burada duruyor.
   */
  INTERVAL_SCALE: 1.0,
  /** Basamak aralıkları (gün): 1 → 3 → 1 hafta → 3 hafta → 2 ay → 5 ay → 1 yıl */
  STEPS_DAYS: [1, 3, 7, 21, 60, 150, 365],
} as const;
export { SPACING };

/** Takvimi devirmiş (mezun) öğe — bir daha programa alınmaz. */
export const GRADUATED_STEP = SPACING.STEPS_DAYS.length;

// R = 2^(−gün/stab) eğrisinde hedefe tam basamak sonunda ulaşmak için:
// 2^(−t/S) = hedef  →  S = t / (−log2(hedef))
const RET_K = -Math.log2(SPACING.DESIRED_RETENTION);   // 0.90 → 0.152

/** Basamağa karşılık gelen yarı-ömür (gün). */
function stabForStep(step: number): number {
  const i = Math.min(Math.max(0, step - 1), SPACING.STEPS_DAYS.length - 1);
  return (SPACING.STEPS_DAYS[i] * SPACING.INTERVAL_SCALE) / RET_K;
}

const HL_MIN = 0.25;        // gün — dip (yanlış sonrası bile sıfırlanmaz)
const HL_FIRST_WRONG = 0.25;   // ilk karşılaşma yanlış

// ---- USTALIK KURU: hangi kanıt ne kadar sayar? ----
//
// Önce mutlak tavan koymuştum (oyun/test ASLA L4 veremez). Kullanıcı itiraz
// etti ve haklıydı: "sürekli harfe maruz kalırsa, ters yönde de olsa,
// oyun oynaya oynaya öğrenir — belki 2-3 kat daha çok zaman ister."
//
// Literatür de bunu söylüyor: hem alıcı (tanıma) hem üretici pratik kelime
// bilgisini BÜTÜN yönlerde geliştiriyor. Fark verimde: üretici pratik her
// iki yönde de daha çok kazandırıyor, tanıma pratiği çoğunlukla kendi
// yönünde. Ve üretici bilgi "daha uzun ve yoğun pratik" istiyor.
//
// Yani doğru model DUVAR değil KUR: tanıma kanıtı da sayılır, sadece daha
// azı sayılır. Yalnız oyun oynayan çocuk da L4'e ulaşır — 2 gün yerine
// 6 farklı günde.
const MASTERY = {
  /** L4 ("ezberledi") için gereken toplam kanıt puanı. */
  NEEDED: 3,
  /** ÜRETİM (Flashcard: harfi gör → adını söyle) — tam puan. */
  PRODUCTION: 1,
  /**
   * TANIMA (oyun/test: şıktan seç) — kısmi puan. Sıfır DEĞİL: tanıma
   * pratiği de üretime katkı yapıyor, sadece daha yavaş. 1/3 = "3 kat
   * daha çok gün" demek, kullanıcının sezgisiyle aynı büyüklükte.
   */
  RECOGNITION: 1 / 2,
  /**
   * L5 için en az bu kadar AYRI GÜN (takvim basamağı). Puan eşiği tek başına
   * yetmiyor — bkz. L4→L5 kapısındaki (c) şıkkı. Tanıma yolu zaten 6 gün
   * istediği için bu taban yalnız üretim (Flashcard) kestirmesini kapatır.
   */
  MIN_DAYS: 5,
  /** Yanlışta biriken puan yarılanır (sıfırlanmaz — öğrenme silinmez). */
  WRONG_DECAY: 0.5,
  /**
   * ⚠️ Kayan nokta payı: 6 × (1/3) = 1.9999999999999998 çıkıyor ve tam
   * eşikte kalan çocuk L4'ü ALAMIYORDU. Karşılaştırma bu payla yapılır.
   */
  EPS: 1e-9,
} as const;
export { MASTERY };

/**
 * Şık sayısına göre kanıt katsayısı (0..1).
 *
 * Bilgi kuramı: n şık arasından doğruyu bulmak log2(n) bit taşır. 4 şık
 * 2 bit, 2 şık 1 bit → yarısı. Katsayı da aynı oranda: 4 şık 1.0 (mevcut
 * davranış korunur), 3 şık 0.79, 2 şık 0.5. Şıksız (Flashcard beyanı)
 * zaten ayrı yoldan tam puan alır.
 */
function sansPayi(optionCount?: number): number {
  if (!optionCount || optionCount >= 4) return 1;
  if (optionCount <= 1) return 1;              // şık yok → şans yok
  return Math.log2(optionCount) / 2;           // 2 → 0.5, 3 → 0.79
}

/** Hızlı geçiş (ilk karşılaşmada doğrudan L3) için gereken en az şık. */
const HIZLI_GECIS_MIN_SIK = 4;
/**
 * L3→L4 mandalı için gereken üst üste doğru sayısı.
 *
 * ⚠️ ÖLÇÜT SABİT: hangi modda olursa olsun, SIRF ŞANSLA L4'e çıkma olasılığı
 * 4 şıklı hâlin altında kalmalı — yani 1/16. Gereken tekrar sayısı buradan
 * çıkar: (1/n)^k ≤ 1/16 → k ≥ 4 / log2(n).
 *   4 şık → 2 doğru (1/16, mevcut davranış korunur)
 *   3 şık → 3 doğru (1/27, eşikten güvenli)
 *   2 şık → 4 doğru (1/16)
 * Sabit "3" yazmak yetmiyordu: 2 şıkta 3 doğru 1/8 eder, yani 4 şıklı hâlin
 * iki katı kolay kalırdı.
 */
function gerekenUstUste(optionCount?: number): number {
  if (!optionCount || optionCount >= 4) return 2;
  if (optionCount <= 1) return 2;
  return Math.ceil(4 / Math.log2(optionCount));
}

/** Epoch gün — "aynı gün mü?" karşılaştırması bunun üzerinden yapılır. */
const dayOf = (ms: number) => Math.floor(ms / 86_400_000);

// Eski kayıtlarda stab yok → seviyeden makul yarı-ömür türet (göç köprüsü).
function deriveStab(e: LetterSrsEntry | undefined): number {
  if (!e) return HL_MIN;
  if (typeof e.stab === "number" && e.stab > 0) return e.stab;
  return e.level >= 5 ? 14 : e.level === 4 ? 7 : e.level === 3 ? 3 : e.level === 2 ? 1 : 0.4;
}

// Şu anki hatırlama olasılığı R (0..1). Hiç görülmemişse 0 (en acil).
export function retrievabilityOf(e: LetterSrsEntry | undefined, now: number): number {
  if (!e || !e.lastSeen || (e.seen ?? 0) === 0) return 0;
  const days = Math.max(0, (now - e.lastSeen) / 86_400_000);
  const r = Math.pow(2, -days / deriveStab(e));
  return r < 0 ? 0 : r > 1 ? 1 : r;
}

/**
 * Bu öğenin VADESİ GELDİ Mİ? (hatırlama olasılığı hedefin altına düştü)
 *
 * ⚠️ Mezun öğe (takvimi devirmiş) asla vadeli olmaz — Bahrick'in
 * "permastore" bulgusu: yılı geçen bilgi 30 yıl sabit kalıyor, sonsuza
 * kadar tekrar sormanın karşılığı yok.
 */
export function isDue(e: LetterSrsEntry | undefined, now: number): boolean {
  if (!e || (e.seen ?? 0) === 0) return false;
  if ((e.step ?? 0) >= GRADUATED_STEP) return false;
  return retrievabilityOf(e, now) < SPACING.DESIRED_RETENTION;
}

/** Takvimi devirdi mi? (artık programa alınmaz) */
export function isGraduated(e: LetterSrsEntry | undefined): boolean {
  return (e?.step ?? 0) >= GRADUATED_STEP;
}

/**
 * VADE PAYI — vadesi gelmiş öğe varsa soruların bu kadarı ondan gelir.
 *
 * Eskiden vade yalnız bir bilet ÇARPANIYDI (en fazla ×3) ve 170 öğelik bir
 * havuzda unutulmuş öğe kurayı kaybediyordu: "L3+ görünüyor ama unutmuş"
 * sayısı böyle şişiyordu. Artık kura yok, doğrudan öncelik var.
 * %100 değil: kalan pay yeni öğe tanıtımına bırakılır, yoksa biriken bakım
 * borcu öğrenmeyi tamamen durdurur ("review debt").
 */
const DUE_SHARE = 0.7;

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
// conf = karışıklık ısısı (0..1) — bu harf başka bir harfle karıştırılıyor mu.
export interface LastPickInfo {
  id: string; level: number; weight: number; stale: number; ticket: number; days: number;
  /** Vade sırasından mı geldi? (kura değil, doğrudan öncelik) */
  due?: boolean;
  fragile?: boolean; retr?: number; hl?: number; conf?: number;
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

/**
 * SON CEVABA NE OLDU — yalnız test panelinde (1234) okunur.
 * Kanıt kuru (MASTERY) ve "aynı gün sayılmaz" kuralı görünmez çalıştığı için
 * elle doğrulanamıyordu: çocuk doğru yapıyor, rozet kıpırdamıyor, sebebi
 * belli değil. Bu iz "puan kaç oldu, gün sayıldı mı, seviye neden değişmedi"
 * sorularını tek bakışta cevaplar.
 */
export interface LastAnswerInfo {
  topicId: string;
  skillId: string;
  correct: boolean;
  /** "üretim" (Flashcard) = 1 puan · "tanıma" (oyun/test) = ½ puan */
  evidence: "production" | "recognition";
  /** Bu cevap YENİ bir güne mi düştü? false ise puan/basamak ilerlemedi. */
  newDay: boolean;
  levelBefore: Level;
  levelAfter: Level;
  masteryBefore: number;
  masteryAfter: number;
  step: number;
  /** Akıcı mı sayıldı (süre eşiği ya da hiç yanlış yapmamış olma) */
  fluent: boolean;
  responseMs?: number;
  at: number;
}
let _lastAnswer: LastAnswerInfo | null = null;
export function getLastAnswerInfo(): LastAnswerInfo | null { return _lastAnswer; }

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

  // ---- VADE SIRASI (kuradan ÖNCE) ----
  // Hatırlama olasılığı hedefin altına düşen öğe kuraya girmez, doğrudan
  // öne alınır. En çok gecikmiş olan önce. Mezun öğeler hiç girmez.
  const simdi = Date.now();
  const vadeli = pickIds
    .filter((id) => id !== _lastPickedId && isDue(topic[id], simdi))
    .sort((a, b) => retrievabilityOf(topic[a], simdi) - retrievabilityOf(topic[b], simdi));
  if (vadeli.length > 0 && Math.random() < DUE_SHARE) {
    // En gecikmiş yarıdan çekiliş — hep aynı öğeyi vermemek için.
    // ⚠️ Karışıklık çarpanı BURADA da uygulanmalı: vade sırası kurayı
    // atladığı için çarpan yalnız kura yolunda kalsaydı, çocuğun gerçekten
    // karıştırdığı harf daha sık gelmeyi bırakırdı (testi var).
    const ust = Math.max(1, Math.ceil(vadeli.length * 0.5));
    const adaylar = vadeli.slice(0, ust);
    const biletler = adaylar.map((id) => 1 + CONFUSION_BOOST * itemHeat(id));
    let rv = Math.random() * biletler.reduce((a, b) => a + b, 0);
    let sec = adaylar[adaylar.length - 1];
    for (let i = 0; i < adaylar.length; i++) {
      rv -= biletler[i];
      if (rv <= 0) { sec = adaylar[i]; break; }
    }
    _lastPickedId = sec;
    const se = topic[sec];
    _lastPickInfo = {
      id: sec, level: se?.level ?? 1, weight: itemWeight(sec),
      stale: +(1 + 2 * (1 - retrievabilityOf(se, simdi))).toFixed(2),
      ticket: 0, conf: +itemHeat(sec).toFixed(2),
      days: se?.lastSeen ? +((simdi - se.lastSeen) / 86_400_000).toFixed(1) : 0,
      fragile: !!se?.fragile,
      retr: +retrievabilityOf(se, simdi).toFixed(2), hl: +deriveStab(se).toFixed(1),
      due: true,
    };
    return sec;
  }

  const byLevel: Record<Level, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const id of pickIds) {
    const e = topic[id] || { level: 1, seen: 0, lastSeen: 0 };
    byLevel[e.level as Level].push(id);
  }
  const filled: Level[] = ([1, 2, 3, 4, 5] as Level[]).filter((l) => byLevel[l].length > 0);
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
  // KARIŞIKLIK çarpanı: çocuk bu harfi bir başkasıyla gerçekten karıştırıyorsa
  // (ölçülmüş ısı) daha çok bilet alır → test/oyun/flashcard'da daha SIK gelir.
  // Isı, ayrım üst üste yapıldıkça düşer; yani sorular çözüldükçe sıklık da
  // kendiliğinden normale döner. (lib/confusion.ts)
  const confMult = (id: string): number => 1 + CONFUSION_BOOST * itemHeat(id);
  const top = Math.max(1, Math.ceil(candidates.length * 0.5));
  const pool = candidates.slice(0, top);
  const tickets = pool.map((id) => itemWeight(id) * urgMult(id) * fragileMult(id) * confMult(id));
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
    ticket: +(itemWeight(pick) * urgMult(pick) * fragileMult(pick) * confMult(pick)).toFixed(1),
    conf: +itemHeat(pick).toFixed(2),
    days: +pdays.toFixed(1), fragile: !!pe?.fragile,
    retr: +retrievabilityOf(pe, now).toFixed(2), hl: +deriveStab(pe).toFixed(1),
  };
  return pick;
}

export interface AnswerMeta {
  responseMs?: number;
  gameId?: string;
  /**
   * Cevap ÇOKTAN SEÇMELİ değil, çocuğun KENDİ BEYANI mı? (Flashcard'da
   * "Biliyorum / Bilmiyorum" kaydırması.) Şık yok demek şans yok demek:
   * 4 şıkta doğru basmanın %25 şansı varken beyanda 0. Bu yüzden ilk
   * karşılaşmadaki "Biliyorum" tek başına ustalık sayılır (doğrudan L4),
   * testte/oyunda ise iki doğru gerekir (L3 → L4). Kullanıcı kararı.
   */
  selfReport?: boolean;
  /**
   * KANITIN CİNSİ — bu cevap hangi seviyeye kadar çıkarabilir?
   *
   * Bütün doğru cevaplar eşit değildir:
   *  • "recognition" (VARSAYILAN) — çocuk şıklar arasından SEÇTİ. Oyunda
   *    koşarken 4 şık, testte ses→harf. Şansla %25 tutturulabilir, üstelik
   *    çocuk bilmediği harfi ELEYEREK de bulabilir. Dahası yön TERSTİR:
   *    Elifbâ kitabı "harfi gör, adını SÖYLE" diye sorar, biz "sesi duy,
   *    harfi seç" diye soruyoruz — bu iki yön ayrı ayrı öğrenilir, birini
   *    bilmek ötekini vermez.
   *  • "production" — çocuk cevabı ÜRETTİ (Flashcard: harfi görür, adını
   *    söyler, sonra kontrol eder). Şans yok ve yön kitabınkiyle aynı.
   *
   * ⚠️ L4 ("ezberledi") YALNIZ üretim kanıtıyla verilir. Oyun ve normal
   * test bir harfi L3'e çıkarır ve orada BAKIMINI yapar — ama "ezberledi"
   * kararını veremez. Gerçek gözlem: çocuk bir saatte bütün harfleri L4
   * yaptı, sonra kitaptan sorulunca 2 harfi bilemedi.
   * Araştırma da bu yönde: cevabı ÜRETTİREN testler, cevabı SEÇTİREN
   * testlerden daha güçlü iz bırakır (Roediger & Karpicke çizgisi).
   */
  evidence?: "recognition" | "production";
  /**
   * Soru kaç ŞIKLA soruldu? (şıksız/serbest cevapta boş bırakılır)
   *
   * ⚠️ ŞANS ORANI ÖLÇÜMÜ BOZAR. Merdivenin bütün gerekçeleri 4 şıka göre
   * yazılmıştı ("4 şıkta iki kez şansla tutturma 1/16"), ama şimşek modu
   * 2 şık, tabela modu 3 şık gösteriyor ve Kolay zorlukta da şık azalıyor.
   * 2 şıkta bir doğru cevap 1 bit, 4 şıkta 2 bit bilgi taşır — yani yarısı
   * kadar kanıt. Bu alan olmadan iki durum ayırt edilemiyordu ve az şıklı
   * modlarda seviye şişiyordu. Kullanımı: `sansPayi`, hızlı geçiş kapısı,
   * L3→L4 mandalı ve MASTERY puanı.
   */
  optionCount?: number;
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
  const prevMastery = e.mastery ?? 0;
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
  // Kanıtın cinsi: üretim mi (Flashcard) yoksa tanıma mı (şıktan seçme)?
  const uretim = meta?.evidence === "production" || meta?.selfReport === true;

  // ---- ARALIKLI TEKRAR TAKVİMİ ----
  // ⚠️ AYNI GÜN SAYILMAZ. Basamak yalnız FARKLI BİR GÜNDE verilen doğru
  // cevapla ilerler; aynı oturumda üst üste doğru yapmak öğretmez (güne
  // yayılan tekrar, tek seferde tekrarın üç katı kalıcılık veriyor).
  const bugun = dayOf(Date.now());
  const ayniGun = e.lastCorrectDay === bugun;
  const yeniGunDogru = correct && !ayniGun;
  /**
   * Bu cevabın kanıt değeri.
   * ⚠️ ÜRETİM PUANI GÜVEN KATSAYISIYLA ÖLÇEKLENİR (lib/audit.ts): Flashcard
   * beyanı doğrulanmıyor, çocuk cevabı gördükten sonra "biliyordum" diyor.
   * 20 soruda bir gelen denetim kartı bu beyanın ne kadar tuttuğunu ölçer ve
   * puan ona göre kırpılır. Taban MIN_GUVEN — en güvenilmez çocukta bile
   * Flashcard bir oyun cevabı kadar değer taşır, DEĞERSİZ olmaz.
   * ⚠️ TANIMA PUANI ŞIK SAYISIYLA ölçeklenir: 2 şıklı doğru cevap 4 şıklının
   * yarısı kadar kanıt taşır (bkz. sansPayi) — 2 şıkta şans %50. Yani yalnız
   * Şimşek (2 şık) oynayan çocuk L5'e 6 değil 12 ayrı günde ulaşır.
   */
  const kanitPuani = uretim
    ? MASTERY.PRODUCTION * auditReliability()
    : MASTERY.RECOGNITION * sansPayi(meta?.optionCount);
  if (correct) {
    if (yeniGunDogru) {
      e.step = (e.step ?? 0) + 1;
      // Ustalık puanı da yalnız FARKLI GÜNDE birikir — aynı oturumda
      // üst üste doğru yapmak ustalık kanıtı değildir.
      e.mastery = (e.mastery ?? 0) + kanitPuani;
      e.dayEvidence = kanitPuani;
    } else if (e.dayEvidence !== undefined && kanitPuani > e.dayEvidence) {
      // ⚠️ GÜNÜN **EN İYİ** KANITI SAYILIR, İLK KANITI DEĞİL.
      // Puan günde bir kez birikiyor; hangi cevabın sayılacağını SIRA
      // belirlerse ölçüm çarpılıyordu: çocuk sabah Şimşek'te (2 şık, ¼ puan)
      // doğru yapıp öğleden sonra Flashcard'da harfi ÜRETİRSE (1 puan) o gün
      // yine ¼ ile kapanıyordu — daha güçlü kanıt sırf sonra geldiği için
      // yok sayılıyordu. Şimdi aradaki fark ekleniyor: gün, o gün verilen
      // en güçlü kanıt kadar sayar. Tersi olamaz — zayıf kanıt güçlüyü
      // düşürmez, `>` karşılaştırması bunu garanti eder.
      // ⚠️ `undefined` kontrolü göç içindir: bu alan eklenmeden önce kaydı
      // olan çocukta o günün puanı zaten verilmiş olabilir; bilinmiyorsa
      // yeniden vermek yerine atlanır (fazladan puan yazmak sahte ustalık
      // üretir, eksik yazmak yalnız bir günlük gecikme).
      e.mastery = (e.mastery ?? 0) + (kanitPuani - e.dayEvidence);
      e.dayEvidence = kanitPuani;
    }
    e.lastCorrectDay = bugun;
    e.stab = wasFirst && !yeniGunDogru ? HL_FIRST_WRONG : stabForStep(e.step ?? 1);
  } else {
    // Yanlış: basamakta 2 geri (seviyedeki −2 kuralıyla aynı ilke).
    e.step = Math.max(0, (e.step ?? 0) - 2);
    e.mastery = (e.mastery ?? 0) * MASTERY.WRONG_DECAY;
    e.stab = e.step > 0 ? stabForStep(e.step) : Math.max(HL_MIN, HL_FIRST_WRONG);
  }
  void prevR;
  if (correct) {
    e.correct += 1;
    e.consecutiveCorrect = (e.consecutiveCorrect || 0) + 1;
    // Doğru ama yavaşsa kırılgan işaretle (önce geri gelsin); hızlıysa temizle.
    e.fragile = rt !== undefined && !fluent;
    if (wasFirst) {
      // ⚡ HIZLI GEÇİŞ (kullanıcı kararı): harfi İLK KEZ gören çocuk doğru
      // bildiyse bunu ÖĞRENMEK değil ZATEN BİLMEK sayarız → doğrudan L3.
      // İkinci doğruda L4. Konuyu bilerek gelen çocuk 2 cevapta bitirir;
      // eskiden 28 harf için 56 cevap gerekiyordu (aşırı alıştırma).
      // Bedeli: 4 şıkta iki kez şansla tutturma 1/16. Emniyet üç katmanlı —
      // yanlışta −2 seviye, karışıklık radarı ve bakım soruları geri çağırır.
      // ⚠️ Bu yüzden oyunlarda İLK karşılaşmada ipucu halkası GÖSTERİLMEZ
      // (gameProgress.showHintFor): ipuçlu doğru cevap "biliyordu" sayılamaz.
      //
      // ⚠️ FLASHCARD'IN KESTİRMESİ YOK: eskiden orada şık olmadığı için tek
      // "Biliyorum" beyanı doğrudan L4 yapıyordu. Kaldırıldı — çocuk 1 saatte
      // bütün harfleri L4 yapıp ertesi hafta kitaptan sorulunca bilemiyordu.
      // Şık olmaması yalnız ŞANSLA TUTTURMAYI sıfırlar, KALICILIĞI kanıtlamaz;
      // kalıcılık ayrı günlere yayılmış tekrardan gelir. Beyanın tek ayrıcalığı
      // MASTERY'de tam puan almasıdır (üretim kanıtı), kestirme değil.
      //
      // ⚠️ KESTİRME YALNIZ 4+ ŞIKTA GEÇERLİ. Yukarıdaki "1/16" hesabı 4 şıka
      // göre. Şimşek modu 2 şık gösteriyor: orada ilk karşılaşmada YAZI TURA
      // ile L3'e çıkılıyordu (%50), ikinci doğruda L4 (%25). Az şıklı soru
      // "zaten biliyordu" kararını veremez — normal basamak işler (L1→L2).
      if (!meta || (meta.optionCount ?? 4) >= HIZLI_GECIS_MIN_SIK) {
        e.level = 3;
      } else {
        e.level = ((e.level + 1) as Level);
      }
    } else if (e.level < 3) {
      // L1→L2, L2→L3: tek doğru yeterli
      e.level = ((e.level + 1) as Level);
    } else if (e.level === 3) {
      // L3→L4 ("ÖĞRENDİ"): üst üste 2 doğru VE akıcı (hızlı) olmalı.
      // Yavaş-doğru "biliyor ama tereddütlü" → henüz öğrendi değil, L3'te kalır.
      // Bu basamak AYNI OTURUMDA kazanılabilir — bilerek: merdivenin görünen
      // kısmı hızlı ilerlemeli, yoksa çocuk ⭐⭐⭐'te park edip ilerleme
      // hissini kaybediyor. Katı kanıt şartı bir üst basamakta (L5).
      // İSTİSNA — hiç yanlış yapmamış çocuk (correct === total) yavaş olsa da
      // cezalanmaz: küçük çocukta yavaşlık çoğu zaman bilgi eksikliği değil
      // parmak/dikkat. Ölçtük, süre şartını sertleştirince bilen ama temkinli
      // çocuğun geçme oranı %99'dan %87'ye düşüyordu (kullanıcı şartı).
      // ⚠️ Gereken üst üste doğru sayısı ŞIK SAYISINA bağlı: 4 şıkta 2 doğru
      // şansla %6.25, 2 şıkta %25 olurdu. 2-3 şıkta 3 doğru istenir (%12.5).
      const akiciSayilir = fluent || e.correct === e.total;
      if ((e.consecutiveCorrect ?? 0) >= gerekenUstUste(meta?.optionCount) && akiciSayilir) {
        e.level = 4;
      }
    } else if (e.level === 4) {
      // ⚠️ L4→L5 ("USTALAŞTI" = otomatiklik) DÖRT ŞART BİRDEN ister:
      //  (a) AYNI GÜN SAYILMAZ — bu doğru, öncekinden başka bir günde olmalı.
      //      Aynı oturumda arka arkaya doğru yapmak ustalık kanıtı değildir.
      //  (b) KANIT PUANI eşiği geçmeli (MASTERY): üretim 1, tanıma 1/2 puan,
      //      eşik 3. Duvar değil KUR: oyun oynaya oynaya da ustalaşılır,
      //      sadece daha uzun sürer — kullanıcı itirazı ve literatür bu yönde.
      //  (c) EN AZ `MIN_DAYS` AYRI GÜN. Puan tek başına yetmiyordu: üretim
      //      yolu 3 günde eşiği geçiyor, o üç hatırlama yarı ömrü ancak ~10
      //      güne çıkarıyor, sonra takvim aralığı 21-60 güne fırlayınca harf
      //      bir daha sorulmuyor ve unutuluyordu. Ölçüm: yalnız Flashcard
      //      oynayan çocukta ⭐ rozetinin %33'ü yalandı (7 gün sonra hatırlama
      //      %50'nin altı), taban konunca %0. Rawson & Dunlosky'nin reçetesi
      //      de "3 doğru + 3 kez ARALIKLI yeniden öğrenme" diyor — puan eşiği
      //      onların yalnız ilk yarısına denk geliyordu.
      //  (d) AKICILIK: yavaş-doğru otomatiklik değil (aynı istisna geçerli).
      const puanTamam = (e.mastery ?? 0) >= MASTERY.NEEDED - MASTERY.EPS;
      const gunTamam = (e.step ?? 0) >= MASTERY.MIN_DAYS;
      const akiciSayilir = fluent || e.correct === e.total;
      if (puanTamam && gunTamam && yeniGunDogru && akiciSayilir) {
        e.level = 5;
      }
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

  // Test panelinin okuduğu iz (yalnız 1234 modunda görünür).
  _lastAnswer = {
    topicId, skillId: letterId, correct,
    evidence: uretim ? "production" : "recognition",
    newDay: !ayniGun,
    levelBefore: prevLevel, levelAfter: e.level,
    masteryBefore: prevMastery, masteryAfter: e.mastery ?? 0,
    step: e.step ?? 0, fluent, responseMs: rt, at: Date.now(),
  };

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
  const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
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
    const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
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
