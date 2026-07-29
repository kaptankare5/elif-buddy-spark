// Diyanet Elifbâ — Kur'an Öğreniyorum müfredatı
// PDF: T.C. Cumhurbaşkanlığı Diyanet İşleri Başkanlığı Elifbâ Kitabı, 2025
//
// 28 temel Arap harfi + Diyanet sıralaması. Her item.emoji alanı Arapça
// glifi taşır (mevcut oyunlar bu alanı gösterir). Ses varsa item.audio
// alanında `/audio/elifba/*.mp3` gibi bir URL bulunur.
import type { ContentItem, ContentTopic } from "../types";

// İnce/kalın (tefhim) sınıfı: hareke okunuşunun hangi sesli harflerle
// yazılacağını belirler. "kalin" → a/ı/u (خ ص ض ط ظ غ ق — klasik 7 tefhim
// harfi), "ince" → e/i/ü, "ra" → Râ'ya özgü karışık kural: üstün ve ötreyle
// kalın (ra/ru), esreyle ince (ri) okunur.
type Thickness = "ince" | "kalin" | "ra";

type LetterDef = {
  n: number;              // 1..28
  name: string;           // Türkçe adı
  iso: string;            // müstakil
  init: string;           // başta
  med: string;            // ortada
  fin: string;            // sonda
  speech: string;         // TTS (harfin tek başına okunuşu)
  cons: string;           // harekeli okunuş için temel ünsüz sesi ("" = Elif/Ayn gibi ünsüzsüz)
  thick: Thickness;
};

const LETTERS: LetterDef[] = [
  { n: 1,  name: "Elif", iso: "ا", init: "ا",  med: "ـا", fin: "ـا", speech: "elif", cons: "",  thick: "ince" },
  { n: 2,  name: "Be",   iso: "ب", init: "ﺑ",  med: "ﺒ",  fin: "ﺐ",  speech: "be",   cons: "b", thick: "ince" },
  { n: 3,  name: "Te",   iso: "ت", init: "ﺗ",  med: "ﺘ",  fin: "ﺖ",  speech: "te",   cons: "t", thick: "ince" },
  { n: 4,  name: "Se",   iso: "ث", init: "ﺛ",  med: "ﺜ",  fin: "ﺚ",  speech: "se",   cons: "s", thick: "ince" },
  { n: 5,  name: "Cim",  iso: "ج", init: "ﺟ",  med: "ﺠ",  fin: "ﺞ",  speech: "cim",  cons: "c", thick: "ince" },
  { n: 6,  name: "Ha",   iso: "ح", init: "ﺣ",  med: "ﺤ",  fin: "ﺢ",  speech: "ha",   cons: "h", thick: "ince" },
  { n: 7,  name: "Hı",   iso: "خ", init: "ﺧ",  med: "ﺨ",  fin: "ﺦ",  speech: "hı",   cons: "h", thick: "kalin" },
  { n: 8,  name: "Dal",  iso: "د", init: "د",  med: "ـد", fin: "ـد", speech: "dal",  cons: "d", thick: "ince" },
  { n: 9,  name: "Zel",  iso: "ذ", init: "ذ",  med: "ـذ", fin: "ـذ", speech: "zel",  cons: "z", thick: "ince" },
  { n: 10, name: "Ra",   iso: "ر", init: "ر",  med: "ـر", fin: "ـر", speech: "ra",   cons: "r", thick: "ra" },
  { n: 11, name: "Ze",   iso: "ز", init: "ز",  med: "ـز", fin: "ـز", speech: "ze",   cons: "z", thick: "ince" },
  { n: 12, name: "Sin",  iso: "س", init: "ﺳ",  med: "ﺴ",  fin: "ﺲ",  speech: "sin",  cons: "s", thick: "ince" },
  { n: 13, name: "Şin",  iso: "ش", init: "ﺷ",  med: "ﺸ",  fin: "ﺶ",  speech: "şin",  cons: "ş", thick: "ince" },
  { n: 14, name: "Sad",  iso: "ص", init: "ﺻ",  med: "ﺼ",  fin: "ﺺ",  speech: "sad",  cons: "s", thick: "kalin" },
  { n: 15, name: "Dad",  iso: "ض", init: "ﺿ",  med: "ﻀ",  fin: "ﺾ",  speech: "dad",  cons: "d", thick: "kalin" },
  { n: 16, name: "Tı",   iso: "ط", init: "ﻃ",  med: "ﻄ",  fin: "ﻂ",  speech: "tı",   cons: "t", thick: "kalin" },
  { n: 17, name: "Zı",   iso: "ظ", init: "ﻇ",  med: "ﻈ",  fin: "ﻆ",  speech: "zı",   cons: "z", thick: "kalin" },
  { n: 18, name: "Ayn",  iso: "ع", init: "ﻋ",  med: "ﻌ",  fin: "ﻊ",  speech: "ayn",  cons: "",  thick: "ince" },
  { n: 19, name: "Gayn", iso: "غ", init: "ﻏ",  med: "ﻐ",  fin: "ﻎ",  speech: "gayın", cons: "g", thick: "kalin" },
  { n: 20, name: "Fe",   iso: "ف", init: "ﻓ",  med: "ﻔ",  fin: "ﻒ",  speech: "fe",   cons: "f", thick: "ince" },
  { n: 21, name: "Kaf",  iso: "ق", init: "ﻗ",  med: "ﻘ",  fin: "ﻖ",  speech: "kaf",  cons: "k", thick: "kalin" },
  { n: 22, name: "Kef",  iso: "ك", init: "ﻛ",  med: "ﻜ",  fin: "ﻚ",  speech: "kef",  cons: "k", thick: "ince" },
  { n: 23, name: "Lem",  iso: "ل", init: "ﻟ",  med: "ﻠ",  fin: "ﻞ",  speech: "lem",  cons: "l", thick: "ince" },
  { n: 24, name: "Mim",  iso: "م", init: "ﻣ",  med: "ﻤ",  fin: "ﻢ",  speech: "mim",  cons: "m", thick: "ince" },
  { n: 25, name: "Nun",  iso: "ن", init: "ﻧ",  med: "ﻨ",  fin: "ﻦ",  speech: "nun",  cons: "n", thick: "ince" },
  { n: 26, name: "Vev",  iso: "و", init: "و",  med: "ـو", fin: "ـو", speech: "vev",  cons: "v", thick: "ince" },
  { n: 27, name: "He",   iso: "ه", init: "ﻫ",  med: "ﻬ",  fin: "ﻪ",  speech: "he",   cons: "h", thick: "ince" },
  { n: 28, name: "Ye",   iso: "ي", init: "ﻳ",  med: "ﻴ",  fin: "ﻲ",  speech: "ye",   cons: "y", thick: "ince" },
];

