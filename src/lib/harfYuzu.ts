// 😀 HARFE YÜZ TAKMA — göz ve ağzın harfin MÜREKKEBİ üzerinde nereye oturacağı.
//
// ⚠️ NEDEN AYRI MODÜL: aynı kural İKİ şekil için gerekiyor — silme ÖNCESİ
// yalın harf (ج) ve silme SONRASI "başta" hâli (ﺟ). İkisi FARKLI çizimler;
// yüz eski şeklin yerinde bırakılırsa harf dönüşünce surat havada kalıyor
// (kullanıcı bildirdi: "silindikten sonraki suratlar düzgün değil").
// Kural tek yerde durursa iki şekil de aynı mantıkla yüz alır ve ölçüm aracı
// bileşenden ayrışamaz.
//
// ⚠️ KUTUNUN ORTASI YETMEZ: mürekkep kutusuna harfin NOKTASI da giriyor;
// nokta gövdeden uzakta olduğu için kutu ortası boşluğa düşebiliyor
// (ölçüldü: Hı, Dad, Lem'de göz havadaydı). Bu yüzden yüz, gövdenin EN GENİŞ
// MÜREKKEP SATIRI üzerine kurulur.
//
// ⚠️ NOKTA GÖVDEDEN AYRILIR: "en geniş satır" ararken küçük kopuk lekeler
// (noktalar) hesaba katılmaz — yoksa üç noktalı Şın'da satır genişliği
// noktaların yayıldığı alana göre ölçülüp gözler birbirinden kopuyordu.

export interface Yuz {
  /** göz merkezlerinin ortası */
  gx: number;
  /** göz hattı */
  gy: number;
  /** göz yarıçapı */
  ar: number;
  /** iki gözün merkezden uzaklığı */
  ayrik: number;
  /** ağzın y'si */
  agizY: number;
  /** ağız yarıçapı */
  agizR: number;
}

/** Bir satırdaki mürekkebin en solu/en sağı ve toplam piksel sayısı. */
function satir(f: Uint8Array, cw: number, y: number, x0: number, x1: number) {
  let sol = -1, sag = -1, adet = 0;
  for (let x = x0; x <= x1; x++) {
    if (!f[y * cw + x]) continue;
    if (sol < 0) sol = x;
    sag = x; adet++;
  }
  return { sol, sag, adet };
}

/**
 * Şeklin mürekkebine göre yüz yerleşimi.
 *
 * @param f    mürekkep bayrakları (bkz. tailMask.inkFlags / TailMask.headFlags)
 * @param box  mürekkebin sınır kutusu
 */
