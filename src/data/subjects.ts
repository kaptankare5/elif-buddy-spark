import type { ContentItem, ContentTopic, Subject, SubjectId } from "./types";
import { elifbaTopics } from "./topics/elifba";

export const SUBJECTS: Subject[] = [
  {
    id: "elifba",
    title: "Elifbâ",
    emoji: "ﺍ",
    description: "Kur'an-ı Kerim'i okumaya hazırlık",
    bgVar: "bg-[image:var(--bg-elifba)]",
    topics: elifbaTopics,
  },
];

export function getSubject(id: SubjectId): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function getTopic(subjectId: SubjectId, topicId: string): ContentTopic | undefined {
  return getSubject(subjectId)?.topics.find((t) => t.id === topicId);
}

// Tüm konulardaki tüm itemları düzleştirir (oyunlar için havuz)
export function flattenItems(): ContentItem[] {
  return SUBJECTS.flatMap((s) => s.topics.flatMap((t) => t.items));
}

export function findItem(id: string): ContentItem | undefined {
  return flattenItems().find((it) => it.id === id);
}

// İlerleme entegrasyonu için: bir itemın hangi konuya ait olduğunu bul
export function findTopicOfItem(itemId: string): { subjectId: SubjectId; topicId: string } | undefined {
  for (const s of SUBJECTS) {
    for (const t of s.topics) {
      if (t.items.some((it) => it.id === itemId)) {
        return { subjectId: s.id, topicId: t.id };
      }
    }
  }
  return undefined;
}

// Sıralı konu listesi + kilit sistemine yardım
export function getAllTopics(): ContentTopic[] {
  return SUBJECTS.flatMap((s) => s.topics);
}
