// KARIŞAN HARF BİLGİSİ (statik) — hangi öğeler birbirine benzediği için
// karıştırılabilir? Burada YALNIZ değişmeyen bilgi durur; çocuğun GERÇEKTEN
// neyi karıştırdığı `src/lib/confusion.ts` içinde ölçülür.
//
// Bilim: karıştırılan kategorileri ayırt etmenin en güçlü yolu onları YAN YANA
// görmektir (Kornell & Bjork; Birnbaum, Kornell, Bjork & Bjork 2013; Kang &
// Pashler). Elifbâ'da iki ayrı karışma ekseni var:
//
//  1) HARF ekseni — aynı iskeleti (rasm) paylaşıp yalnız noktayla ayrılanlar:
//     ب/ت/ث/ن/ي, ج/ح/خ, د/ذ, ر/ز, س/ش, ص/ض, ط/ظ, ع/غ, ف/ق; ayrıca dikey
//     çizgililer ا/ل, uzun boylular ك/ل, ilmekliler م/ه.
//  2) FORM ekseni — AYNI harfin başta/ortada/sonda hâlleri. "Yazılışlar"
//     konusunun bütün derdi budur: çocuk جـ (başta) ile ـجـ (ortada) hâlini
//     karıştırır. Bu yüzden aynı harfin diğer hâlleri de karışan sayılır.
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

/** Bir harfin karıştığı harf numaraları (yoksa boş küme). */
export function confusableLetters(n: number): ReadonlySet<number> {
  return CONFUSABLE[n] ?? new Set<number>();
}

/** id → temel harf numarası (l1-02 → 2, l3-14-a → 14). Eşleşmezse null (Ekstralar). */
export function letterNumOf(id: string): number | null {
  const m = id.match(/^l\d+-(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

/** id → temel harf sonrası ek (hareke/koda/yazılış), örn "l3-14-a" → "a",
 *  "l2-05-init" → "init". Aynı ekli karışanları öne almak için. */
export function suffixOf(id: string): string {
  const m = id.match(/^l\d+-\d{2}-(.+)$/);
  return m ? m[1] : "";
}

/** id → başta/ortada/sonda hâli (yalnız "Yazılışlar" konusu, l2-NN-...). */
export function formOf(id: string): "init" | "med" | "fin" | null {
  const m = id.match(/^l2-\d{2}-(init|med|fin)$/);
  return m ? (m[1] as "init" | "med" | "fin") : null;
}

/**
 * FORM KISITLI ÇİFTLER — bazı harfler HER hâlinde değil, YALNIZ BELİRLİ
 * hâllerinde karışır. Elif ↔ Lem böyle (kullanıcı kararı):
 *
 *   Elif sola BAĞLANMAZ → her hâlinde düz bir dikey çizgidir (ا / ـا).
 *   Lem BAŞTA (لـ) ve ORTADA (ـلـ) da düz dikey çizgidir → KARIŞIR.
 *   Lem SONDA (ـل) ve YALIN (ل) hâlinde derin çanak var → KARIŞMAZ.
 *
 * Bu ayrım havuzu doğrudan etkiler: kısıt olmadan Lem'in çanaklı hâli de
 * Elif'e çeldirici geliyordu — çocuk için bu zor değil, sadece gürültü.
 * `formOf` yalnız "Yazılışlar" konusunda (l2-*) dolu döner; diğer konulardaki
 * yalın glifler null verir, yani onlar da eşleşmez (doğrusu bu).
 */
type Form = "init" | "med" | "fin";
const FORM_RESTRICTED: Array<{ a: number; b: number; onlyFormsOf: number; forms: Set<Form> }> = [
  { a: 1, b: 23, onlyFormsOf: 23, forms: new Set<Form>(["init", "med"]) },
];

function formRestrictionOk(na: number, nb: number, aId: string, bId: string): boolean {
  for (const r of FORM_RESTRICTED) {
    const match = (na === r.a && nb === r.b) || (na === r.b && nb === r.a);
    if (!match) continue;
    const id = na === r.onlyFormsOf ? aId : bId;
    const f = formOf(id);
    if (f == null || !r.forms.has(f)) return false;
  }
  return true;
}

/**
 * İki öğe doğası gereği karışabilir mi? (ölçümden bağımsız, a priori bilgi)
 * - farklı harfler, aynı karışma öbeğinde → evet (form kısıtı varsa ona uy)
 * - AYNI harfin farklı yazılış hâlleri (başta/ortada/sonda) → evet
 */
export function baseConfusable(aId: string, bId: string): boolean {
  if (aId === bId) return false;
  const na = letterNumOf(aId), nb = letterNumOf(bId);
  if (na == null || nb == null) return false;
  if (na !== nb) {
    if (!(CONFUSABLE[na]?.has(nb) ?? false)) return false;
    return formRestrictionOk(na, nb, aId, bId);
  }
  const fa = formOf(aId), fb = formOf(bId);
  return fa != null && fb != null && fa !== fb;
}

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Aynı ek/hareke mi? (yalnız HARF farkı kalsın → saf ayrım) */
export function sameSuffix(aId: string, bId: string): boolean {
  return suffixOf(aId) === suffixOf(bId);
}

/** Havuzdaki a-priori karışanlar (çeldirici sıralamasının iskeleti). */
export function baseConfusablesOf(pool: ContentItem[], target: ContentItem): ContentItem[] {
  return pool.filter((it) => it.id !== target.id && baseConfusable(target.id, it.id));
}
