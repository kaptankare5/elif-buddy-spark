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
  { n: 21, name: "Kaf",  iso: "ق", init: "ﻗ",  med: "ﻘ",  fin: "ﻖ",  speech: "kaf",  cons: "g", thick: "kalin" },
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

// YALNIZ 2. KONU (başta/ortada/sonda) İÇİN AYRI BÖLÜMLEME.
// O konunun bütün derdi harfleri BİRBİRİNDEN AYIRT ETMEK: çocuk ب ile ن'yi,
// ج ile ح'yi karıştırır. Ayrım öğrenmenin tek yolu benzerleri YAN YANA
// görmektir (Kornell & Bjork 2008). 4'erli kesim ise benzerleri bölüyordu
// (Dal/Zel 2 ile 3'e, Sin/Şin 3 ile 4'e düşüyordu; Elif 1., Lem 6. bölümdeydi).
// Bu yüzden BU KONUDA bölümler, karışabilen harfleri bir arada tutacak şekilde
// kesilir. Diğer konular geleneksel elifbâ sırasını ve 4'erli bölümlemeyi
// aynen korur — değişen tek şey bu konunun bölüm sınırlarıdır.
// BÖLÜM BOYUTU: burada bir harf = ÜÇ yeni öğe (başta/ortada/sonda). 4 harflik
// bir bölüm 12 yeni şekil demek — çocuk temel hâlini biliyor olsa da diğer
// hâllerini bilmiyor, yük katlanıyor. Bu yüzden bölümler 2-3 harfte tutulur
// (6-9 öğe). Karışan harfler yine aynı bölümde; yalnız kalabalık aileler
// (ب ت ث ن ي gibi) ikiye bölünür — ilk yarı zaten açık kaldığı için ikinci
// yarı geldiğinde karşıtlık kurulmaya devam eder.
const YAZILIS_SECTIONS: number[][] = [
  [1, 22, 23],    // ا ك ل — dikey çizgililer
  [2, 3, 4],      // ب ت ث — diş + nokta
  [5, 6, 7],      // ج ح خ — çanaklılar
  [8, 9],         // د ذ
  [10, 11],       // ر ز
  [12, 13],       // س ش
  [14, 15],       // ص ض
  [16, 17],       // ط ظ
  [18, 19],       // ع غ
  [20, 21],       // ف ق
  [24, 27],       // م ه — ilmekliler
  [25, 28],       // ن ي — diş ailesinin devamı
  [26],           // و
];

const YAZILIS_SECTION_OF = new Map<number, string>();
YAZILIS_SECTIONS.forEach((letters, i) => {
  for (const n of letters) YAZILIS_SECTION_OF.set(n, `${i + 1}. Bölüm`);
});

const bolumYazilis = (n: number) => YAZILIS_SECTION_OF.get(n) ?? "Ekstralar";

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
  // YENİ MÜFREDAT (kullanıcı kararı): bu konu ALIŞTIRMASIZ — çocuk videoyu
  // izler ya da harfleri birkaç dakika dinler ve geçer. Başta/ortada/sonda
  // hâlleri tek başına ezberletilmez; sıradaki konuda HAREKEYLE BİRLİKTE
  // alıştırması yapılır (şe → şın ortada + fetha). Tek başına 84 şekil
  // ezberletmek hem sıkıcı hem de okumaya doğrudan katkısı yok.
  noPractice: true,
  items: LETTERS.flatMap((l) => [
    {
      id: `l2-${pad2(l.n)}-init`,
      label: `${l.name} • başta`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.init,
      translit: `${l.name} (başta)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
      section: bolumYazilis(l.n),
    },
    {
      id: `l2-${pad2(l.n)}-med`,
      label: `${l.name} • ortada`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.med,
      translit: `${l.name} (ortada)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
      section: bolumYazilis(l.n),
    },
    {
      id: `l2-${pad2(l.n)}-fin`,
      label: `${l.name} • sonda`,
      speech: l.speech,
      lang: "tr" as const,
      emoji: l.fin,
      translit: `${l.name} (sonda)`,
      audio: audioPath(`basic-${pad2(l.n)}.mp3`),
      section: bolumYazilis(l.n),
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
        section: bolum(l.n),
        // ÖLÇÜLEN: harekeyi bildiği varsayılır, hata harfin ŞEKLİNE
        // yazılır. 2. konuda (Yazılışlar) alıştırmasız geçilen
        // başta/ortada/sonda hâlleri asıl burada ölçülür.
        skill: `l2-${pad2(l.n)}-${pos}`,
        // Şıklar AYNI HAREKELİ olmalı: ölçülen harfin şekli,
        // harekeler karışsaydı çocuk sesteki ünlüden eler, şekle bakmazdı.
        distractorKey: `hv-${hv}`,
      });
    }
  }
  return out;
}

