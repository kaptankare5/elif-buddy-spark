// 🔭 İLERİ YOKLAMA — "sıradaki konuyu da biliyor mu?"
//
// Geriye yoklamanın (placement.ts) AYNADAKİ hâli. Orası ATLANMIŞ eski
// konuları "gerçekten biliyor muydu?" diye kontrol eder; burası HENÜZ
// KİLİTLİ olan sıradaki konudan arada bir soru sorup "bunu da biliyor mu?"
// diye bakar. Biliyorsa konu hiç açtırılmadan atlanabilir.
//
// NEDEN GEREKLİ: sormadığın şeyi bilemezsin. Kilitli konunun öğeleri çocuğa
// hiç gösterilmediği için sistem o konu hakkında sıfır veriye sahiptir;
// otomatik atlama ancak bir yoklama kanalı varsa mümkün.
//
// GİZLİ ÖLÇÜM (stealth assessment, Shute): yoklama sorusu normal sorudan
// ayırt edilemez — ayrı ekran, "sınav" kelimesi, sayaç yoktur. Çocuk sadece
// bir soru daha görür.
//
// KARAR KURALI: SPRT (Wald'ın ardışık olasılık oranı testi). Sabit sayıda
// soru sormak yerine kanıt biriktirilir ve kesinleşince durulur:
//   doğru  → +0.43   ·   yanlış → −1.61
//   üst çizgi +2.89 = "biliyor"   ·   alt çizgi −2.25 = "bilmiyor"
// Pratikte: hiç yanlışsız 7 doğruda geçer, bir yanlış ~3.8 doğruyu siler,
// BİLMEYEN çocuk ortalama 2.7 soruda elenir — yani bilmeyen çocuk uzun bir
// yoklamaya katlanmaz. Sabit uzunluklu hiçbir kural bunu yapamaz.
//
// AVANS: her başarılı atlamadan sonra sıradaki konunun sayacı avanslı
// başlar (yetenek kestirimi konular arası taşınır — CAT/ALEKS mantığı).
// Ölçtük: 6 konuda 48.7 → 27.7 yoklama sorusu; konu başına 8.2 → 5.8 → 3.5.
// Yarısını bilen çocukta ise avans işe yaramıyor (57.1 → 58.1), yani
// "bilene yol açıyor, bilmeyeni kayırmıyor". İlk başarısızlıkta sıfırlanır.
import { getActiveStudentScope, getFlowBand } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { getUnlockedTopicIds, getUnlockedItemsOf } from "@/lib/unlock";
import { isTopicSkipped } from "@/lib/placement";
import { skillIdsOf } from "@/lib/skills";
import type { ContentItem } from "@/data/types";

// --- SPRT ayarları ---
const P1 = 0.92;        // "usta" varsayımı
const P0 = 0.60;        // "usta değil" varsayımı
const ALPHA = 0.05;     // yanlışlıkla atlama riski
const BETA = 0.10;      // gereksiz çalıştırma riski
export const UST_CIZGI = Math.log((1 - BETA) / ALPHA);        // +2.890
export const ALT_CIZGI = Math.log(BETA / (1 - ALPHA));        // −2.251
const W_DOGRU = Math.log(P1 / P0);                            // +0.427
const W_YANLIS = Math.log((1 - P1) / (1 - P0));               // −1.609

/** Her başarılı atlama üst çizginin bu kadarını avans yazar (tavan %70). */
const AVANS_ADIM = 0.35;
const AVANS_TAVAN = 0.70;

/**
 * Yoklama sorusu gelme olasılığı. Düşük tutuluyor: yoklama çocuğun HENÜZ
 * ÖĞRENMEDİĞİ bir şeyi sorar, sık gelirse ders "bilmediğim şeyler" gibi
 * hissettirir. ~8 soruda 1.
 */
const YOKLAMA_ORANI = 0.12;

const EVENT = "elifba-forward-probe-updated";
/** Konu atlanabilir duruma geldi — UI "geçmek ister misin?" diye sorar. */
export const PROBE_OFFER_EVENT = "elifba-skip-offer";

const KEY = () => {
  const s = getActiveStudentScope();
  return s ? `elifba-probe-student-${s}-v1` : `elifba-probe-guest-v1`;
};

interface ProbeState {
  /** konu id → biriken log-olabilirlik oranı */
  llr: Record<string, number>;
  /** konu id → sorulan yoklama sayısı */
  n: Record<string, number>;
  /** üst üste kaç konu başarıyla atlandı (avans için) */
  seri: number;
  /** teklifi reddettiği konular — bir daha teklif edilmez */
  reddedilen: string[];
}

function load(): ProbeState {
  if (typeof window === "undefined") return { llr: {}, n: {}, seri: 0, reddedilen: [] };
  try {
    const p = JSON.parse(localStorage.getItem(KEY()) || "{}") as Partial<ProbeState>;
    return { llr: p.llr ?? {}, n: p.n ?? {}, seri: p.seri ?? 0, reddedilen: p.reddedilen ?? [] };
  } catch { return { llr: {}, n: {}, seri: 0, reddedilen: [] }; }
}

function save(s: ProbeState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* SSR */ }
}

