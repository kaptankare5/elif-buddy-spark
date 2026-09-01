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
//
// ⚠️ ÖNBELLEĞİ TEMİZLEMEK TEK BAŞINA YETMİYORDU — kimse yeniden çizmiyordu.
// Font yüklenmeden çizilen bileşen YEDEK FONTLA ölçülmüş kaydırmayı ömür boyu
// taşıyordu (ölçüldü: ح'ye −0.29 em uygulanmıştı, doğrusu −0.785 em; harf
// kutunun 31 px altında kalıyordu). Artık `document.fonts.ready` bir SÜRÜM
// sayacını artırıyor ve `EmojiView` `useSyncExternalStore` ile ona abone —
// font gelince bir kez yeniden çizilir.

/** Kullanıcı isteği: tam ortadan bu kadar YUKARI dursun (em). */
const YUKARI_PAY = 0.05;

let _fontAilesi: string | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
const _cache = new Map<string, number>();
let _fontHazir = false;
// Font yüklenince artan sürüm — abone bileşenler yeniden çizilsin diye.
let _surum = 0;
const _aboneler = new Set<() => void>();

/** Ölçüm sürümüne abone ol (React `useSyncExternalStore` için). */
export function glifOlcumAboneOl(cb: () => void): () => void {
  _aboneler.add(cb);
  return () => { _aboneler.delete(cb); };
}
/** Şu anki ölçüm sürümü — font yüklenince değişir. */
export function glifOlcumSurumu(): number { return _surum; }

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
      _surum += 1;
      for (const cb of _aboneler) cb();
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
  /**
   * Emniyet kelepçesi: ölçüm saçmalarsa glifi kutudan dışarı fırlatma.
   *
   * ⚠️ 0.5 EM ÇOK DARDI — GERÇEK DEĞERLERİ KESİYORDU. Ölçüldü (Amiri Quran,
   * 28 harf + 8 harekeli dizi = 36 glif): gereken kaydırma **−0.815 .. −0.177**
   * em aralığında ve **36 glifin 14'ü** 0.5 kelepçesine takılıyordu — hem de
   * tam şikâyet edilenler: ج ح خ (0.285 em kayıp) · م (0.235) · ع (0.145) ·
   * ي (0.165) · ر (0.120). Kelepçe "ölçüm bozulursa" içindi ama sessizce
   * DOĞRU ölçümü de kırpıyordu; ح 72px puntoda 20.5 px aşağıda kalıyordu.
   * Yeni sınır ölçüme dayanıyor: en uçtaki gereksinim 0.815, tavan 1.0 em
   * (satır kutusunun kendisinden büyük bir kaydırma zaten anlamsızdır).
   */
  const n = Math.max(-1, Math.min(1, kaydir));
  _cache.set(glif, n);
  return n;
}

/** Doğrudan `style` nesnesine konacak hâli. */
export function glifOrtalaStyle(glif: string): { transform: string } {
  return { transform: `translateY(${glifKaydirmaEm(glif).toFixed(4)}em)` };
}