const t3_harekeler: ContentTopic = {
  id: "harekeler",
  parent: P,
  title: "3. Harekeler",
  // Şıklar aynı harfin üç harekesi (بَ بِ بُ) — dördüncü şık başka harf
  // olurdu ve çocuk harekeye bakmadan elerdi.
  optionCount: 3,
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
          // ÖLÇÜLEN: harf değil HAREKE. 84 hece sorulur ama yeni bilgi 3
          // tanedir (28 harf 1. konuda öğrenildi). Çocuk üstün/esre/ötreyi
          // ayırt edebiliyorsa konu biter — bkz. src/lib/skills.ts.
          skill: `hrk-${h.suf}`,
          // Şıklar AYNI HARF olmalı (بَ بِ بُ): ölçülen hareke,
          // farklı harf koyulsaydı çocuk harften tanır, harekeye bakmazdı.
          distractorKey: `harf-${pad2(l.n)}`,
        };
      }),
    ),
  ],
};

// 4. KONU — HARF + HAREKE ALIŞTIRMASI (yeni müfredat).
//
// 2. konu (Yazılışlar) alıştırmasız geçiliyor: çocuk başta/ortada/sonda
// hâllerini görüyor ama tek başına 84 şekil ezberlemiyor. Asıl alıştırma
// BURADA, harekeyle birlikte: "şe" diye sorulur, doğru cevap şın'ın
// ORTADAKİ hâli + fetha, şıklar fethalı başka harflerdir.
//
// ⚠️ Ölçülen HAREKE DEĞİL, harfin ŞEKLİ (skill: l2-NN-pos). Bu ancak
// hareke gerçekten biliniyorsa doğru bir çıkarımdır — o yüzden bu konu
// 3. konu bitmeden açılmaz ve hareke becerileri arada yoklanmaya devam
// eder (questionSource bakım kanalı).
const t4_harf_hareke: ContentTopic = {
  id: "harf-hareke",
  parent: P,
  title: "4. Harf + Hareke Alıştırması",
  description: "Harflerin başta/ortada/sonda hâlleri, harekeyle",
  emoji: "ﺷَ",
  practiceMode: "visual",
  gridCols: 3,
  items: buildHarekeExtras(),
};

// 5. KONU — CEZM: her harf (Elif hariç, Kef için ses yok)
const CEZM_MISSING = new Set([22]); // 22=Kef ses yok

