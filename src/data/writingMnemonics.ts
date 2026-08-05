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
  /** Kuyruğun harfin neresinde olduğu (sil-oyunu maskesi bunu kullanır).
   *  dir="alt"  → mürekkebin alt (1-at) kadarı kuyruktur (aşağı sarkanlar).
   *  dir="sol"  → mürekkebin sol (at) kadarı kuyruktur (sola uzayanlar).
   *  `at`, harfin MÜREKKEP kutusuna göre orandır (0..1) — font boyutundan
   *  bağımsız çalışır. Değerler ekran görüntüsüyle tek tek doğrulanmıştır.
   *  NOT: Önce "yalın hâl eksi başta hâli" ile otomatik türetilmişti; ancak bu
   *  fontlarda iki form farklı çizildiği için üst üste oturmuyor (ölçüldü:
   *  örtüşme %21-56) ve baş da kuyruk sanılıyordu. Elle tanımlama güvenilir. */
  zone: { dir: "alt" | "sol"; at: number };
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
  /**
   * Alt şeritteki "hepsinin iskeleti aynı: …" cümlesinin yerine geçer.
   * Ortak olan şey İSKELET değilse gerekir: Şın ile Peltek Se'yi birleştiren
   * şey nokta SAYISI (üç), iskeletleri farklı (bir diş / üç diş).
   */
  sharedNote?: string;
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
    zone: { dir: "alt", at: 0.45 },
  },
  {
    n: 6, name: "Ha", iso: "ح", init: "ﺣ",
    tailName: "alt çanak", keepName: "baş",
    say: "Ha da aynı: çanağı silince başı kalır. (Cim ile tek farkı nokta!)",
    zone: { dir: "alt", at: 0.42 },
  },
  {
    n: 7, name: "Hı", iso: "خ", init: "ﺧ",
    tailName: "alt çanak", keepName: "baş",
    say: "Hı da öyle — çanak gider, üstteki noktası kalır.",
    zone: { dir: "alt", at: 0.52 },
  },
  {
    n: 12, name: "Sin", iso: "س", init: "ﺳ",
    tailName: "son çanak", keepName: "üç diş",
    say: "Sin'in sonundaki çanağı sil — üç dişi kalır.",
    zone: { dir: "alt", at: 0.55 },
  },
  {
    n: 13, name: "Şin", iso: "ش", init: "ﺷ",
    tailName: "son çanak", keepName: "üç diş",
    say: "Şin de aynı; üstünde üç noktası vardır.",
    zone: { dir: "alt", at: 0.7 },
  },
  {
    n: 14, name: "Sad", iso: "ص", init: "ﺻ",
    tailName: "kuyruk", keepName: "halka",
    say: "Sad'ın kuyruğunu sil — kocaman halkası kalır.",
    zone: { dir: "sol", at: 0.44 },
  },
  {
    n: 15, name: "Dad", iso: "ض", init: "ﺿ",
    tailName: "kuyruk", keepName: "halka",
    say: "Dad da aynı; halkanın üstünde bir nokta var.",
    zone: { dir: "sol", at: 0.44 },
  },
  {
    n: 18, name: "Ayn", iso: "ع", init: "ﻋ",
    tailName: "alt çanak", keepName: "baş",
    say: "Ayn'ın aşağıdaki çanağını sil — yalnız başı kalır.",
    zone: { dir: "alt", at: 0.45 },
  },
  {
    n: 19, name: "Gayn", iso: "غ", init: "ﻏ",
    tailName: "alt çanak", keepName: "baş",
    say: "Gayn da aynı; üstünde noktası vardır.",
    zone: { dir: "alt", at: 0.62 },
  },
  {
    n: 20, name: "Fe", iso: "ف", init: "ﻓ",
    tailName: "kuyruk", keepName: "halka",
    say: "Fe'nin kuyruğunu sil — halkası kalır.",
    zone: { dir: "sol", at: 0.6 },
  },
  {
    n: 21, name: "Kaf", iso: "ق", init: "ﻗ",
    tailName: "derin çanak", keepName: "halka",
    say: "Kaf'ın derin çanağını sil — halkası kalır. (Fe'den farkı: 2 nokta!)",
    zone: { dir: "alt", at: 0.66 },
  },
  {
    n: 2, name: "Be", iso: "ب", init: "ﺑ",
    tailName: "çanak", keepName: "diş",
    say: "Be'nin çanağını sil — küçük bir diş kalır.",
    zone: { dir: "sol", at: 0.62 },
  },
  {
    n: 25, name: "Nun", iso: "ن", init: "ﻧ",
    tailName: "derin çanak", keepName: "diş",
    say: "Nun'un derin çanağını sil — diş kalır. (Başta Be'ye benzer, noktası üstte!)",
    zone: { dir: "alt", at: 0.6 },
  },
  {
    n: 23, name: "Lem", iso: "ل", init: "ﻟ",
    tailName: "çanak", keepName: "uzun boy",
    say: "Lem'in çanağını sil — uzun boyu kalır.",
    zone: { dir: "alt", at: 0.72 },
  },
  {
    n: 24, name: "Mim", iso: "م", init: "ﻣ",
    tailName: "sarkan kuyruk", keepName: "halka",
    say: "Mim'in aşağı sarkan kuyruğunu sil — yuvarlak başı kalır.",
    zone: { dir: "alt", at: 0.45 },
  },
];

