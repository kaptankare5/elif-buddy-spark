// YAZILIŞ HAFIZA YÖNTEMLERİ — "başta / ortada / sonda" konusunu ezber
// yükünden kurtaran YAPISAL kurallar.
//
// Çocuk 28 harf × 3 hâl = 84 şekli tek tek ezberlemeye çalışırsa boğulur
// (bilişsel yük). Oysa Arap yazısı KURALLI: birkaç kuralı öğrenen çocuk 84
// şeklin neredeyse tamamını türetir. Bu modül o kuralları veriler:
//
//  1) DEĞİŞMEYEN 6 HARF — ا د ذ ر ز و sola bağlanmaz → şekilleri hiç değişmez.
//     (28 harfin 6'sı zaten "bedava": çocuk 3 hâlini de bir kerede öğrenir.)
//  2) KUYRUK SİLME — bağlanan harfler başta/ortada KUYRUĞUNU (çanağını)
//     kaybeder, yalnız "başı" kalır. Yalın hâli bilen çocuk kuyruğu silerek
//     başta hâlini türetir.
//  3) NOKTA YÖNTEMİ — aynı iskeleti paylaşan harfler YALNIZ noktayla ayrılır.
//     Karışıklığın gerçek kaynağı budur (ب/ت/ث/ن/ي, ج/ح/خ, س/ش, ص/ض, ط/ظ,
//     ع/غ, ف/ق, د/ذ, ر/ز); çözüm de: noktanın SAYISI + YERİ (üstte/altta).
//
// Kaynak: Diyanet Elifbâ müfredatı + Arap yazısı rasm kuralları.
// Not: Glifler `elifba.ts`'teki LETTERS tablosuyla birebir aynı sunum
// biçimlerini kullanır (aynı hat, aynı görünüm).

export type DotWhere = "ust" | "alt" | "yok";

export interface MnemonicLetter {
  n: number;        // 1..28 — elifba.ts'teki harf numarası (item id'leriyle eşleşir)
  name: string;     // Türkçe adı
  iso: string;      // yalın (tek başına)
  init: string;     // başta
  med: string;      // ortada
  fin: string;      // sonda
  dots: number;     // 0-3
  where: DotWhere;
}

/** 1) Sola bağlanmayan 6 harf — şekilleri değişmez. */
export interface StableGroup {
  title: string;
  hint: string;
  letters: MnemonicLetter[];
}

/** 2) Kuyruk silme — yalın hâlden başta hâline geçiş. */
export interface TailRule {
  n: number;
  name: string;
  iso: string;
  init: string;
  /** Silinen parçanın çocuk diliyle adı: "çanak", "kuyruk"… */
  tailName: string;
  /** Kalan parçanın adı: "diş", "baş", "halka"… */
  keepName: string;
  /** Tek cümlelik hafıza cümlesi. */
  say: string;
}

/** 3) Nokta ile ayrılan gruplar. */
export interface DotGroup {
  id: string;
  title: string;
  /** Bu grubun ortak iskeletinin adı. */
  skeleton: string;
  hint: string;
  letters: MnemonicLetter[];
  /** Dürüstlük notu (varsa) — kuralın sınırı. */
  caveat?: string;
}

const L = (
  n: number, name: string, iso: string, init: string, med: string, fin: string,
  dots: number, where: DotWhere,
): MnemonicLetter => ({ n, name, iso, init, med, fin, dots, where });

// ---------------------------------------------------------------------------
// 1) DEĞİŞMEYEN 6 HARF (sola bağlanmaz)
// ---------------------------------------------------------------------------
export const STABLE_GROUP: StableGroup = {
  title: "Değişmeyen 6 Harf",
  hint: "Bu 6 harf kendinden SONRAKİ harfe bağlanmaz. Bu yüzden şekilleri hiç değişmez — başta da, ortada da, sonda da aynıdır. 28 harfin 6'sını bir kerede öğrenmiş oldun!",
  letters: [
    L(1, "Elif", "ا", "ا", "ـا", "ـا", 0, "yok"),
    L(8, "Dal", "د", "د", "ـد", "ـد", 0, "yok"),
    L(9, "Zel", "ذ", "ذ", "ـذ", "ـذ", 1, "ust"),
    L(10, "Ra", "ر", "ر", "ـر", "ـر", 0, "yok"),
    L(11, "Ze", "ز", "ز", "ـز", "ـز", 1, "ust"),
    L(26, "Vev", "و", "و", "ـو", "ـو", 0, "yok"),
  ],
};