// Harekeli okunuş için sesli harf seti: kalın harflerde a/ı/u, ince
// harflerde e/i/ü; Râ üstün ve ötrede kalın, esrede ince okunur (ra, ri, ru).
function harekeVowels(thick: Thickness): { a: string; i: string; u: string } {
  if (thick === "kalin") return { a: "a", i: "ı", u: "u" };
  if (thick === "ra") return { a: "a", i: "i", u: "u" };
  return { a: "e", i: "i", u: "ü" };
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const audioPath = (name: string) => `/audio/elifba/${name}`;
const byName = new Map(LETTERS.map((l) => [l.name, l]));

// Bilişsel yük teorisi: çocuklarda çalışma belleği ~4 öğe kaldırır.
// Uzun konular harf numarasına göre 4'erli bölümlere ayrılır; bölümdeki tüm
// öğeler seviye 3+'a ulaşınca sıradaki bölüm açılır (unlock.ts). Bölüm adları
// tüm konularda aynı harf grubunu işaret eder (tutarlı zihinsel harita).
const bolum = (n: number) => `${Math.floor((n - 1) / 4) + 1}. Bölüm`;

// Elifba konusu (10 alt konu)
const P = "elifba" as const;

// 1. KONU — HARFLER: 28 temel harf
// Çocuk aşırı yüklenmesin diye 4'erli bölümlere ayrılır (7 bölüm). Bölümler
// yalnızca görsel gruplamadır — hepsi aynı konudadır, aralarında kilit yoktur.
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
    section: bolum(l.n),
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
      section: bolum(l.n),
    },
    {
      id: `l2-${pad2(l.n)}-med`,
      label: `${l.name} • ortada`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.med,
      translit: `${l.name} (ortada)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
      section: bolum(l.n),
    },
    {
      id: `l2-${pad2(l.n)}-fin`,
      label: `${l.name} • sonda`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.fin,
      translit: `${l.name} (sonda)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
      section: bolum(l.n),
    },
  ]),
};

