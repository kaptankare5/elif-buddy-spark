import type { ContentTopic } from "../types";

// MEB OKUL ÖNCESİ — Kavramlar (sade set: sadece interaktif oyunlu olanlar + taşıtlar)

export const kavramlarTopics: ContentTopic[] = [
  {
    id: "buyuk-kucuk",
    parent: "kavramlar",
    title: "Büyük & Küçük",
    description: "Boyut karşılaştırma",
    emoji: "🔵",
    practiceMode: "visual",
    ages: [3, 4, 5, 6],
    interactiveGame: "size",
    items: [
      { id: "kav-buyuk-fil", label: "Büyük", subLabel: "Fil", speech: "büyük", lang: "tr", emoji: "🐘" },
      { id: "kav-kucuk-fare", label: "Küçük", subLabel: "Fare", speech: "küçük", lang: "tr", emoji: "🐭" },
    ],
  },
  {
    id: "uzun-kisa",
    parent: "kavramlar",
    title: "Uzun & Kısa",
    description: "Boy karşılaştırma",
    emoji: "📏",
    practiceMode: "visual",
    ages: [4, 5, 6],
    interactiveGame: "neck",
    items: [
      { id: "kav-uzun-zurafa", label: "Uzun", subLabel: "Zürafa", speech: "uzun", lang: "tr", emoji: "🦒" },
      { id: "kav-kisa-kirpi", label: "Kısa", subLabel: "Kirpi", speech: "kısa", lang: "tr", emoji: "🦔" },
    ],
  },
  {
    id: "tasitlar",
    parent: "kavramlar",
    title: "Taşıtlar",
    description: "Kara, hava ve deniz taşıtları",
    emoji: "🚗",
    practiceMode: "visual",
    ages: [3, 4, 5, 6],
    items: [
      { id: "tas-araba", label: "Araba", speech: "araba", lang: "tr", emoji: "🚗" },
      { id: "tas-otobus", label: "Otobüs", speech: "otobüs", lang: "tr", emoji: "🚌" },
      { id: "tas-kamyon", label: "Kamyon", speech: "kamyon", lang: "tr", emoji: "🚚" },
      { id: "tas-tren", label: "Tren", speech: "tren", lang: "tr", emoji: "🚆" },
      { id: "tas-bisiklet", label: "Bisiklet", speech: "bisiklet", lang: "tr", emoji: "🚲" },
      { id: "tas-motosiklet", label: "Motosiklet", speech: "motosiklet", lang: "tr", emoji: "🏍️" },
      { id: "tas-ucak", label: "Uçak", speech: "uçak", lang: "tr", emoji: "✈️" },
      { id: "tas-helikopter", label: "Helikopter", speech: "helikopter", lang: "tr", emoji: "🚁" },
      { id: "tas-gemi", label: "Gemi", speech: "gemi", lang: "tr", emoji: "🚢" },
      { id: "tas-kayik", label: "Kayık", speech: "kayık", lang: "tr", emoji: "🛶" },
      { id: "tas-roket", label: "Roket", speech: "roket", lang: "tr", emoji: "🚀" },
      { id: "tas-itfaiye", label: "İtfaiye", speech: "itfaiye arabası", lang: "tr", emoji: "🚒" },
    ],
  },
];
