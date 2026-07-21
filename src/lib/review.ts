// SERPİŞTİRİLMİŞ BAKIM (interleaved review) — Test/Flashcard'ın yalnız o an
// çalışılan konuda kalmayıp eski AÇIK konuları da yoklaması. Simülasyon
// (src/test/sim.test.ts) gösterdi: tek-konu akışında SRS "öğrenildi" sandığı
// harflerin yarıdan fazlası aslında unutuluyordu ("sahte ustalık"). Frontier'ın
// %78'i korunup ~%22'si bayatlık-ağırlıklı eski bakıma ayrılınca gerçek
// tutulum belirgin arttı (aralıklı geri getirme + serpiştirme; Cepeda 2006,
// Rohrer & Taylor 2007).
//
// Bu, atlanan konuların ara-kontrolüyle (placement.ts) BİRLEŞİKtir: zayıf/
// atlanmış bir eski konu varsa review olasılığı onun baskısına yükselir ve o
// konu baskın olur (değerlendirme); yoksa taban %22 bakım serpiştirmesi tüm
// eski açık konulara bayatlığa göre dağılır.
//
// Not: Bu modül bir "yaprak" — unlock/placement/srs'i içe aktarır ama onlardan
// hiçbiri bunu içe aktarmaz (döngü yok).
import { getAllTopics, findTopicOfItem } from "@/data/subjects";
import { getUnlockedTopicIds, getUnlockedItemsOf } from "@/lib/unlock";
import { isTopicSkipped, backCheckPressure } from "@/lib/placement";
import { getTopicSrs, pickNextLetterFromTopic, getFlowBand, type Namespace, type TopicSrs } from "@/data/srs";

// AKIŞA UYARLI bakım payı — "cezm dersi": taze bir konuda zorlanan çocuğa
// "kolay ver" demenin konu İÇİNDE karşılığı yoktur (hepsi L1). Kolay olan,
// ÖNCEKİ konuların ustalaşılmış öğeleridir. Zorlanınca bakım payı %50'ye
// çıkar (eski sağlam öğelerle güven onarımı — akış bandını yukarı çeker);
// uçarken %10'a iner (yeni içerik hızlansın, K kapısı da genişler).
const REVIEW_BASE = 0.22;
const REVIEW_STRUGGLING = 0.50;
const REVIEW_FLYING = 0.10;

export function currentReviewShare(): number {
  const band = getFlowBand();
  if (band === "struggling") return REVIEW_STRUGGLING;
  if (band === "flying") return REVIEW_FLYING;
  return REVIEW_BASE;
}

export interface ReviewPick { topicId: string; itemId: string }

// Şu an çalışılan konuda bir sonraki soru eski bir açık konudan (bakım/
// değerlendirme) mı gelsin? Gelirse hangi konu + öğe. null = frontier'dan devam.
export function pickReviewItem(currentTopicId: string, ns: Namespace): ReviewPick | null {
  const topics = getAllTopics();
  const idx = topics.findIndex((t) => t.id === currentTopicId);
  if (idx <= 0) return null;
  const unlocked = getUnlockedTopicIds();
  const earlier = topics.slice(0, idx).filter((t) => !t.noPractice && unlocked.has(t.id));
  if (earlier.length === 0) return null;

  // Zayıf/atlanmış eski konu varsa review olasılığını onun baskısına yükselt
  // ve o konuyu baskın kıl (çürük temel çocuğu kendine çeker).
  let hotTopic: string | null = null;
  let hotP = 0;
  for (const t of earlier) {
    if (!isTopicSkipped(t.id)) continue;
    const p = backCheckPressure(t.id);
    if (p > hotP) { hotP = p; hotTopic = t.id; }
  }
  const p = Math.max(currentReviewShare(), hotP);
  if (Math.random() > p) return null;

  // Havuz: sıcak (zayıf/atlanmış) konu belirginse yalnız o; yoksa tüm eski açık
  // öğeler (bayatlık-ağırlıklı serpiştirme).
  const poolTopics = hotTopic && hotP > REVIEW_BASE ? earlier.filter((t) => t.id === hotTopic) : earlier;
  const ids: string[] = [];
  const merged: TopicSrs = {};
  for (const t of poolTopics) {
    const srs = getTopicSrs(ns, t.id);
    for (const it of getUnlockedItemsOf(t)) {
      ids.push(it.id);
      if (srs[it.id]) merged[it.id] = srs[it.id];
    }
  }
  if (ids.length === 0) return null;
  const itemId = pickNextLetterFromTopic(merged, ids);
  const topicId = findTopicOfItem(itemId)?.topicId ?? poolTopics[0].id;
  return { topicId, itemId };
}