// 3. KONU — HAREKELER: her harf × 3 hareke (fetha / esre / ötre)
const HAREKE: Array<{ suf: "fetha" | "esre" | "otre"; mark: string; vowel: "a" | "i" | "u" }> = [
  { suf: "fetha", mark: "َ", vowel: "a" },  // ــَ  → "e/a"
  { suf: "esre",  mark: "ِ", vowel: "i" },  // __ِ  → "i/ı"
  { suf: "otre",  mark: "ُ", vowel: "u" },  // ــُ  → "ü/u"
];

// ---- Sayfa 10-11 alıştırma kelimeleri (Diyanet Elifbâ) ----
// Her kelime [harf adı, hareke] dizisi. Kelimeler pozisyonlu (başta/ortada/
// sonda) harekeli harf kartlarına bölünür ve tekrarlar ayıklanır.
type HV = "a" | "i" | "u";
type WordSpec = [string, HV][];
const HAREKE_ALISTIRMA_KELIMELERI: WordSpec[] = [
  // sayfa 10
  [["Dad", "a"], ["Ra", "a"], ["Be", "a"]],      // ضَرَبَ
  [["Kaf", "a"], ["Ra", "a"], ["Elif", "a"]],    // قَرَاَ
  [["Ra", "a"], ["Cim", "a"], ["Ayn", "a"]],     // رَجَعَ
  [["Ra", "a"], ["Ze", "a"], ["Kaf", "a"]],      // رَزَقَ
  [["Sad", "a"], ["Be", "a"], ["Ra", "a"]],      // صَبَرَ
  [["Ra", "a"], ["Fe", "a"], ["Ayn", "a"]],      // رَفَعَ
  [["Ye", "a"], ["Dal", "a"], ["Kef", "a"]],     // يَدَكَ
  [["Zı", "a"], ["He", "a"], ["Ra", "a"]],       // ظَهَرَ
  [["Ha", "a"], ["Mim", "i"], ["Dal", "a"]],     // حَمِدَ
  [["Sin", "a"], ["Mim", "i"], ["Ayn", "a"]],    // سَمِعَ
  [["Ayn", "a"], ["Mim", "i"], ["Lem", "a"]],    // عَمِلَ
  [["Sad", "a"], ["Ayn", "i"], ["Kaf", "a"]],    // صَعِقَ
  [["Sad", "a"], ["Ayn", "i"], ["Dal", "a"]],    // صَعِدَ
  [["Tı", "a"], ["Fe", "i"], ["Kaf", "a"]],      // طَفِقَ
  [["Nun", "a"], ["Dad", "i"], ["Cim", "a"]],    // نَضِجَ
  [["Fe", "a"], ["Ra", "i"], ["Ha", "a"]],       // فَرِحَ
  [["Se", "u"], ["Lem", "u"], ["Se", "u"]],      // ثُلُثُ
  [["Kef", "u"], ["Te", "u"], ["Be", "u"]],      // كُتُبُ
  [["Hı", "u"], ["Lem", "u"], ["Kaf", "u"]],     // خُلُقُ
  [["Ra", "u"], ["Sin", "u"], ["Lem", "u"]],     // رُسُلُ
  [["Sad", "a"], ["Mim", "a"], ["Dal", "u"]],    // صَمَدُ
  [["Fe", "a"], ["He", "u"], ["Vev", "a"]],      // فَهُوَ
  [["Kaf", "u"], ["Te", "i"], ["Lem", "a"]],     // قُتِلَ
  [["Ra", "a"], ["Gayn", "i"], ["Be", "a"]],     // رَغِبَ
  [["Mim", "a"], ["Ra", "i"], ["Dad", "a"]],     // مَرِضَ
  [["Gayn", "u"], ["Fe", "i"], ["Ra", "a"]],     // غُفِرَ
  [["Zel", "u"], ["Kef", "i"], ["Ra", "a"]],     // ذُكِرَ
  // sayfa 11
  [["Şin", "a"], ["Cim", "a"], ["Ra", "a"]],     // شَجَرَ
  [["Sin", "u"], ["Be", "u"], ["Lem", "a"]],     // سُبُلَ
  [["Kef", "a"], ["Zel", "i"], ["Be", "a"]],     // كَذِبَ
  [["Hı", "a"], ["Tı", "i"], ["Ra", "a"]],       // خَطِرَ
  [["Te", "a"], ["Be", "i"], ["Ayn", "a"]],      // تَبِعَ
  [["Kef", "a"], ["Sin", "a"], ["Be", "a"]],     // كَسَبَ
  [["Tı", "u"], ["Be", "i"], ["Ayn", "a"]],      // طُبِعَ
  [["Ra", "a"], ["Kef", "i"], ["Be", "a"]],      // رَكِبَ
  [["Ha", "a"], ["Sin", "u"], ["Nun", "a"]],     // حَسُنَ
  [["Lem", "a"], ["Ayn", "i"], ["Be", "a"]],     // لَعِبَ
  [["Sad", "a"], ["Dal", "a"], ["Kaf", "a"]],    // صَدَقَ
  [["Ayn", "u"], ["Nun", "u"], ["Kaf", "u"]],    // عُنُقُ
  [["Vev", "a"], ["Sad", "a"], ["Fe", "a"]],     // وَصَفَ
  [["Vev", "a"], ["Sin", "i"], ["Ayn", "a"]],    // وَسِعَ
  [["Dal", "a"], ["Hı", "a"], ["Lem", "a"]],     // دَخَلَ
  [["Sin", "a"], ["Ra", "i"], ["Ayn", "a"]],     // سَرِعَ
  [["Nun", "a"], ["Kef", "a"], ["Sad", "a"]],    // نَكَصَ
  [["Fe", "a"], ["Ze", "i"], ["Ayn", "a"]],      // فَزِعَ
  [["Ra", "u"], ["Ze", "i"], ["Kaf", "a"]],      // رُزِقَ
  [["Be", "a"], ["Ra", "a"], ["Ze", "a"]],       // بَرَزَ
  [["Ra", "u"], ["Be", "u"], ["Ayn", "u"]],      // رُبُعُ
  [["Kef", "a"], ["Ra", "i"], ["He", "a"]],      // كَرِهَ
  [["Lem", "a"], ["Ayn", "a"], ["Nun", "a"]],    // لَعَنَ
  [["Ha", "a"], ["Sin", "i"], ["Be", "a"]],      // حَسِبَ
  [["Be", "a"], ["Tı", "a"], ["Nun", "a"]],      // بَطَنَ
  [["Sin", "a"], ["Hı", "i"], ["Ra", "a"]],      // سَخِرَ
  [["Ra", "a"], ["He", "i"], ["Kaf", "a"]],      // رَهِقَ
];