// ---------------------------------------------------------------------------
// 3) NOKTA YÖNTEMİ — aynı iskelet, farklı nokta
// ---------------------------------------------------------------------------
export const DOT_GROUPS: DotGroup[] = [
  // NOKTA SAYISINA GÖRE İKİŞERLİ — tek bir "Diş Kardeşler" grubu değil.
  // Beş harfi tek listede göstermek "hepsi aynı, noktaya bak" diyordu ama
  // çocuğa SOMUT bir ayrım vermiyordu (kullanıcı: "diş kardeşler diyorsun
  // da yeterince açıklayıcı değil"). Aynı NOKTA SAYISINA sahip iki harfi
  // karşı karşıya koyunca geriye tek bir soru kalıyor: nokta üstte mi altta mı?
  // Üçüncü ikili (üç nokta) iskeletle değil, nokta sayısıyla eşleşir.
  {
    id: "nokta-1",
    title: "Nun ile Be — 1 nokta",
    skeleton: "diş",
    hint: "İkisinin de TEK noktası var. Nokta ÜSTTEyse Nun, ALTTAysa Be.",
    letters: [
      L(25, "Nun", "ن", "ﻧ", "ﻨ", "ﻦ", 1, "ust"),
      L(2, "Be", "ب", "ﺑ", "ﺒ", "ﺐ", 1, "alt"),
    ],
    caveat: "Başta ve ortada tıpatıp aynılar — karışıklık zaten orada olur. Yalın ve sonda hâlinde Nun'un çanağı daha derindir.",
  },
  {
    id: "nokta-2",
    title: "Ye ile Te — 2 nokta",
    skeleton: "diş",
    hint: "İkisinin de İKİ noktası var. Noktalar ALTTAysa Ye, ÜSTTEyse Te.",
    letters: [
      L(28, "Ye", "ي", "ﻳ", "ﻴ", "ﻲ", 2, "alt"),
      L(3, "Te", "ت", "ﺗ", "ﺘ", "ﺖ", 2, "ust"),
    ],
    caveat: "Başta ve ortada tıpatıp aynılar. Yalın ve sonda hâlinde Ye'nin kuyruğu aşağı doğru uzanır.",
  },
  {
    id: "nokta-3",
    title: "Şın ile Peltek Se — 3 nokta",
    skeleton: "üç nokta",
    hint: "İkisinin de ÜÇ noktası var ve ikisi de ÜSTTE. Bu sefer noktaya değil DİŞE bak: Peltek Se'nin TEK dişi, Şın'ın ÜÇ dişi var.",
    letters: [
      L(13, "Şın", "ش", "ﺷ", "ﺸ", "ﺶ", 3, "ust"),
      L(4, "Peltek Se", "ث", "ﺛ", "ﺜ", "ﺚ", 3, "ust"),
    ],
    sharedNote: "ikisinde de üç nokta var — ayıran şey diş sayısı",
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

// ---------------------------------------------------------------------------
// 3b) ÇİZGİ YÖNTEMİ — aynı dikey çizgi, fark BAĞLANMA
// ---------------------------------------------------------------------------
// Nokta yöntemi noktası olan harflere çalışır. Elif ile Lem'in ise NOKTASI
// YOK — ikisi de düpedüz bir dikey çizgi. Onları ayıran şey şekil değil,
// ÇİZGİNİN DEVAM EDİP ETMEMESİ:
//   Elif sola bağlanmaz → çizgi orada BİTER (ا / ـا)
//   Lem sola bağlanır   → çizgi DEVAM EDER (لـ / ـلـ)
// Lem'in SONDA (ـل) ve YALIN (ل) hâlinde derin çanak olduğu için orada
// karışma yok — bu yüzden kart yalnız BAŞTA ve ORTADA hâllerini karşılaştırır
// (kullanıcı kararı; confusables.ts'teki form kısıtıyla aynı kural).

export interface StrokePair {
  id: string;
  title: string;
  /** Tek cümlelik ayırt edici kural — çocuğun aklında kalacak cümle. */
  rule: string;
  hint: string;
  /** Yalnız bu hâller karşılaştırılır (Lem'in çanaklı hâlleri karışmıyor). */
  forms: Array<"init" | "med">;
  letters: MnemonicLetter[];
  /** Kur'an'dan örnek (seçilince doldurulur). */
  quran?: { ar: string; okunus: string; kaynak: string; not: string };
}

export const STROKE_PAIRS: StrokePair[] = [
  {
    id: "elif-lem",
    title: "Elif ile Lem",
    rule: "Elif'ten sonra çizgi BİTER. Lem'den sonra çizgi DEVAM EDER.",
    hint: "İkisinin de noktası yok, ikisi de düz bir dikey çizgi. Bu yüzden noktaya bakmak işe yaramaz — ÇİZGİNİN SOLUNA bak: devam ediyorsa Lem, bitiyorsa Elif.",
    forms: ["init", "med"],
    letters: [
      L(1, "Elif", "ا", "ا", "ـا", "ـا", 0, "yok"),
      L(23, "Lem", "ل", "ﻟ", "ﻠ", "ﻞ", 0, "yok"),
    ],
  },
];

// ---------------------------------------------------------------------------
// 4) HAREKE HAFIZA YÖNTEMİ — TÜRKÇE ÖNCELİKLİ
// ---------------------------------------------------------------------------
// Bu uygulama TÜRK çocukları için. O yüzden birinci kanca, çocuğun ZATEN
// bildiği Türkçe: harekelerin TÜRKÇE ADLARI bize bedava ipucu veriyor.
//   • ÜSTÜN → adında "ÜST" var → ÜSTte durur.   (isim = YER)
//   • ÖTRE  → adında "Ö" var, yuvarlak ağız → "Ü" okunur.  (isim = SES)
//   • ESRE  → üstünün tam tersi → ALTta durur.  (zıtlık = YER)
// Çocuk bu üç cümleyle üç harekeyi de yerinden ve sesinden tanır.
//
// İKİNCİ KATMAN (yapısal derinlik — hem kalıcılık hem de eğitimci/kurum gözü):
// ÜSTÜN ve ÖTRE gerçekten kendi uzatma harflerinin minyatürüdür (Ebü'l-Esved
// sisteminde harekeler küçültülmüş harflerdir): Üstün = yan yatmış küçük ELİF,
// Ötre = küçülmüş VAV. AMA ESRE ŞEKİL OLARAK YE'YE BENZEMEZ (kullanıcı
// düzeltmesi, doğru): esre çizgi olarak üstünle AYNI işarettir, yalnız satırın
// ALTINA yazılır — yani esre, "üstünün ikizi/aynası"dır, ayrı bir harfin
// minyatürü değil. "Esre + Ye = uzun î" ayrı bir gerçek: bu bir ŞEKİL
// benzerliği değil, MED (uzatma) konusunda geçerli olan bir EŞLEŞME kuralı —
// ikisini karıştırmamak için `future` alanında ayrı tutulur, animasyonda
// gösterilmez.
//
// Bu bilgi ileride MED konusunda karşılığını verir: üstün+elif = â, esre+ye =
// î, ötre+vav = û. Çocuğa şimdi "uzun hâli" yükü bindirilmez; yalnızca ileri
// kanca (future) olarak, üstü kapalı bir bilgi notu şeklinde durur.

export interface HarekeMnemonic {
  id: "fetha" | "esre" | "otre";
  name: string;          // Üstün / Esre / Ötre
  mark: string;          // birleştirici + hareke (tek başına görünsün diye)
  onLetter: string;      // örnek harf üzerinde (Be)
  /** Türkçe ANA kanca — çocuğun ezberleyeceği tek cümle. */
  hook: string;
  /** Kancanın türü (rozet metni). */
  hookKind: string;
  position: "üstte" | "altta";
  /** İnce harfte / kalın harfte Türkçe ses. */
  soundThin: string;
  soundThick: string;
  /** Animasyonun "kaynak" şekli: gerçek harf mi (harf), yoksa üstünün kendi
   *  işareti mi (isaret — esre bunu kullanır, sahte bir harf benzerliği
   *  uydurmak yerine dürüstçe "aynı işaret, ters konum" gösterir). */
  morphKind: "harf" | "isaret";
  morphGlyph: string;    // ا / و (harf) ya da ◌َ (üstün işareti)
  /** Dönüşüm cümlesi — üstteki başlık: "Elif küçülünce →" gibi. */
  morphLabel: string;
  /** Şekil bağı, çocuk diliyle (kart altında, uzun açıklama). */
  shapeSay: string;
  /** İleri kanca: med'de ne olacak (bilgi notu, yük değil — EŞLEŞME, şekil değil). */
  future: string;
  /** Animasyon parametreleri (CSS değişkenlerine geçer). */
  rotate: number;    // derece
  scale: number;     // hedef ölçek
  translateY: number; // px — yalnız esre'de kullanılır (yukarıdan aşağı iner)
}

export const HAREKE_MNEMONICS: HarekeMnemonic[] = [
  {
    id: "fetha",
    name: "Üstün",
    mark: "◌َ",
    onLetter: "بَ",
    hook: "ÜSTÜN'ün adında ÜST var → harfin ÜSTünde durur.",
    hookKind: "adı yerini söylüyor",
    position: "üstte",
    soundThin: "e",
    soundThick: "a",
    morphKind: "harf",
    morphGlyph: "ا",
    morphLabel: "Elif yan yatınca →",
    shapeSay: "Elif dimdik durur; yan yatınca üstün olur — küçük bir yatak gibi.",
    future: "İleride: üstün + Elif yan yana gelince ses uzar (â).",
    rotate: -70,
    scale: 0.26,
    translateY: 0,
  },
  {
    id: "esre",
    name: "Esre",
    mark: "◌ِ",
    onLetter: "بِ",
    hook: "ESRE, üstünün tam TERSİ → harfin ALTında durur.",
    hookKind: "üstünün tersi",
    position: "altta",
    soundThin: "i",
    soundThick: "ı",
    morphKind: "isaret",
    morphGlyph: "",
    morphLabel: "Üstün aşağı inince →",
    shapeSay: "Esre, üstünle AYNI çizgi — sadece harfin üstüne değil, altına yazılır. Bir harfin küçüğü değil, üstünün ikizi.",
    future: "İleride: esre'den sonra Ye gelirse ses uzar (î) — bu bir eşleşme kuralı, şekil benzerliği değil.",
    rotate: -12,
    scale: 1,
    translateY: 46,
  },
  {
    id: "otre",
    name: "Ötre",
    mark: "◌ُ",
    onLetter: "بُ",
    hook: "ÖTRE'nin adında Ö var, ağzın yuvarlanır → Ü diye okunur.",
    hookKind: "adı sesini söylüyor",
    position: "üstte",
    soundThin: "ü",
    soundThick: "u",
    morphKind: "harf",
    morphGlyph: "و",
    morphLabel: "Vav küçülünce →",
    shapeSay: "Vav kıvrımlıdır; küçülünce ötre olur — minik bir kıvrım.",
    future: "İleride: ötre + Vav yan yana gelince ses uzar (û).",
    rotate: 0,
    scale: 0.3,
    translateY: 0,
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
