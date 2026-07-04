// Diyanet Elifbâ — Kur'an Öğreniyorum müfredatı
// PDF: T.C. Cumhurbaşkanlığı Diyanet İşleri Başkanlığı Elifbâ Kitabı, 2025
//
// 28 temel Arap harfi + Diyanet sıralaması. Her item.emoji alanı Arapça
// glifi taşır (mevcut oyunlar bu alanı gösterir). Ses varsa item.audio
// alanında `/audio/elifba/*.mp3` gibi bir URL bulunur.
import type { ContentTopic } from "../types";

// Diyanet sıralaması ile 28 harf. Bağlı formlar (Presentation Forms-B).
// Bağlanmayan harfler (Elif, Dal, Zel, Ra, Ze, Vav): sonda formu var,
// başta/orta formları izole ile aynı görünür.
type LetterDef = {
  n: number;              // 1..28
  name: string;           // Türkçe adı
  iso: string;            // müstakil
  init: string;           // başta
  med: string;            // ortada
  fin: string;            // sonda
  speech: string;         // TTS
};

const LETTERS: LetterDef[] = [
  { n: 1,  name: "Elif", iso: "ا", init: "ا",  med: "ـا", fin: "ـا", speech: "elif" },
  { n: 2,  name: "Be",   iso: "ب", init: "ﺑ",  med: "ﺒ",  fin: "ﺐ",  speech: "be" },
  { n: 3,  name: "Te",   iso: "ت", init: "ﺗ",  med: "ﺘ",  fin: "ﺖ",  speech: "te" },
  { n: 4,  name: "Se",   iso: "ث", init: "ﺛ",  med: "ﺜ",  fin: "ﺚ",  speech: "se" },
  { n: 5,  name: "Cim",  iso: "ج", init: "ﺟ",  med: "ﺠ",  fin: "ﺞ",  speech: "cim" },
  { n: 6,  name: "Ha",   iso: "ح", init: "ﺣ",  med: "ﺤ",  fin: "ﺢ",  speech: "ha" },
  { n: 7,  name: "Hı",   iso: "خ", init: "ﺧ",  med: "ﺨ",  fin: "ﺦ",  speech: "hı" },
  { n: 8,  name: "Dal",  iso: "د", init: "د",  med: "ـد", fin: "ـد", speech: "dal" },
  { n: 9,  name: "Zel",  iso: "ذ", init: "ذ",  med: "ـذ", fin: "ـذ", speech: "zel" },
  { n: 10, name: "Ra",   iso: "ر", init: "ر",  med: "ـر", fin: "ـر", speech: "ra" },
  { n: 11, name: "Ze",   iso: "ز", init: "ز",  med: "ـز", fin: "ـز", speech: "ze" },
  { n: 12, name: "Sin",  iso: "س", init: "ﺳ",  med: "ﺴ",  fin: "ﺲ",  speech: "sin" },
  { n: 13, name: "Şin",  iso: "ش", init: "ﺷ",  med: "ﺸ",  fin: "ﺶ",  speech: "şın" },
  { n: 14, name: "Sad",  iso: "ص", init: "ﺻ",  med: "ﺼ",  fin: "ﺺ",  speech: "sad" },
  { n: 15, name: "Dad",  iso: "ض", init: "ﺿ",  med: "ﻀ",  fin: "ﺾ",  speech: "dad" },
  { n: 16, name: "Tı",   iso: "ط", init: "ﻃ",  med: "ﻄ",  fin: "ﻂ",  speech: "tı" },
  { n: 17, name: "Zı",   iso: "ظ", init: "ﻇ",  med: "ﻈ",  fin: "ﻆ",  speech: "zı" },
  { n: 18, name: "Ayn",  iso: "ع", init: "ﻋ",  med: "ﻌ",  fin: "ﻊ",  speech: "ayn" },
  { n: 19, name: "Gayn", iso: "غ", init: "ﻏ",  med: "ﻐ",  fin: "ﻎ",  speech: "gayın" },
  { n: 20, name: "Fe",   iso: "ف", init: "ﻓ",  med: "ﻔ",  fin: "ﻒ",  speech: "fe" },
  { n: 21, name: "Kaf",  iso: "ق", init: "ﻗ",  med: "ﻘ",  fin: "ﻖ",  speech: "kaf" },
  { n: 22, name: "Kef",  iso: "ك", init: "ﻛ",  med: "ﻜ",  fin: "ﻚ",  speech: "kef" },
  { n: 23, name: "Lam",  iso: "ل", init: "ﻟ",  med: "ﻠ",  fin: "ﻞ",  speech: "lam" },
  { n: 24, name: "Mim",  iso: "م", init: "ﻣ",  med: "ﻤ",  fin: "ﻢ",  speech: "mim" },
  { n: 25, name: "Nun",  iso: "ن", init: "ﻧ",  med: "ﻨ",  fin: "ﻦ",  speech: "nun" },
  { n: 26, name: "Vav",  iso: "و", init: "و",  med: "ـو", fin: "ـو", speech: "vav" },
  { n: 27, name: "He",   iso: "ه", init: "ﻫ",  med: "ﻬ",  fin: "ﻪ",  speech: "he" },
  { n: 28, name: "Ye",   iso: "ي", init: "ﻳ",  med: "ﻴ",  fin: "ﻲ",  speech: "ye" },
];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const audioPath = (name: string) => `/audio/elifba/${name}`;