/** Sıradaki KİLİTLİ konu (varsa). Alıştırmasız konular atlanır. */
export function nextLockedTopic(currentTopicId: string) {
  const topics = getAllTopics();
  const acik = getUnlockedTopicIds();
  const i = topics.findIndex((t) => t.id === currentTopicId);
  if (i < 0) return null;
  for (let j = i + 1; j < topics.length; j++) {
    const t = topics[j];
    if (t.noPractice || t.items.length === 0) continue;   // görülüp geçilen konu
    if (acik.has(t.id)) return null;   // zaten açık → yoklamaya gerek yok
    return t;
  }
  return null;
}

/**
 * Şimdi bir ileri yoklama sorusu gelsin mi? Gelecekse hangi konudan, hangi
 * öğeyle?
 *
 * ⚠️ Yalnız çocuk İYİ GİDERKEN sorulur. Zorlanan çocuğa bilmediği bir
 * konudan soru sormak akışı kırar ve "bu uygulama bana zor geliyor" hissini
 * pekiştirir — kayıp riskinin en yüksek olduğu an tam da orasıdır.
 */
export function pickForwardProbe(currentTopicId: string): { topicId: string; item: ContentItem } | null {
  if (getFlowBand() === "struggling") return null;
  const t = nextLockedTopic(currentTopicId);
  if (!t) return null;
  const s = load();
  if (s.reddedilen.includes(t.id)) return null;      // "hayır" dedi, ısrar yok
  if ((s.llr[t.id] ?? 0) <= ALT_CIZGI) return null;  // "bilmiyor" kararı verildi
  if (Math.random() > YOKLAMA_ORANI) return null;

  // Kilitli konunun İLK bölümünden sor: müfredat sırası korunur, çocuk
  // konunun en temel örneğiyle yoklanır. Ses şartı — soru sesle sorulur.
  const havuz = getUnlockedItemsOf(t).filter((it) => !!it.audio && !!it.emoji);
  if (havuz.length < 2) return null;
  const item = havuz[Math.floor(Math.random() * havuz.length)];
  return { topicId: t.id, item };
}

/** Bu konuda yoklama başladı mı? (debug/rapor) */
export function probeInfo(topicId: string) {
  const s = load();
  return { llr: s.llr[topicId] ?? 0, n: s.n[topicId] ?? 0, seri: s.seri };
}

export type ProbeSonuc = "devam" | "atlanabilir" | "bilmiyor";

/**
 * Yoklama cevabını işle ve kararı döndür.
 *
 * ⚠️ Cevap SRS'e YAZILMAZ (çağıran taraf da yazmamalı): kilitli konunun
 * harfini çocuk hiç görmemiş olabilir; yanlış cevap −2 seviye yazsaydı hiç
 * öğrenmediği bir harf cezalandırılmış, karışıklık haritası da kirlenmiş
 * olurdu. Yoklama ÖLÇER, öğretmez.
 */
export function recordProbe(topicId: string, correct: boolean): ProbeSonuc {
  const s = load();
  const avans = UST_CIZGI * Math.min(AVANS_TAVAN, AVANS_ADIM * s.seri);
  const mevcut = s.llr[topicId] ?? avans;
  const yeni = mevcut + (correct ? W_DOGRU : W_YANLIS);
  s.llr[topicId] = yeni;
  s.n[topicId] = (s.n[topicId] ?? 0) + 1;

  if (yeni >= UST_CIZGI) {
    save(s);
    try {
      window.dispatchEvent(new CustomEvent(PROBE_OFFER_EVENT, { detail: { topicId } }));
    } catch { /* SSR */ }
    return "atlanabilir";
  }
  if (yeni <= ALT_CIZGI) {
    s.seri = 0;              // avans sıfırlanır: bir konuda takıldıysa gerisi de şüpheli
    save(s);
    return "bilmiyor";
  }
  save(s);
  return "devam";
}

/** Çocuk/veli teklifi KABUL etti → konu atlandı, avans serisi büyür. */
export function acceptSkip(topicId: string) {
  const s = load();
  s.seri += 1;
  delete s.llr[topicId];
  delete s.n[topicId];
  save(s);
}

/** Teklif REDDEDİLDİ → o konu için bir daha teklif edilmez (ısrar etme). */
export function declineSkip(topicId: string) {
  const s = load();
  if (!s.reddedilen.includes(topicId)) s.reddedilen.push(topicId);
  delete s.llr[topicId];
  save(s);
}

/** Bu konu yoklamayla atlanmaya HAZIR mı? (sayfa açılışında teklif için) */
export function skipOffered(topicId: string): boolean {
  const s = load();
  return !s.reddedilen.includes(topicId) && (s.llr[topicId] ?? 0) >= UST_CIZGI;
}

/** Konuda kaç beceri var — teklif metninde "N beceri" demek için. */
export function topicSkillCount(topicId: string): number {
  const t = getAllTopics().find((x) => x.id === topicId);
  if (!t) return 0;
  return skillIdsOf(t.items.filter((i) => i.practice !== false)).length;
}

/** Testler / sıfırlama. */
export function resetForwardProbe() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY()); } catch { /* ignore */ }
}

export const PROBE_LIMITS = { YOKLAMA_ORANI, UST_CIZGI, ALT_CIZGI, W_DOGRU, W_YANLIS, AVANS_ADIM, AVANS_TAVAN };

// isTopicSkipped'i yeniden dışa açmıyoruz; çağıranlar placement.ts'i kullanır.
void isTopicSkipped;
