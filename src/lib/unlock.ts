// Konu kilidi sistemi.
// Kural: Bir konudaki tüm itemların SRS seviyesi >= 3 olduğunda sonraki
// konu açılır. İlk konu her zaman açıktır. `noPractice: true` konular
// otomatik olarak "tamamlanmış" sayılır (alıştırma yok).
import { SUBJECTS, findTopicOfItem } from "@/data/subjects";
import { getTopicSrs, type Level, type Namespace } from "@/data/srs";
import type { ContentTopic } from "@/data/types";

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