export function yuzYeri(
  f: Uint8Array,
  cw: number,
  box: { left: number; right: number; top: number; bottom: number },
): Yuz | null {
  const bw = box.right - box.left, bh = box.bottom - box.top;
  if (bw <= 0 || bh <= 0) return null;

  // 1) ADAY GÖZ HATLARI — üst bölgedeki satırlar, "geniş + dolu" skoruyla.
  // ⚠️ Yalnız genişliğe bakmak yetmez: noktalar aynı satıra düşünce satır
  // "geniş" görünüyor ama arası boş. Doluluk oranı da şart.
  const adaylar: { y: number; sol: number; sag: number; skor: number }[] = [];
  const y0 = Math.round(box.top + bh * 0.10);
  const y1 = Math.round(box.top + bh * 0.68);
  for (let y = y0; y <= y1; y++) {
    const r = satir(f, cw, y, box.left, box.right);
    if (r.sol < 0) continue;
    const gen = r.sag - r.sol;
    if (gen <= 0) continue;
    const doluluk = r.adet / gen;
    adaylar.push({ y, sol: r.sol, sag: r.sag, skor: gen * Math.min(1, doluluk * 2.2) });
  }
  if (adaylar.length === 0) return null;
  adaylar.sort((a, b) => b.skor - a.skor);

  /**
   * GÖZ BOYU ŞEKLİN BÜTÜNÜNDEN GELİR, seçilen satırın genişliğinden değil.
   *
   * ⚠️ ÖNCE `ar = satır genişliği × 0.15` idi ve ince gövdeli harflerde
   * (Lem, Be, Nun) satır dar olduğu için göz alt sınıra (6) yapışıyordu:
   * ekranda yüz minicik kalıyor, "cıvıl cıvıl" hissi kayboluyordu (görsel
   * denetimde yakalandı). Şeklin en uzun kenarına bağlayınca bütün harflerde
   * yaklaşık aynı boy çıkıyor. İnce harfte göz gövdeden TAŞAR — çizgi film
   * gözü gibi durur, kasıtlıdır.
   */
  /**
   * ⚠️ ÜST SINIR ORANTILI OLMALI. Sabit 16 px iken sahne büyütülünce (harf
   * %60 büyüdü) gözler olduğu yerde kalıp harfe göre KÜÇÜLDÜ. Sınır artık
   * geniş; asıl boy yine şeklin en uzun kenarından geliyor.
   */
  const ar = Math.max(8, Math.min(40, Math.max(bw, bh) * 0.11));

  /** `gy`nin altında, `gx` çevresinde mürekkep olan en uygun ağız satırı. */
  const agizAra = (gy: number, gx: number): number => {
    const istenen = Math.round(gy + ar * 1.9);
    let bulunan = -1, enYakin = Infinity;
    for (let y = Math.round(gy + ar * 0.9); y <= box.bottom; y++) {
      const r = satir(f, cw, y, Math.round(gx - ar * 1.2), Math.round(gx + ar * 1.2));
      if (r.sol < 0) continue;
      const uzak = Math.abs(y - istenen);
      if (uzak < enYakin) { enYakin = uzak; bulunan = y; }
    }
    return bulunan;
  };

  /**
   * 2) GÖZ HATTINI SEÇ — ama ALTINDA AĞZA YER KALMALI.
   *
   * ⚠️ ÖLÇÜLDÜ: yalnız "en geniş satır" kuralıyla MİM'de (م) gözler halkanın
   * en geniş yerine oturuyordu (y=196) ve altında `gx` çevresinde yalnız
   * 5 satır mürekkep kalıyordu — ağız halkanın İÇİNDEKİ boşluğa düşüyordu
   * (30 ölçümün 1'i başarısızdı). Küçük yuvarlak harfte "gözlerin altı"
   * demek mürekkebin değil deliğin altı demek. Bu yüzden adaylar skor
   * sırasıyla denenir ve ağza yer bulunan ilk hat seçilir; yüz böylece
   * kendiliğinden yukarı kayar.
   */
  let en = adaylar[0];
  let agizY = -1;
  for (const a of adaylar) {
    const m = agizAra(a.y, (a.sol + a.sag) / 2);
    if (m >= 0) { en = a; agizY = m; break; }
  }

  const gen = Math.max(1, en.sag - en.sol);
  const gx = (en.sol + en.sag) / 2;
  /**
   * ⚠️ GÖZLER MÜREKKEBE TUTUNMALI — açıklık körlemesine verilemez.
   * Sahne büyütülünce (harf %60 büyüdü) `ar` ve dolayısıyla açıklık da
   * büyüdü; ölçümde 30 yüzün 4'ünde gözler seçilen satırın mürekkebinden
   * DIŞARI çıktı (Sad/Dad/Ayn'ın "başta" hâlleri geniş ve yassı). Bu yüzden
   * açıklık, iki göz de mürekkebin üstünde kalana kadar daraltılır.
   */
  const inkVar = (cx: number) => {
    const r = Math.round(ar * 0.7);
    for (let dy = -r; dy <= r; dy += 2) {
      const yy = Math.round(en.y + dy);
      if (yy < 0 || yy >= Math.ceil(f.length / cw)) continue;
      for (let dx = -r; dx <= r; dx += 2) {
        const xx = Math.round(cx + dx);
        if (xx < 0 || xx >= cw) continue;
        if (f[yy * cw + xx]) return true;
      }
    }
    return false;
  };
  let ayrik = Math.max(ar * 1.12, Math.min(gen * 0.27, ar * 2.1));
  for (let i = 0; i < 12 && !(inkVar(gx - ayrik) && inkVar(gx + ayrik)); i++) {
    ayrik *= 0.85;
    if (ayrik < ar * 0.5) { ayrik = ar * 0.5; break; }
  }
  if (agizY < 0) agizY = Math.max(en.y + ar * 1.1, box.bottom - ar * 0.4);
  return { gx, gy: en.y, ar, ayrik, agizY, agizR: ar * 0.92 };
}
