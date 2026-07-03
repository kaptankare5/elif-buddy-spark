// Mini Akıl - Ortak içerik tipleri ve veri katmanı

export type Lang = "tr" | "en";

// MEB okul öncesi + 1. sınıfa hazırlık (24-84 ay)
export type Age = 2 | 3 | 4 | 5 | 6 | 7;
export const ALL_AGES: Age[] = [2, 3, 4, 5, 6, 7];

export interface ContentItem {
  id: string;
  label: string;
  subLabel?: string;
  speech: string;
  lang: Lang;
  emoji?: string;
  image?: string;
  value?: number;
  colorKey?: string;
  audioGain?: number;
}

export interface ContentTopic {
  id: string;
  parent: SubjectId;
  title: string;
  description: string;
  emoji: string;
  items: ContentItem[];
  practiceMode?: "visual" | "audio" | "math";
  ages?: Age[];
  interactiveGame?: "neck" | "size" | "position" | "opposite" | "emotion";
}

export type SubjectId = "turkce" | "ingilizce" | "matematik" | "doga" | "kavramlar";

export interface Subject {
  id: SubjectId;
  title: string;
  emoji: string;
  description: string;
  bgVar: string;
  topics: ContentTopic[];
}