// Sonrasına bağlanmayan harfler: bir sonraki harf başta/müstakil formunu alır.
const NON_CONNECT = new Set(["Elif", "Dal", "Zel", "Ra", "Ze", "Vev"]);
const HV_TO_SUF: Record<HV, "fetha" | "esre" | "otre"> = { a: "fetha", i: "esre", u: "otre" };
const HV_MARK: Record<HV, string> = { a: "َ", i: "ِ", u: "ُ" };

// Kelimeleri pozisyonlu harekeli harf kartlarına böler ve tekrarları ayıklar.
// Müstakil (izole) hâller atlanır — bunlar konunun temel kartlarında zaten var.
function buildHarekeExtras(): ContentItem[] {
  const seen = new Set<string>();
  const out: ContentItem[] = [];
  for (const word of HAREKE_ALISTIRMA_KELIMELERI) {
    for (let i = 0; i < word.length; i++) {
      const [name, hv] = word[i];
      const l = byName.get(name);
      if (!l) continue;
      const prevConnects = i > 0 && !NON_CONNECT.has(word[i - 1][0]);
      const hasNext = i < word.length - 1;
      const pos = !prevConnects && hasNext ? "init" : prevConnects && hasNext ? "med" : prevConnects ? "fin" : "iso";
      if (pos === "iso") continue;
      const form = pos === "init" ? l.init : pos === "med" ? l.med : l.fin;
      if (form === l.iso) continue; // bağlanmayan harflerin başta hâli müstakille aynı
      // Glif temelli tekrar ayıklama: bağlanmayan harflerde ortada/sonda formu
      // aynı görünür (ـر) — ikisinden yalnız biri eklensin.
      const key = `${l.n}|${form}|${hv}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const v = harekeVowels(l.thick);
      const read = `${l.cons}${v[hv]}`;
      const posTr = pos === "init" ? "başta" : pos === "med" ? "ortada" : "sonda";
      const suf = HV_TO_SUF[hv];
      const harekeAd = suf === "fetha" ? "fethalı" : suf === "esre" ? "esreli" : "ötreli";
      out.push({
        id: `l3x-${pad2(l.n)}-${pos}-${hv}`,
        label: `${l.name} ${posTr} ${harekeAd}`,
        speech: read,
        lang: "tr" as const,
        emoji: form + HV_MARK[hv],
        translit: read,
        audio: audioPath(`hareke-${pad2(l.n)}-${suf}.mp3`),
        section: "Ekstralar",
      });
    }
  }
  return out;
}

const t3_harekeler: ContentTopic = {
  id: "harekeler",
  parent: P,
  title: "3. Harekeler",
  description: "Fetha, esre ve ötre",
  emoji: "ﹷ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...LETTERS.flatMap((l) =>
      HAREKE.map((h) => {
        // Fonetik okuyuş: temel ünsüz + ince/kalın/râ kuralına göre sesli harf
        const v = harekeVowels(l.thick);
        const sesMap: Record<string, string> = {
          a: `${l.cons}${v.a}`,
          i: `${l.cons}${v.i}`,
          u: `${l.cons}${v.u}`,
        };
        return {
          id: `l3-${pad2(l.n)}-${h.suf}`,
          label: `${l.name} ${h.suf}`,
          speech: sesMap[h.vowel],
          lang: "tr" as const,
          emoji: l.iso + h.mark,
          translit: sesMap[h.vowel],
          audio: audioPath(`hareke-${pad2(l.n)}-${h.suf}.mp3`),
          section: bolum(l.n),
        };
      }),
    ),
    ...buildHarekeExtras(),
  ],
};

// 4. KONU — CEZM: her harf (Elif hariç, Kef için ses yok)
const CEZM_MISSING = new Set([22]); // 22=Kef ses yok

// Sayfa 13 alıştırmalarından 2 harfli cezm heceleri (lem-yelid → lem + lid)
const CEZM_EKSTRA: Array<[string, string]> = [
  ["مِنْ", "min"], ["هُمْ", "hüm"], ["لَمْ", "lem"], ["قُلْ", "kul"],
  ["يَوْ", "yev"], ["كُمْ", "küm"], ["كَيْ", "key"], ["قَبْ", "kab"],
  ["اَنْ", "en"], ["اَكْ", "ek"], ["اَرْ", "er"], ["كُنْ", "kün"],
  ["تُمْ", "tüm"], ["لِدْ", "lid"], ["اِسْ", "is"], ["تَكْ", "tek"],
  ["لَسْ", "les"], ["نَعْ", "na'"], ["حَتْ", "het"], ["لَيْ", "ley"],
  ["هِمْ", "him"], ["اَيْ", "ey"], ["تَوْ", "tev"], ["قَوْ", "kav"],
  ["تُنْ", "tün"], ["ذِرْ", "zir"], ["ذَرْ", "zer"], ["اَفْ", "ef"],
];

const t4_cezm: ContentTopic = {
  id: "cezm",
  parent: P,
  title: "4. Cezm",
  description: "Cezimli okuyuş (eb, ib, üb…)",
  emoji: "ﹿ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...LETTERS.filter((l) => l.n >= 2).flatMap((l) => {
      // Cezm klasöründe sıralama: 01=Be, 02=Te … 21=Kef atlanmış → 22=Lem
      // (audio numarası = l.n - 1 ama Kef için hiç yok)
      const cezmIdx = l.n - 1;
      const hasAudio = !CEZM_MISSING.has(l.n);
      const base = l.cons;
      const v = harekeVowels(l.thick);
      return [
        { v: "e", audio: `cezm-${pad2(cezmIdx)}-e.mp3`, sp: `${v.a}${base}` },
        { v: "i", audio: `cezm-${pad2(cezmIdx)}-i.mp3`, sp: `${v.i}${base}` },
        { v: "u", audio: `cezm-${pad2(cezmIdx)}-u.mp3`, sp: `${v.u}${base}` },
      ].map((h, idx) => {
        const elifPre = idx === 0 ? "اَ" : idx === 1 ? "إِ" : "أُ";
        return {
          id: `l4-${pad2(l.n)}-${h.v}`,
          label: `${h.sp}`,
          speech: h.sp,
          lang: "tr" as const,
          // Örn: أَبْ / إِبْ / أُبْ
          emoji: `${elifPre}${l.iso}ْ`,
          translit: h.sp,
          audio: hasAudio ? audioPath(h.audio) : undefined,
          section: bolum(l.n),
        };
      });
    }),
    ...CEZM_EKSTRA.map(([ar, sp], i) => ({
      id: `l4x-${pad2(i + 1)}`,
      label: sp,
      speech: sp.replace(/'/g, ""),
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      section: "Ekstralar",
    })),
  ],
};

// 5. KONU — ŞEDDE: her harf (Elif hariç) × 3 hareke

// Sayfa 15 alıştırmalarından 2 harfli şedde heceleri
const SEDDE_EKSTRA: Array<[string, string]> = [
  ["زَيَّ", "zeyye"], ["عَلَّ", "alle"], ["حَقُّ", "hakku"], ["كُلُّ", "küllü"],
  ["نَزَّ", "nezze"], ["ظُنُّ", "zunnü"], ["سَبِّ", "sebbi"], ["جَنَّ", "cenne"],
  ["مُدَّ", "müdde"], ["هَنَّ", "henne"], ["فَصَّ", "fassa"], ["شَرِّ", "şerri"],
  ["فُصِّ", "fussı"], ["اِتَّ", "itte"], ["بَشِّ", "beşşi"], ["وَجَّ", "vecce"],
  ["وَكَّ", "vekke"], ["كَذِّ", "kezzi"], ["بَيِّ", "beyyi"], ["نَبِّ", "nebbi"],
  ["لَنَّ", "lenne"],
];

const t5_sedde: ContentTopic = {
  id: "sedde",
  parent: P,
  title: "5. Şedde",
  description: "Şeddeli okuyuş (ebbe, ibbi, übbü…)",
  emoji: "ﹽ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...LETTERS.filter((l) => l.n >= 2).flatMap((l) => {
      // Sedde klasörü: 01=Be, 02=Te … 27=Ye  → idx = l.n - 1
      const idx = l.n - 1;
      const base = l.cons;
      const v = harekeVowels(l.thick);
      return HAREKE.map((h) => {
        const sesMap: Record<string, string> = {
          a: `${v.a}${base}${base}${v.a}`,
          i: `${v.i}${base}${base}${v.i}`,
          u: `${v.u}${base}${base}${v.u}`,
        };
        return {
          id: `l5-${pad2(l.n)}-${h.suf}`,
          label: sesMap[h.vowel],
          speech: sesMap[h.vowel],
          lang: "tr" as const,
          // Örn: بَّ / بِّ / بُّ
          emoji: l.iso + "ّ" + h.mark,
          translit: sesMap[h.vowel],
          audio: audioPath(`sedde-${pad2(idx)}-${h.suf}.mp3`),
          section: bolum(l.n),
        };
      });
    }),
    ...SEDDE_EKSTRA.map(([ar, sp], i) => ({
      id: `l5x-${pad2(i + 1)}`,
      label: sp,
      speech: sp,
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      section: "Ekstralar",
    })),
  ],
};

// 6. KONU — MED HARFLERİ (uzatma). PDF sayfa 16-17 örneklerinden.

// Sayfa 17 alıştırmalarından 2 harfli med heceleri (temel kartlarda olmayanlar)
const MED_EKSTRA: Array<[string, string]> = [
  ["قَا", "kâ"], ["كَا", "kâ"], ["وَا", "vâ"], ["ضَا", "dâ"], ["مَا", "mâ"],
  ["خِى", "hî"], ["دِى", "dî"], ["ظِى", "zî"], ["مِى", "mî"], ["قِى", "kî"],
  ["طِى", "tî"], ["نِى", "nî"], ["لُو", "lû"], ["كُو", "kû"], ["نُو", "nû"],
  ["عُو", "û"], ["سُو", "sû"], ["مُو", "mû"], ["رُو", "rû"], ["دُو", "dû"],
];

const t6_med: ContentTopic = {
  id: "med",
  parent: P,
  title: "6. Med Harfleri",
  description: "Elif, vav ve ye ile uzatma",
  emoji: "ﺁ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...[
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
      // Med listesi harf-numarası düzeninde değil — sıralı 6'lı gruplar
      section: `${Math.floor(i / 6) + 1}. Bölüm`,
    })),
    ...MED_EKSTRA.map(([ar, sp], i) => ({
      id: `l6x-${pad2(i + 1)}`,
      label: sp,
      speech: sp,
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      section: "Ekstralar",
    })),
  ],
};

// 7. KONU — ÂSAR / MED / KASR: Diyanet'in konu videosu (kitaptaki karekod)
const t7_asar: ContentTopic = {
  id: "asar-med-kasr",
  parent: P,
  title: "7. Âsar, Med ve Kasr",
  description: "Uzatma işaretleri — videoyu izle",
  emoji: "ﻵ",
  practiceMode: "visual",
  gridCols: 2,
  noPractice: true,
  video: "https://www.youtube.com/watch?v=s6oYG1Bl77E",
  items: [],
};

// 8. KONU — TENVİN: her harf × iki üstün / iki esre / iki ötre (sayfa 19)
// Not: tenvin için ayrı mp3 yok — TTS okur.

// Sayfa 20-21 alıştırmalarından 2 harfli tenvin heceleri
const TENVIN_EKSTRA: Array<[string, string]> = [
  ["بَدًا", "beden"], ["بَةً", "beten"], ["نَةً", "neten"], ["نَةٌ", "netün"],
  ["يَةٌ", "yetün"], ["قَةٍ", "katin"], ["لَةٌ", "letün"], ["دَةٌ", "detün"],
];

const t8_tenvin: ContentTopic = {
  id: "tenvin",
  parent: P,
  title: "8. Tenvin",
  description: "İki üstün, iki esre, iki ötre",
  emoji: "ࣰ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...LETTERS.flatMap((l) => {
      const v = harekeVowels(l.thick);
      const defs = [
        // iki üstün: harf + fethatan + elif (بًا) — elif kendisi yalnız "اً"
        { suf: "ustun2", glyph: l.n === 1 ? "اً" : `${l.iso}ًا`, read: `${l.cons}${v.a}n` },
        { suf: "esre2", glyph: `${l.iso}ٍ`, read: `${l.cons}${v.i}n` },
        { suf: "otre2", glyph: `${l.iso}ٌ`, read: `${l.cons}${v.u}n` },
      ];
      return defs.map((d) => ({
        id: `l8-${pad2(l.n)}-${d.suf}`,
        label: d.read,
        speech: d.read,
        lang: "tr" as const,
        emoji: d.glyph,
        translit: d.read,
        section: bolum(l.n),
      }));
    }),
    ...TENVIN_EKSTRA.map(([ar, sp], i) => ({
      id: `l8x-${pad2(i + 1)}`,
      label: sp,
      speech: sp,
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      section: "Ekstralar",
    })),
  ],
};

// 9. KONU — ZAMİR & LAFZATULLAH (video + örnekler, alıştırma yok)
const t9_zamir: ContentTopic = {
  id: "zamir-lafzatullah",
  parent: P,
  title: "9. Zamir ve Lafzatullah",
  description: "Allah lafzının okunuşu",
  emoji: "ﷲ",
  practiceMode: "visual",
  gridCols: 2,
  noPractice: true,
  video: "https://www.youtube.com/watch?v=btL_AHHnbaE",
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

// 10. KONU — ELİF-LÂM TAKISI ve RÂ (video + örnekler, alıştırma yok)
const t10_elif_lam: ContentTopic = {
  id: "elif-lam-ra",
  parent: P,
  title: "10. Elif-Lâm Takısı ve Râ",
  description: "ال takısı ve râ harfinin okunuşu",
  emoji: "ﺍﻟ",
  practiceMode: "visual",
  gridCols: 2,
  noPractice: true,
  video: "https://www.youtube.com/watch?v=kZ4R2CrWc3A",
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