// Elifba konusu (10 alt konu)
const P = "elifba" as const;

// 1. KONU — HARFLER: 28 temel harf
const t1_harfler: ContentTopic = {
  id: "harfler",
  parent: P,
  title: "1. Harfler",
  description: "28 temel Arap harfi",
  emoji: "ﺍ",
  practiceMode: "visual",
  gridCols: 4,
  items: LETTERS.map((l) => ({
    id: `l1-${pad2(l.n)}`,
    label: l.name,
    speech: l.speech,
    lang: "tr" as const,
    emoji: l.iso,
    translit: l.name,
    audio: audioPath(`basic-${pad2(l.n)}.mp3`),
  })),
};

// 2. KONU — HARFLERİN YAZILIŞLARI: her harfin başta / ortada / sonda formları
const t2_yazilislar: ContentTopic = {
  id: "yazilislar",
  parent: P,
  title: "2. Harflerin Yazılışları",
  description: "Başta, ortada ve sonda halleri",
  emoji: "ﺑ",
  practiceMode: "visual",
  gridCols: 3,
  items: LETTERS.flatMap((l) => [
    {
      id: `l2-${pad2(l.n)}-init`,
      label: `${l.name} • başta`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.init,
      translit: `${l.name} (başta)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
    },
    {
      id: `l2-${pad2(l.n)}-med`,
      label: `${l.name} • ortada`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.med,
      translit: `${l.name} (ortada)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
    },
    {
      id: `l2-${pad2(l.n)}-fin`,
      label: `${l.name} • sonda`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.fin,
      translit: `${l.name} (sonda)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
    },
  ]),
};

// 3. KONU — HAREKELER: her harf × 3 hareke (fetha / esre / ötre)
const HAREKE: Array<{ suf: "fetha" | "esre" | "otre"; mark: string; vowel: "a" | "i" | "u" }> = [
  { suf: "fetha", mark: "\u064E", vowel: "a" },  // ــَ  → "e/a"
  { suf: "esre",  mark: "\u0650", vowel: "i" },  // ــِ  → "i"
  { suf: "otre",  mark: "\u064F", vowel: "u" },  // ــُ  → "ü/u"
];
const t3_harekeler: ContentTopic = {
  id: "harekeler",
  parent: P,
  title: "3. Harekeler",
  description: "Fetha, esre ve ötre",
  emoji: "ﹷ",
  practiceMode: "visual",
  gridCols: 3,
  items: LETTERS.flatMap((l) =>
    HAREKE.map((h) => {
      // Fonetik okuyuş: elif için é/i/ü; diğerleri için harf + sesli
      const base = l.name === "Elif" ? "" : l.speech.replace(/[aeıioöuü]$/i, "");
      const sesMap: Record<string, string> = {
        a: l.name === "Elif" ? "e" : `${base}e`,
        i: l.name === "Elif" ? "i" : `${base}i`,
        u: l.name === "Elif" ? "ü" : `${base}ü`,
      };
      return {
        id: `l3-${pad2(l.n)}-${h.suf}`,
        label: `${l.name} ${h.suf}`,
        speech: sesMap[h.vowel],
        lang: "tr" as const,
        emoji: l.iso + h.mark,
        translit: sesMap[h.vowel],
        audio: audioPath(`hareke-${pad2(l.n)}-${h.suf}.mp3`),
      };
    }),
  ),
};

// 4. KONU — CEZM: her harf (Elif hariç, Kef için ses yok)
const CEZM_MISSING = new Set([22]); // 22=Kef ses yok
const t4_cezm: ContentTopic = {
  id: "cezm",
  parent: P,
  title: "4. Cezm",
  description: "Cezimli okuyuş (eb, ib, üb…)",
  emoji: "ﹿ",
  practiceMode: "visual",
  gridCols: 3,
  items: LETTERS.filter((l) => l.n >= 2).flatMap((l) => {
    // Cezm klasöründe sıralama: 01=Be, 02=Te … 21=Kef atlanmış → 22=Lam
    // (audio numarası = l.n - 1 ama Kef için hiç yok)
    const cezmIdx = l.n - 1;
    const hasAudio = !CEZM_MISSING.has(l.n);
    const base = l.speech.replace(/[aeıioöuü]$/i, "");
    return [
      { v: "e", ar: "\u0652", audio: `cezm-${pad2(cezmIdx)}-e.mp3`, sp: `e${base}` },
      { v: "i", ar: "\u0652", audio: `cezm-${pad2(cezmIdx)}-i.mp3`, sp: `i${base}` },
      { v: "u", ar: "\u0652", audio: `cezm-${pad2(cezmIdx)}-u.mp3`, sp: `ü${base}` },
    ].map((h, idx) => {
      const vowelMark = idx === 0 ? "\u064E" : idx === 1 ? "\u0650" : "\u064F"; // fetha/esre/ötre üzerinde elif
      const elifPre = idx === 0 ? "\u0627\u064E" : idx === 1 ? "\u0625\u0650" : "\u0623\u064F";
      return {
        id: `l4-${pad2(l.n)}-${h.v}`,
        label: `${h.sp}`,
        speech: h.sp,
        lang: "tr" as const,
        // Örn: أَبْ / إِبْ / أُبْ
        emoji: `${elifPre}${l.iso}\u0652`,
        translit: h.sp,
        audio: hasAudio ? audioPath(h.audio) : undefined,
      };
    });
  }),
};

// 5. KONU — ŞEDDE: her harf (Elif hariç) × 3 hareke
const t5_sedde: ContentTopic = {
  id: "sedde",
  parent: P,
  title: "5. Şedde",
  description: "Şeddeli okuyuş (ebbe, ibbi, übbü…)",
  emoji: "ﹽ",
  practiceMode: "visual",
  gridCols: 3,
  items: LETTERS.filter((l) => l.n >= 2).flatMap((l) => {
    // Sedde klasörü: 01=Be, 02=Te … 27=Ye  → idx = l.n - 1
    const idx = l.n - 1;
    const base = l.speech.replace(/[aeıioöuü]$/i, "");
    return HAREKE.map((h) => {
      const sesMap: Record<string, string> = {
        a: `e${base}${base}e`,
        i: `i${base}${base}i`,
        u: `ü${base}${base}ü`,
      };
      return {
        id: `l5-${pad2(l.n)}-${h.suf}`,
        label: sesMap[h.vowel],
        speech: sesMap[h.vowel],
        lang: "tr" as const,
        // Örn: بَّ / بِّ / بُّ
        emoji: l.iso + "\u0651" + h.mark,
        translit: sesMap[h.vowel],
        audio: audioPath(`sedde-${pad2(idx)}-${h.suf}.mp3`),
      };
    });
  }),
};

// 6. KONU — MED HARFLERİ (uzatma). PDF sayfa 16-17 örneklerinden.
const t6_med: ContentTopic = {
  id: "med",
  parent: P,
  title: "6. Med Harfleri",
  description: "Elif, vav ve ye ile uzatma",
  emoji: "ﺁ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    { ar: "بَا", sp: "bâ" }, { ar: "بِى", sp: "bî" }, { ar: "بُو", sp: "bû" },
    { ar: "تَا", sp: "tâ" }, { ar: "تِى", sp: "tî" }, { ar: "تُو", sp: "tû" },
    { ar: "ثَا", sp: "sâ" }, { ar: "ثِى", sp: "sî" }, { ar: "ثُو", sp: "sû" },
    { ar: "جَا", sp: "câ" }, { ar: "جِى", sp: "cî" }, { ar: "جُو", sp: "cû" },
    { ar: "حَا", sp: "hâ" }, { ar: "حِى", sp: "hî" }, { ar: "حُو", sp: "hû" },
    { ar: "دَا", sp: "dâ" }, { ar: "ذَا", sp: "zâ" }, { ar: "رَا", sp: "râ" },
    { ar: "زَا", sp: "zâ" }, { ar: "سَا", sp: "sâ" }, { ar: "شَا", sp: "şâ" },
    { ar: "قَالَ", sp: "kâle" }, { ar: "كَانَ", sp: "kâne" }, { ar: "كِتَابُ", sp: "kitâbü" },
  ].map((it, i) => ({
    id: `l6-${pad2(i + 1)}`,
    label: it.sp,
    speech: it.sp,
    lang: "tr" as const,
    emoji: it.ar,
    translit: it.sp,
  })),
};

// 7. KONU — ÂSAR / MED / KASR (alıştırma yok)
const t7_asar: ContentTopic = {
  id: "asar-med-kasr",
  parent: P,
  title: "7. Âsar, Med ve Kasr",
  description: "Uzatma işaretleri",
  emoji: "ﻵ",
  practiceMode: "visual",
  gridCols: 2,
  noPractice: true,
  items: [
    { ar: "هٰذَا", sp: "hâzâ" },
    { ar: "ذٰلِكَ", sp: "zâlike" },
    { ar: "اَلرَّحْمٰنِ", sp: "er-Rahmân" },
    { ar: "جَآءَ", sp: "câe" },
    { ar: "شَآءَ", sp: "şâe" },
    { ar: "يَآيُّهَا", sp: "yâ eyyühâ" },
    { ar: "ضَالِّينَ", sp: "dâllîn" },
    { ar: "حَاجُّوكُمْ", sp: "hâccûküm" },
  ].map((it, i) => ({
    id: `l7-${pad2(i + 1)}`,
    label: it.sp,
    speech: it.sp,
    lang: "tr" as const,
    emoji: it.ar,
    translit: it.sp,
  })),
};

// 8. KONU — TENVİN
const t8_tenvin: ContentTopic = {
  id: "tenvin",
  parent: P,
  title: "8. Tenvin",
  description: "İki üstün, iki esre, iki ötre",
  emoji: "ࣰ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    { ar: "نُورًا", sp: "nûran" }, { ar: "مَالًا", sp: "mâlen" }, { ar: "قَصَصًا", sp: "kasasan" },
    { ar: "شَمْسٌ", sp: "şemsün" }, { ar: "حَسَنَةٌ", sp: "hasenetün" }, { ar: "صَبْرٌ", sp: "sabrun" },
    { ar: "ذِكْرٍ", sp: "zikrin" }, { ar: "خَيْرٍ", sp: "hayrin" }, { ar: "لَيْلٍ", sp: "leylin" },
    { ar: "هَدِيَّةً", sp: "hediyyeten" }, { ar: "مُسْتَقَرٌّ", sp: "müstekarrun" }, { ar: "لَيْلَةٌ", sp: "leyletün" },
  ].map((it, i) => ({
    id: `l8-${pad2(i + 1)}`,
    label: it.sp,
    speech: it.sp,
    lang: "tr" as const,
    emoji: it.ar,
    translit: it.sp,
  })),
};

// 9. KONU — ZAMİR & LAFZATULLAH (alıştırma yok)
const t9_zamir: ContentTopic = {
  id: "zamir-lafzatullah",
  parent: P,
  title: "9. Zamir ve Lafzatullah",
  description: "Allah lafzının okunuşu",
  emoji: "ﷲ",
  practiceMode: "visual",
  gridCols: 2,
  noPractice: true,
  items: [
    { ar: "اَللّٰهُ", sp: "Allâh" },
    { ar: "بِاللّٰهِ", sp: "billâhi" },
    { ar: "مَعَ اللّٰهِ", sp: "meallâhi" },
    { ar: "قُلِ اللَّهُمَّ", sp: "kulillâhümme" },
    { ar: "فَإِنَّ اللّٰهَ", sp: "feinnallâhe" },
    { ar: "لَهُ", sp: "lehû" },
    { ar: "لَهُمْ", sp: "lehüm" },
    { ar: "بِهِ", sp: "bihî" },
  ].map((it, i) => ({
    id: `l9-${pad2(i + 1)}`,
    label: it.sp,
    speech: it.sp,
    lang: "tr" as const,
    emoji: it.ar,
    translit: it.sp,
  })),
};

// 10. KONU — ELİF-LÂM TAKISI ve RÂ (alıştırma yok)
const t10_elif_lam: ContentTopic = {
  id: "elif-lam-ra",
  parent: P,
  title: "10. Elif-Lâm Takısı ve Râ",
  description: "ال takısı ve râ harfinin okunuşu",
  emoji: "ﺍﻟ",
  practiceMode: "visual",
  gridCols: 2,
  noPractice: true,
  items: [
    { ar: "اَلْبَيْتُ", sp: "el-beytü" },
    { ar: "اَلشَّمْسُ", sp: "eş-şemsü" },
    { ar: "اَلرَّحْمٰنُ", sp: "er-Rahmân" },
    { ar: "اَلْحَمْدُ", sp: "el-hamdü" },
    { ar: "وَيَسِّرْ لِى", sp: "ve yessir lî" },
    { ar: "فَطَهِّرْ", sp: "fetahhir" },
    { ar: "وَاسْتَغْفِرْهُ", sp: "vestağfirhü" },
    { ar: "رَبِّ", sp: "Rabbi" },
  ].map((it, i) => ({
    id: `l10-${pad2(i + 1)}`,
    label: it.sp,
    speech: it.sp,
    lang: "tr" as const,
    emoji: it.ar,
    translit: it.sp,
  })),
};

export const elifbaTopics: ContentTopic[] = [
  t1_harfler,
  t2_yazilislar,
  t3_harekeler,
  t4_cezm,
  t5_sedde,
  t6_med,
  t7_asar,
  t8_tenvin,
  t9_zamir,
  t10_elif_lam,
];
