// ARAPÇA GLİFİ KUTUSUNA ORTALAMA — mürekkep ölçüsüyle.
//
// ⚠️ `line-height` SATIR KUTUSUNU büyütür, MÜREKKEBİ ORTALAMAZ. Bir glifin
// dikey yeri fontun ascent/descent ölçülerinden gelir; oysa Arapça harflerde
// mürekkebin taban çizgisine göre dağılımı harften harfe uçurum kadar
// değişiyor:
//   • ج ح خ  → çanak taban çizgisinin ÇOK ALTINA iner (büyük descent)
//   • ا ل ك  → neredeyse tamamı taban çizgisinin ÜSTÜNDE
// Bu yüzden hepsi aynı kutuya konunca ج aşağıdan sarkıyor, elif yukarıda
// asılı kalıyordu (kullanıcı: "cim gibi harfler beyaz arka planın tam
// ortasında değil, aşağıdan dışarı sarkıyor").
//
// Çözüm: glifin GERÇEK mürekkep kutusunu canvas ile ölç, kutunun ortasına
// getirecek kaydırmayı hesapla. Kaydırma `em` cinsinden döner — punto ne
// olursa olsun (şimşek 5.5rem, tabela 4.5rem, Yılan 3.8rem) aynı değer işler.
//
// ⚠️ FONT YÜKLENMEDEN ölçüm YANLIŞ çıkar (tarayıcı yedek fontu ölçer).
// `document.fonts.ready` beklenip önbellek bir kez temizleniyor.

/** Kullanıcı isteği: tam ortadan bu kadar YUKARI dursun (em). */
const YUKARI_PAY = 0.05;

let _fontAilesi: string | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
const _cache = new Map<string, number>();
let _fontHazir = false;

function fontAilesi(): string {
  if (_fontAilesi) return _fontAilesi;
  // Yedek: index.css'teki .font-arabic ile aynı yığın.
  let aile = '"Amiri Quran", "Amiri", "Scheherazade New", "Traditional Arabic", serif';
  try {
    const el = document.createElement("span");
    el.className = "font-arabic";
    el.style.cssText = "position:absolute;visibility:hidden;left:-9999px";
    document.body.appendChild(el);
    const f = getComputedStyle(el).fontFamily;
    if (f) aile = f;
    el.remove();
  } catch { /* ignore */ }
  _fontAilesi = aile;
  return aile;
}

function ctx(): CanvasRenderingContext2D | null {
  if (_ctx) return _ctx;
  try {
    const c = document.createElement("canvas");
    _ctx = c.getContext("2d");
  } catch { return null; }
  return _ctx;
}

/** Font yüklenince önbelleği bir kez at — ilk ölçümler yedek fontla yapılmış olabilir. */
function fontuBekle() {
  if (_fontHazir) return;
  _fontHazir = true;
  try {
    void (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() => {
      _cache.clear();
      _fontAilesi = null;
    });
  } catch { /* ignore */ }
}

/**
 * Glifi kutusunun ortasına getirecek dikey kaydırma (em).
 *
 * Pozitif = aşağı. `transform: translateY(${n}em)` olarak uygulanır.
 * Türetme (ÖLÇÜM = 100px'te yapılır, sonra em'e bölünür):
 *   satır kutusunda taban çizgisi = (LH − (fAsc+fDesc))/2 + fAsc
 *   mürekkep ortası (tepeden)     = taban + (desc − asc)/2
 *   kutu ortası                   = LH/2
 *   kaydırma = kutu ortası − mürekkep ortası
 *            = ((fDesc − fAsc) − (desc − asc)) / 2
 * (LH sadeleşiyor: kaydırma satır yüksekliğinden BAĞIMSIZ.)
 */
export function glifKaydirmaEm(glif: string): number {
  if (!glif || typeof document === "undefined") return 0;
  const hit = _cache.get(glif);
  if (hit !== undefined) return hit;
  fontuBekle();
  const g = ctx();
  if (!g) return 0;
  const PX = 100;
  g.font = `${PX}px ${fontAilesi()}`;
  g.direction = "rtl";
  const m = g.measureText(glif);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  const fAsc = m.fontBoundingBoxAscent;
  const fDesc = m.fontBoundingBoxDescent;
  // Tarayıcı bu ölçüleri vermiyorsa (eski WebView) kaydırma yapma.
  if (![asc, desc, fAsc, fDesc].every((x) => typeof x === "number" && isFinite(x))) return 0;
  const kaydir = (((fDesc - fAsc) - (desc - asc)) / 2) / PX - YUKARI_PAY;
  // Emniyet kelepçesi: ölçüm saçmalarsa glifi kutudan dışarı fırlatma.
  const n = Math.max(-0.5, Math.min(0.5, kaydir));
  _cache.set(glif, n);
  return n;
}

/** Doğrudan `style` nesnesine konacak hâli. */
export function glifOrtalaStyle(glif: string): { transform: string } {
  return { transform: `translateY(${glifKaydirmaEm(glif).toFixed(4)}em)` };
}
