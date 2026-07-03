// Konuların ücretsiz/premium ayrımı.
// Her ders alanının ilk yarısı ücretsiz, geri kalanı premium (abonelik).
// Oyunlar her zaman açık; sadece oyunlardaki içerik havuzu da kilitli konuları
// dışarıda bırakır (premium değilse).
import { SUBJECTS } from "@/data/subjects";
import type { SubjectId } from "@/data/types";

// Her alan için ücretsiz konu sayısı (yarısı, en az 1)
function freeCount(total: number): number {
  if (total <= 1) return total;
  return Math.ceil(total / 2);
}

// Belirli bir konu free mi?
export function isTopicFree(subjectId: SubjectId, topicId: string): boolean {
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  if (!subject) return true;
  const idx = subject.topics.findIndex((t) => t.id === topicId);
  if (idx < 0) return true;
  return idx < freeCount(subject.topics.length);
}

// Tüm ücretsiz konu id'lerini (subject:topic) döndürür
export function freeTopicIds(): Set<string> {
  const set = new Set<string>();
  for (const s of SUBJECTS) {
    const fc = freeCount(s.topics.length);
    s.topics.slice(0, fc).forEach((t) => set.add(`${s.id}:${t.id}`));
  }
  return set;
}

// Ücretsiz konulardaki tüm item id'leri
export function freeItemIds(): Set<string> {
  const set = new Set<string>();
  for (const s of SUBJECTS) {
    const fc = freeCount(s.topics.length);
    for (const t of s.topics.slice(0, fc)) {
      for (const it of t.items) set.add(it.id);
    }
  }
  return set;
}