// Kur'an sıklığına göre seçilmiş cezm heceleri (tam Kur'an taraması,
// engine5 sayımı — Hafs/Âsım, Türk mushafı kuralı: idgamlı işaretsiz
// ünsüzler cezimli sayılır). Seçim kuralları:
// - aynı hareke+koda sonundan yalnız EN SIK örnek ("hüm" varken "küm" yok)
// - hamza başlangıçlılar hariç (çekirdek eb/ib/üb serisi zaten öğretiyor)
// - az geçenler elendi. 3. alan = SRS bilet ağırlığı (3 çok sık / 2 sık).
const CEZM_EKSTRA: Array<[string, string, number]> = [
  ["هُمْ", "hüm", 3],  // 2.577
  ["مِنْ", "min", 3],  // 2.281
  ["لَيْ", "ley", 3],  // 1.224
  ["هِمْ", "him", 3],  //   919
  ["مَنْ", "men", 3],  //   837
  ["بِلْ", "bil", 3],  //   585 — harf-i tarif okuyuşu (bi + el → bil)
  ["قَوْ", "kav", 3],  //   509
  ["يَعْ", "ye'", 3],  //   403
  ["قَدْ", "kad", 2],  //   398
  ["لَمْ", "lem", 2],  //   385
  ["قُلْ", "kul", 2],  //   350
  ["كُنْ", "kün", 2],  //   329
  ["قَبْ", "kab", 2],  //   248
  ["يَسْ", "yes", 2],  //   237
];

const t4_cezm: ContentTopic = {
  id: "cezm",
  parent: P,
  title: "5. Cezm",
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
        // ⚠️ TÜRK ELİFBÂSI: DÜZ ELİF, hemze DEĞİL. Diyanet Elifbâ kitabı
        // harekeyi düz elifle öğretir (اَ اِ اُ). Arapça imlâda kelime başı
        // elif teknik olarak hemzedir (أَ إِ أُ) ama çocuğa iki farklı şekil
        // göstermek karışıklık yaratır — üstelik burada fetha düz elifle,
        // esre/ötre hemzeyle yazılıyordu, yani kendi içinde de tutarsızdı.
        const elifPre = idx === 0 ? "اَ" : idx === 1 ? "اِ" : "اُ";
        return {
          id: `l4-${pad2(l.n)}-${h.v}`,
          label: `${h.sp}`,
          speech: h.sp,
          lang: "tr" as const,
          // Örn: اَبْ / اِبْ / اُبْ
          emoji: `${elifPre}${l.iso}ْ`,
          translit: h.sp,
          audio: hasAudio ? audioPath(h.audio) : undefined,
          section: bolum(l.n),
        };
      });
    }),
    ...CEZM_EKSTRA.map(([ar, sp, w], i) => ({
      id: `l4e-${pad2(i + 1)}`,
      label: sp,
      speech: sp.replace(/'/g, ""),
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      section: "Ekstralar",
      weight: w,
    })),
  ],
};

// 5. KONU — ŞEDDE: her harf (Elif hariç) × 3 hareke

// Kur'an sıklığına göre seçilmiş şedde heceleri (engine5 sayımı). Aynı
// hareke + şeddeli harf + son hareke kombinasyonundan yalnız EN SIK örnek
// alınır; az geçenler elendi. 3. alan = SRS bilet ağırlığı (3/2/1).
const SEDDE_EKSTRA: Array<[string, string, number]> = [
  ["اِنَّ", "inne", 3],   // 1.513 — Kur'an'ın en sık şeddeli hecesi
  ["اِلَّ", "ille", 3],   //   665
  ["رَبِّ", "rabbi", 3],  //   609
  ["اَنَّ", "enne", 3],   //   408
  ["ثُمَّ", "sümme", 2],  //   338
  ["رَبَّ", "rabbe", 2],  //   210
  ["كُلِّ", "külli", 2],  //   192
  ["اَيُّ", "eyyü", 2],   //   172
  ["رَبُّ", "rabbü", 2],  //   171
  ["لَمَّ", "lemme", 2],  //   165
  ["مِمَّ", "mimme", 2],  //   159
  ["عَلَّ", "alle", 2],   //   153
  ["اِنِّ", "inni", 2],   //   151
  ["حَتَّ", "hatte", 1],  //   142
];

// Şeddeli hecenin önüne konan harekeli elif (cezm konusundakiyle aynı kural).
// TÜRK ELİFBÂSI: hepsi DÜZ ELİF — hemze (أ إ) kullanılmaz.
const SEDDE_ELIF_PRE: Record<"fetha" | "esre" | "otre", string> = {
  fetha: "اَ",
  esre: "اِ",
  otre: "اُ",
};