// ---------------------------------------------------------------------------
// 2) KUYRUK SİLME — yalın hâlin kuyruğunu sil, başta hâli çıkar
// ---------------------------------------------------------------------------
export const TAIL_RULES: TailRule[] = [
  {
    n: 5, name: "Cim", iso: "ج", init: "ﺟ",
    tailName: "alt çanak", keepName: "baş",
    say: "Cim'in aşağı sarkan çanağını sil — geriye yalnız başı kalır.",
  },
  {
    n: 6, name: "Ha", iso: "ح", init: "ﺣ",
    tailName: "alt çanak", keepName: "baş",
    say: "Ha da aynı: çanağı silince başı kalır. (Cim ile tek farkı nokta!)",
  },
  {
    n: 7, name: "Hı", iso: "خ", init: "ﺧ",
    tailName: "alt çanak", keepName: "baş",
    say: "Hı da öyle — çanak gider, üstteki noktası kalır.",
  },
  {
    n: 12, name: "Sin", iso: "س", init: "ﺳ",
    tailName: "son çanak", keepName: "üç diş",
    say: "Sin'in sonundaki çanağı sil — üç dişi kalır.",
  },
  {
    n: 13, name: "Şin", iso: "ش", init: "ﺷ",
    tailName: "son çanak", keepName: "üç diş",
    say: "Şin de aynı; üstünde üç noktası vardır.",
  },
  {
    n: 14, name: "Sad", iso: "ص", init: "ﺻ",
    tailName: "kuyruk", keepName: "halka",
    say: "Sad'ın kuyruğunu sil — kocaman halkası kalır.",
  },
  {
    n: 15, name: "Dad", iso: "ض", init: "ﺿ",
    tailName: "kuyruk", keepName: "halka",
    say: "Dad da aynı; halkanın üstünde bir nokta var.",
  },
  {
    n: 18, name: "Ayn", iso: "ع", init: "ﻋ",
    tailName: "alt çanak", keepName: "baş",
    say: "Ayn'ın aşağıdaki çanağını sil — yalnız başı kalır.",
  },
  {
    n: 19, name: "Gayn", iso: "غ", init: "ﻏ",
    tailName: "alt çanak", keepName: "baş",
    say: "Gayn da aynı; üstünde noktası vardır.",
  },
  {
    n: 20, name: "Fe", iso: "ف", init: "ﻓ",
    tailName: "kuyruk", keepName: "halka",
    say: "Fe'nin kuyruğunu sil — halkası kalır.",
  },
  {
    n: 21, name: "Kaf", iso: "ق", init: "ﻗ",
    tailName: "derin çanak", keepName: "halka",
    say: "Kaf'ın derin çanağını sil — halkası kalır. (Fe'den farkı: 2 nokta!)",
  },
  {
    n: 2, name: "Be", iso: "ب", init: "ﺑ",
    tailName: "çanak", keepName: "diş",
    say: "Be'nin çanağını sil — küçük bir diş kalır.",
  },
  {
    n: 25, name: "Nun", iso: "ن", init: "ﻧ",
    tailName: "derin çanak", keepName: "diş",
    say: "Nun'un derin çanağını sil — diş kalır. (Başta Be'ye benzer, noktası üstte!)",
  },
  {
    n: 23, name: "Lem", iso: "ل", init: "ﻟ",
    tailName: "çanak", keepName: "uzun boy",
    say: "Lem'in çanağını sil — uzun boyu kalır.",
  },
  {
    n: 24, name: "Mim", iso: "م", init: "ﻣ",
    tailName: "sarkan kuyruk", keepName: "halka",
    say: "Mim'in aşağı sarkan kuyruğunu sil — yuvarlak başı kalır.",
  },
];

