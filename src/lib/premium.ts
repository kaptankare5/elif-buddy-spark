// Elifbâda premium kilidi yok — tüm konular ücretsiz.
// Eski API korunuyor ki mevcut çağrılar bozulmasın.
import type { SubjectId } from "@/data/types";
import { flattenItems } from "@/data/subjects";

export function isTopicFree(_subjectId: SubjectId, _topicId: string): boolean {
  return true;
}

export function freeTopicIds(): Set<string> {
  const set = new Set<string>();
  return set;
}

export function freeItemIds(): Set<string> {
  const set = new Set<string>();
  for (const it of flattenItems()) set.add(it.id);
  return set;
}