const t5_sedde: ContentTopic = {
  id: "sedde",
  parent: P,
  title: "6. Şedde",
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
          // Şeddeli hece TEK BAŞINA okunamaz: "بَّ" yazıp "ebbe" demek
          // olmuyor, şeddenin ikizlediği ilk sessizin bir önceki heceye
          // yaslanması gerekiyor. Cezm konusunda olduğu gibi harekeli elif
          // ön eki konur → اَبَّ / اِبِّ / اُبُّ (ebbe / ibbi / übbü).
          // Ekstra kartlar (اِنَّ, رَبِّ…) da zaten bu biçimde.
          emoji: `${SEDDE_ELIF_PRE[h.suf]}${l.iso}ّ${h.mark}`,
          translit: sesMap[h.vowel],
          audio: audioPath(`sedde-${pad2(idx)}-${h.suf}.mp3`),
          section: bolum(l.n),
        };
      });
    }),
    ...SEDDE_EKSTRA.map(([ar, sp, w], i) => ({
      id: `l5e-${pad2(i + 1)}`,
      label: sp,
      speech: sp,
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      section: "Ekstralar",
      weight: w,
    })),
  ],
};

// 6. KONU — MED HARFLERİ (uzatma). PDF sayfa 16-17 örneklerinden.

// Kur'an sıklığına göre seçilmiş med heceleri (engine5 sayımı; çekirdek
// kartlarda olmayanlardan en sık geçenler — hepsi 1.000+ kez). 3. alan =
// SRS bilet ağırlığı (tümü çok sık: 3).
const MED_EKSTRA: Array<[string, string, number]> = [
  ["لَا", "lâ", 3],   // 4.019
  ["مَا", "mâ", 3],   // 3.890
  ["نَا", "nâ", 3],   // 3.351
  ["وَا", "vâ", 3],   // 2.641
  ["آ", "â", 3],      // 2.244 — medli elif (uzatmalı hemze)
  ["هَا", "hâ", 3],   // 1.956
  ["فِي", "fî", 3],   // 1.794
  ["لُو", "lû", 3],   // 1.563
  ["ذِي", "zî", 3],   // 1.470
  ["هُو", "hû", 3],   // 1.338
  ["يَا", "yâ", 3],   // 1.185
  ["رُو", "rû", 3],   // 1.184
  ["نُو", "nû", 3],   // 1.097
  ["هِي", "hî", 3],   // 1.091
];

// Med hecesinin gerçek hoca kaydını bul: med-{harfNo}-{hareke}.mp3.
// YALNIZ "harf + hareke + uzatma harfi" biçimindeki 3 kod noktalı heceler
// eşleşir; قَالَ/كَانَ gibi kelimelerin kaydı yok ve ilk hecesinin sesini
// (kâ) kelimeye iliştirmek çocuğa yanlış öğretir — onlar sessiz kalır.
const HARAKA_SUF: Record<string, "fetha" | "esre" | "otre"> = {
  "َ": "fetha", "ِ": "esre", "ُ": "otre",
};
const MADD_HARFI = new Set(["ا", "ى", "ي", "و"]); // ا ى ي و
const byIso = new Map(LETTERS.map((l) => [l.iso, l]));
function medAudio(ar: string): string | undefined {
  const cp = [...ar];
  if (cp.length !== 3) return undefined;
  const l = byIso.get(cp[0]);
  const suf = HARAKA_SUF[cp[1]];
  if (!l || !suf || !MADD_HARFI.has(cp[2])) return undefined;
  return audioPath(`med-${pad2(l.n)}-${suf}.mp3`);
}