// ---------------------------------------------------------------------------
// 3) NOKTA YÖNTEMİ — aynı iskelet, farklı nokta
// ---------------------------------------------------------------------------
export const DOT_GROUPS: DotGroup[] = [
  {
    id: "dis",
    title: "Diş Kardeşler",
    skeleton: "diş",
    hint: "Başta ve ortada BEŞİ DE tıpatıp aynı! Onları ayıran tek şey: noktanın SAYISI ve YERİ (üstte mi, altta mı).",
    letters: [
      L(2, "Be", "ب", "ﺑ", "ﺒ", "ﺐ", 1, "alt"),
      L(3, "Te", "ت", "ﺗ", "ﺘ", "ﺖ", 2, "ust"),
      L(4, "Se", "ث", "ﺛ", "ﺜ", "ﺚ", 3, "ust"),
      L(25, "Nun", "ن", "ﻧ", "ﻨ", "ﻦ", 1, "ust"),
      L(28, "Ye", "ي", "ﻳ", "ﻴ", "ﻲ", 2, "alt"),
    ],
    caveat: "Yalın ve sonda hâllerinde Nun'un çanağı daha derin, Ye'nin kuyruğu farklıdır. Tıpatıp aynı olan BAŞTA ve ORTADA hâlleridir — karışıklık da zaten orada olur.",
  },
  {
    id: "cim",
    title: "Cim · Ha · Hı",
    skeleton: "baş + çanak",
    hint: "Üçü de aynı şekil! Nokta yoksa Ha, nokta içerideyse Cim, üstteyse Hı.",
    letters: [
      L(5, "Cim", "ج", "ﺟ", "ﺠ", "ﺞ", 1, "alt"),
      L(6, "Ha", "ح", "ﺣ", "ﺤ", "ﺢ", 0, "yok"),
      L(7, "Hı", "خ", "ﺧ", "ﺨ", "ﺦ", 1, "ust"),
    ],
  },
  {
    id: "sin",
    title: "Sin · Şin",
    skeleton: "üç diş",
    hint: "İkisi de üç dişli. Üstünde üç nokta varsa Şin, yoksa Sin.",
    letters: [
      L(12, "Sin", "س", "ﺳ", "ﺴ", "ﺲ", 0, "yok"),
      L(13, "Şin", "ش", "ﺷ", "ﺸ", "ﺶ", 3, "ust"),
    ],
  },
  {
    id: "sad",
    title: "Sad · Dad",
    skeleton: "halka + kuyruk",
    hint: "İkisi de aynı halka. Üstünde bir nokta varsa Dad, yoksa Sad.",
    letters: [
      L(14, "Sad", "ص", "ﺻ", "ﺼ", "ﺺ", 0, "yok"),
      L(15, "Dad", "ض", "ﺿ", "ﻀ", "ﺾ", 1, "ust"),
    ],
  },
  {
    id: "ti",
    title: "Tı · Zı",
    skeleton: "halka + dik çizgi",
    hint: "İkisi de aynı. Üstünde bir nokta varsa Zı, yoksa Tı.",
    letters: [
      L(16, "Tı", "ط", "ﻃ", "ﻄ", "ﻂ", 0, "yok"),
      L(17, "Zı", "ظ", "ﻇ", "ﻈ", "ﻆ", 1, "ust"),
    ],
  },
  {
    id: "ayn",
    title: "Ayn · Gayn",
    skeleton: "baş + çanak",
    hint: "İkisi de aynı şekil. Üstünde bir nokta varsa Gayn, yoksa Ayn.",
    letters: [
      L(18, "Ayn", "ع", "ﻋ", "ﻌ", "ﻊ", 0, "yok"),
      L(19, "Gayn", "غ", "ﻏ", "ﻐ", "ﻎ", 1, "ust"),
    ],
  },
  {
    id: "fe",
    title: "Fe · Kaf",
    skeleton: "halka",
    hint: "Başta ikisi de aynı halka. Bir nokta varsa Fe, iki nokta varsa Kaf.",
    letters: [
      L(20, "Fe", "ف", "ﻓ", "ﻔ", "ﻒ", 1, "ust"),
      L(21, "Kaf", "ق", "ﻗ", "ﻘ", "ﻖ", 2, "ust"),
    ],
    caveat: "Yalın ve sonda hâllerinde Kaf'ın çanağı Fe'ninkinden daha derindir. Başta ve ortada ise yalnız nokta sayısı ayırır.",
  },
  {
    id: "dal",
    title: "Dal · Zel",
    skeleton: "dal",
    hint: "İkisi de aynı. Üstünde nokta varsa Zel, yoksa Dal. (İkisi de bağlanmaz!)",
    letters: [
      L(8, "Dal", "د", "د", "ـد", "ـد", 0, "yok"),
      L(9, "Zel", "ذ", "ذ", "ـذ", "ـذ", 1, "ust"),
    ],
  },
  {
    id: "ra",
    title: "Ra · Ze",
    skeleton: "kanca",
    hint: "İkisi de aynı. Üstünde nokta varsa Ze, yoksa Ra. (İkisi de bağlanmaz!)",
    letters: [
      L(10, "Ra", "ر", "ر", "ـر", "ـر", 0, "yok"),
      L(11, "Ze", "ز", "ز", "ـز", "ـز", 1, "ust"),
    ],
  },
];

/** Nokta rozeti metni: "1 nokta üstte" gibi. */
export function dotLabel(dots: number, where: DotWhere): string {
  if (dots === 0 || where === "yok") return "nokta yok";
  return `${dots} nokta ${where === "ust" ? "üstte" : "altta"}`;
}

/** Bir harfin (numarasına göre) yazılış konusundaki item id'leri. */
export function writingItemIds(n: number): { init: string; med: string; fin: string } {
  const p = n < 10 ? `0${n}` : String(n);
  return { init: `l2-${p}-init`, med: `l2-${p}-med`, fin: `l2-${p}-fin` };
}
