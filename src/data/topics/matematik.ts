import type { ContentTopic } from "../types";

// MATEMATİK — MEB okul öncesi bilişsel alan, 4-5 yaş
// Sayılar 1-20, şekiller, somut nesnelerle toplama/çıkarma, örüntü

const NUMBER_NAMES_TR = [
  "", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on",
  "on bir", "on iki", "on üç", "on dört", "on beş", "on altı", "on yedi", "on sekiz", "on dokuz", "yirmi",
];

// 1-10: keycap emoji; 11-20: renkli kare-rozet içinde sayı (EmojiView "num:N:#hex" ile çizilir)
const NUMBER_EMOJIS = [
  "", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
  "num:11:#ef4444", "num:12:#f97316", "num:13:#eab308", "num:14:#22c55e",
  "num:15:#3b82f6", "num:16:#a855f7", "num:17:#ec4899", "num:18:#14b8a6",
  "num:19:#f59e0b", "num:20:#06b6d4",
];

export const matematikTopics: ContentTopic[] = [
  {
    id: "sayilar",
    parent: "matematik",
    title: "Sayılar",
    description: "1'den 20'ye sayıları öğren",
    emoji: "🔢",
    practiceMode: "visual",
    ages: [3,4,5,6],
    items: Array.from({ length: 20 }, (_, i) => i + 1).map((n) => ({
      id: `mat-sayi-${n}`,
      label: String(n),
      speech: NUMBER_NAMES_TR[n] || String(n),
      lang: "tr" as const,
      value: n,
      emoji: NUMBER_EMOJIS[n],
    })),
  },
  {
    id: "sekiller",
    parent: "matematik",
    title: "Şekiller",
    description: "Daire, kare, üçgen ve daha fazlası",
    emoji: "🔷",
    practiceMode: "visual",
    ages: [3,4,5,6],
    items: [
      { id: "sekil-daire", label: "Daire", speech: "daire", lang: "tr" as const, emoji: "🔴", audioGain: 2.2 },
      { id: "sekil-kare", label: "Kare", speech: "kare", lang: "tr" as const, emoji: "🟦", audioGain: 2.2 },
      { id: "sekil-ucgen", label: "Üçgen", speech: "üçgen", lang: "tr" as const, emoji: "🔺", audioGain: 2.2 },
      // Tek parça, renkli uzun dikdörtgen (EmojiView ile çizilir)
      { id: "sekil-dikdortgen", label: "Dikdörtgen", speech: "dikdörtgen", lang: "tr" as const, emoji: "rect:#f97316", audioGain: 2.2 },
      { id: "sekil-yildiz", label: "Yıldız", speech: "yıldız", lang: "tr" as const, emoji: "⭐", audioGain: 2.2 },
      { id: "sekil-kalp", label: "Kalp", speech: "kalp", lang: "tr" as const, emoji: "❤️", audioGain: 2.2 },
      // Tek parça, renkli altıgen (SVG)
      { id: "sekil-altigen", label: "Altıgen", speech: "altıgen", lang: "tr" as const, emoji: "hex:#a855f7", audioGain: 2.2 },
    ],
  },
  {
    id: "toplama",
    parent: "matematik",
    title: "Toplama",
    description: "Nesnelerle basit toplama",
    emoji: "➕",
    practiceMode: "math",
    ages: [5,6],
    items: Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({
      id: `top-${n}`,
      label: String(n),
      speech: NUMBER_NAMES_TR[n],
      lang: "tr" as const,
      value: n,
    })),
  },
  {
    id: "cikarma",
    parent: "matematik",
    title: "Çıkarma",
    description: "Nesnelerle basit çıkarma",
    emoji: "➖",
    practiceMode: "math",
    ages: [5,6],
    items: Array.from({ length: 10 }, (_, i) => i).map((n) => ({
      id: `cik-${n}`,
      label: String(n),
      speech: NUMBER_NAMES_TR[n] || "sıfır",
      lang: "tr" as const,
      value: n,
    })),
  },
  {
    id: "karsilastirma",
    parent: "matematik",
    title: "Az / Çok",
    description: "Hangisi daha çok? Hangisi daha az?",
    emoji: "⚖️",
    practiceMode: "math",
    ages: [4,5,6],
    items: Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({
      id: `karsi-${n}`,
      label: String(n),
      speech: NUMBER_NAMES_TR[n],
      lang: "tr" as const,
      value: n,
    })),
  },
];
