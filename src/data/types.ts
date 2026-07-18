// Elifbâ – Ortak içerik tipleri ve veri katmanı

export type Lang = "tr" | "en" | "ar";

// Eski Age tipi bazı komponentlerde hâlâ kullanılıyor (AgePicker). Elifbâda
// yaş filtresi kullanılmıyor ama tipi kırmıyoruz.
export type Age = 2 | 3 | 4 | 5 | 6 | 7;
export const ALL_AGES: Age[] = [2, 3, 4, 5, 6, 7];

export interface ContentItem {
  id: string;
  label: string;
  subLabel?: string;
  speech: string;          // TTS için okunuş (Türkçe)
  lang: Lang;
  emoji?: string;          // Arapça harf/kelime buraya konur (oyunlar bu alanı gösterir)
  translit?: string;       // Kart arka yüzü için Türkçe transliterasyon
  audio?: string;          // /audio/elifba/... URL'i varsa doğrudan çalınır
  image?: string;
  value?: number;
  colorKey?: string;
  audioGain?: number;
  // Konu sayfasında ayrı başlık altında gösterilecek grup (örn. "Ekstralar")
  section?: string;
  // Kur'an sıklığı ağırlığı (SRS bilet çarpanı): 3 = çok sık (varsayılan —
  // çekirdek müfredatın tamamı yüksek ve eşit), 2 = sık, 1 = normal.
  // Yalnız Ekstralar öğelerinde 1-2 kullanılır; seviye seçimini değiştirmez,
  // aynı seviyedeki adaylar arasında bilet sayısını belirler.
  weight?: number;
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
  // Alıştırma yoksa (sadece konu içeriği) — kilit için de item sayılmaz
  noPractice?: boolean;
  // Konu sayfasında grid kaç kolon olsun (varsayılan 4)
  gridCols?: 2 | 3 | 4;
  // Konu videosu (YouTube izleme linki) — konu sayfasında gömülü oynatılır
  video?: string;
}

export type SubjectId = "elifba";

export interface Subject {
  id: SubjectId;
  title: string;
  emoji: string;
  description: string;
  bgVar: string;
  topics: ContentTopic[];
}
