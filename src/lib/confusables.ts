// KARIŞAN HARF AYRIMI (discriminative-contrast). Bilim: karıştırılan
// kategorileri ayırt etmenin en güçlü yolu onları YAN YANA görmektir
// (Kornell & Bjork; Birnbaum, Kornell, Bjork & Bjork 2013; Kang & Pashler).
// Elifbâ'da harfler çoğunlukla AYNI iskeleti (rasm) paylaşıp yalnız noktayla
// ayrılır: ب/ت/ث/ن/ي, ج/ح/خ, د/ذ, ر/ز, س/ش, ص/ض, ط/ظ, ع/غ, ف/ق. Çoktan
// seçmeli testte çeldiricileri RASTGELE değil, hedefin KARIŞANLARINDAN
// seçersek test artık gerçekten ayrım eğitir (yalnız fark kalır → çocuk farkı
// yakalar). Hareke/cezm gibi konularda da işler: id kalıbı `lN-NN-...` temel
// harf numarasını taşır, karışıklık o numara üzerinden bulunur.
import type { ContentItem } from "@/data/types";

// Karışan harf öbekleri (harf no 1..28). Simetrik komşuluk üretilir.
const GROUPS: number[][] = [
  [2, 3, 4, 25, 28], // ب ت ث ن ي — "diş" iskeleti + nokta
  [5, 6, 7],         // ج ح خ
  [8, 9],            // د ذ
  [10, 11],          // ر ز
  [12, 13],          // س ش
  [14, 15],          // ص ض
  [16, 17],          // ط ظ
  [18, 19],          // ع غ
  [20, 21],          // ف ق
  [1, 23],           // ا ل — dikey çizgi
  [22, 23],          // ك ل — uzun boy
  [24, 27],          // م ه — ilmek
];

const CONFUSABLE: Record<number, Set<number>> = {};
for (const g of GROUPS) {
  for (const a of g) {
    (CONFUSABLE[a] ??= new Set<number>());
    for (const b of g) if (b !== a) CONFUSABLE[a].add(b);
  }
}

// id → temel harf numarası (l1-02 → 2, l3-14-a → 14). Eşleşmezse null (Ekstralar).
export function letterNumOf(id: string): number | null {
  const m = id.match(/^l\d+-(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

// id → temel harf sonrası ek (hareke/koda), örn "l3-14-a" → "a". Aynı ekli
// karışanları öne almak için (yalnız HARF farkı kalsın → saf ayrım).
function suffixOf(id: string): string {
  const m = id.match(/^l\d+-\d{2}-(.+)$/);
  return m ? m[1] : "";
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Hedefe çeldirici seç: önce KARIŞAN harfler (aynı ek/hareke önce), sonra
// diğer karışanlar, en son rastgele doldurma. Karışan yoksa/az ise sorunsuz
// rastgeleye düşer (eski davranış).
export function pickDistractors(pool: ContentItem[], target: ContentItem, count = 3): ContentItem[] {
  const others = pool.filter((it) => it.id !== target.id);
  const tn = letterNumOf(target.id);
  if (tn == null || !CONFUSABLE[tn]) return shuffle(others).slice(0, count);
  const conf = CONFUSABLE[tn];
  const tsuf = suffixOf(target.id);
  const isConf = (it: ContentItem) => {
    const n = letterNumOf(it.id);
    return n != null && conf.has(n);
  };
  const confItems = others.filter(isConf);
  const sameSuf = shuffle(confItems.filter((it) => suffixOf(it.id) === tsuf));
  const otherConf = shuffle(confItems.filter((it) => suffixOf(it.id) !== tsuf));
  const rest = shuffle(others.filter((it) => !isConf(it)));
  return [...sameSuf, ...otherConf, ...rest].slice(0, count);
}
