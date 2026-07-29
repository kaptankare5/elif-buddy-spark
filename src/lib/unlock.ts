// Konu kilidi sistemi.
// Kural: Bir konudaki tüm itemların SRS seviyesi >= 3 olduğunda sonraki
// konu açılır. İlk konu her zaman açıktır. `noPractice: true` konular
// otomatik olarak "tamamlanmış" sayılır (alıştırma yok).
//
// KONU İÇİ BÖLÜM (CHUNK) KİLİDİ — bilişsel yük teorisi (Sweller):
// Çocuk çalışma belleği ~4 öğe kaldırır; 28 harfi bir anda sormak aşırı
// yüklemedir. Uzun konular 4 harflik "Bölüm"lere ayrılır (item.section).
// Bir bölümdeki TÜM öğeler L3+'a ulaşınca sıradaki bölüm açılır.
// Önceki bölümler ASLA yeniden kilitlenmez — açık kalırlar ki SRS seçici
// onları düşük oranda karıştırmaya devam etsin (aralıklı tekrar +
// serpiştirme; Cepeda 2006, Rohrer & Taylor 2007).
import { SUBJECTS, findTopicOfItem } from "@/data/subjects";
import { getTopicSrs, type Level, type Namespace } from "@/data/srs";
import type { ContentItem, ContentTopic } from "@/data/types";
import { isTestUnlockActive } from "@/lib/testUnlock";

const NS: Namespace = "quiz";

export function isTopicCompleted(topic: ContentTopic): boolean {
  if (topic.noPractice) return true;
  const srs = getTopicSrs(NS, topic.id);
  if (topic.items.length === 0) return true;
  for (const it of topic.items) {
    const lvl = (srs[it.id]?.level ?? 1) as Level;
    if (lvl < 3) return false;
  }
  return true;
}

export function getUnlockedTopicIds(): Set<string> {
  const out = new Set<string>();
  if (isTestUnlockActive()) {
    for (const s of SUBJECTS) for (const t of s.topics) out.add(t.id);
    return out;
  }
  for (const s of SUBJECTS) {
    let allowNext = true;
    for (const t of s.topics) {
      if (allowNext) {
        out.add(t.id);
        allowNext = isTopicCompleted(t);
      }
    }
  }
  return out;
}

export function isTopicUnlocked(topicId: string): boolean {
  return getUnlockedTopicIds().has(topicId);
}

// Bir item hangi konuya ait? → o konu açık mı?
export function isItemInUnlockedTopic(itemId: string, unlocked?: Set<string>): boolean {
  const set = unlocked ?? getUnlockedTopicIds();
  const t = findTopicOfItem(itemId);
  if (!t) return false;
  return set.has(t.topicId);
}

// ---- Konu içi bölüm (chunk) kilidi ----

// Bölümler item dizisindeki ilk görülme sırasına göre sıralanır.
export function getSectionOrder(topic: ContentTopic): string[] {
  const order: string[] = [];
  for (const it of topic.items) {
    if (it.section && !order.includes(it.section)) order.push(it.section);
  }
  return order;
}

// Açık bölümler: baştan itibaren ustalaşılan (tüm öğeler L3+) bölümler +
// ilk ustalaşılmamış bölüm (aktif çalışma bölümü). Sonrakiler kilitli.
export function getUnlockedSections(topic: ContentTopic): Set<string> {
  const order = getSectionOrder(topic);
  const out = new Set<string>();
  if (isTestUnlockActive()) {
    for (const sec of order) out.add(sec);
    return out;
  }
  const srs = getTopicSrs(NS, topic.id);
  for (const sec of order) {
    out.add(sec);
    const items = topic.items.filter((it) => it.section === sec);
    const mastered = items.every((it) => ((srs[it.id]?.level ?? 1) as Level) >= 3);
    if (!mastered) break; // burası aktif bölüm — sonrakiler kilitli kalır
  }
  return out;
}

// Konu içinde şu an çalışılabilir öğeler. Bölümsüz öğeler her zaman açıktır.
export function getUnlockedItemsOf(topic: ContentTopic): ContentItem[] {
  const secs = getUnlockedSections(topic);
  return topic.items.filter((it) => !it.section || secs.has(it.section));
}

// Tüm açık konulardaki açık öğelerin id kümesi — oyun havuzu bunu kullanır.
export function getUnlockedItemIdSet(): Set<string> {
  const topics = getUnlockedTopicIds();
  const out = new Set<string>();
  for (const s of SUBJECTS) {
    for (const t of s.topics) {
      if (!topics.has(t.id)) continue;
      for (const it of getUnlockedItemsOf(t)) out.add(it.id);
    }
  }
  return out;
}