// Med heceleri artık ELİF → BE → TE → SE … müfredat sırasında üretilir
// (eskiden elle yazılmış karışık bir listeydi ve Elif ile bazı harfler hiç
// yoktu). Her harf için üç uzatma: fetha+elif (â), esre+ye (î), ötre+vav (û).
// Ses: med-NN-{fetha|esre|otre}.mp3 — 28 × 3 = 84 kayıt diskte tam.
const MED_FORMS: Array<{ suf: "fetha" | "esre" | "otre"; mark: string; harf: string }> = [
  { suf: "fetha", mark: "َ", harf: "ا" },
  { suf: "esre", mark: "ِ", harf: "ى" },
  { suf: "otre", mark: "ُ", harf: "و" },
];

// Uzatmalı okunuş da ince/kalın kuralına uyar: kalın harfler "â" (bâ değil
// sâ, tâ…), ince harfler "ê" (bê, tê, sê…), Râ istisnadır (râ, rî, rû).
function medVowel(thick: Thickness, suf: "fetha" | "esre" | "otre"): string {
  if (suf === "esre") return "î";
  if (suf === "otre") return "û";
  return thick === "ince" ? "ê" : "â";
}


const t6_med: ContentTopic = {
  id: "med",
  parent: P,
  title: "7. Med Harfleri",
  description: "Elif, vav ve ye ile uzatma",
  emoji: "ﺁ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...LETTERS.flatMap((l) =>
      MED_FORMS.map((m) => {
        const sp = `${l.cons}${medVowel(l.thick, m.suf)}`;
        // Elif + fetha + elif yazılmaz; medli elif "آ" ile gösterilir.
        const ar = l.n === 1 && m.suf === "fetha" ? "آ" : l.iso + m.mark + m.harf;
        return {
          id: `l6-${pad2(l.n)}-${m.suf}`,
          label: sp,
          speech: sp,
          lang: "tr" as const,
          emoji: ar,
          translit: sp,
          audio: audioPath(`med-${pad2(l.n)}-${m.suf}.mp3`),
          section: bolum(l.n),
        };
      }),
    ),
    ...MED_EKSTRA.map(([ar, sp, w], i) => ({
      id: `l6e-${pad2(i + 1)}`,
      label: sp,
      speech: sp,
      lang: "tr" as const,
      emoji: ar,
      translit: sp,
      audio: medAudio(ar),
      section: "Ekstralar",
      weight: w,
    })),
  ],
};

// 7. KONU — ÂSAR / MED / KASR: Diyanet'in konu videosu (kitaptaki karekod)
const t7_asar: ContentTopic = {
  id: "asar-med-kasr",
  parent: P,
  title: "8. Âsar, Med ve Kasr",
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
  title: "9. Tenvin",
  description: "İki üstün, iki esre, iki ötre",
  emoji: "ࣰ",
  practiceMode: "visual",
  gridCols: 3,
  items: [
    ...LETTERS.flatMap((l) => {
      const v = harekeVowels(l.thick);
      // Tenvin mp3'leri var: tenvin-NN-{fetha|esre|otre}.mp3 (NN = harf no 1-28).
      const defs = [
        // iki üstün: harf + fethatan + elif (بًا) — elif kendisi yalnız "اً"
        { suf: "ustun2", file: "fetha", glyph: l.n === 1 ? "اً" : `${l.iso}ًا`, read: `${l.cons}${v.a}n` },
        { suf: "esre2", file: "esre", glyph: `${l.iso}ٍ`, read: `${l.cons}${v.i}n` },
        { suf: "otre2", file: "otre", glyph: `${l.iso}ٌ`, read: `${l.cons}${v.u}n` },
      ];
      return defs.map((d) => ({
        id: `l8-${pad2(l.n)}-${d.suf}`,
        label: d.read,
        speech: d.read,
        lang: "tr" as const,
        emoji: d.glyph,
        translit: d.read,
        audio: audioPath(`tenvin-${pad2(l.n)}-${d.file}.mp3`),
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
  title: "10. Zamir ve Lafzatullah",
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
  title: "11. Elif-Lâm Takısı ve Râ",
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
  t4_harf_hareke,
  t4_cezm,
  t5_sedde,
  t6_med,
  t7_asar,
  t8_tenvin,
  t9_zamir,
  t10_elif_lam,
];
