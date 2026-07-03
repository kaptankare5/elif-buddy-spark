import type { ContentItem, ContentTopic, Subject, SubjectId } from "./types";
import { turkceTopics } from "./topics/turkce";
import { ingilizceTopics } from "./topics/ingilizce";
import { matematikTopics } from "./topics/matematik";
import { dogaTopics } from "./topics/doga";
import { kavramlarTopics } from "./topics/kavramlar";

export const SUBJECTS: Subject[] = [
  {
    id: "turkce",
    title: "Türkçe",
    emoji: "📖",
    description: "Harfler, sesler ve heceler",
    bgVar: "bg-[image:var(--bg-turkce)]",
    topics: turkceTopics,
  },
  {
    id: "ingilizce",
    title: "English",
    emoji: "🇬🇧",
    description: "Alphabet, colors & animals",
    bgVar: "bg-[image:var(--bg-ingilizce)]",
    topics: ingilizceTopics,
  },
  {
    id: "matematik",
    title: "Matematik",
    emoji: "🔢",
    description: "Sayılar, şekiller, toplama",
    bgVar: "bg-[image:var(--bg-matematik)]",
    topics: matematikTopics,
  },
  {
    id: "doga",
    title: "Doğa & Hayat",
    emoji: "🌳",
    description: "Hayvanlar, meslekler, mevsimler",
    bgVar: "bg-[image:var(--bg-doga)]",
    topics: dogaTopics,
  },
  {
    id: "kavramlar",
    title: "Kavramlar",
    emoji: "🧠",
    description: "Boyut, konum, duygu, zıt",
    bgVar: "bg-[image:var(--bg-kavramlar)]",
    topics: kavramlarTopics,
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
