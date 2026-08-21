/**
 * GÖRSEL OYUN HİSSİ — `juice.ts`'in gözle görülen kardeşi.
 *
 * `juice.ts` KULAĞA ve ELE (ses + titreşim) hitap ediyor. Bu dosya GÖZE:
 * ekran sarsıntısı, donma karesi, ezilme-uzama, kamera gecikmesi, yumuşatma
 * eğrileri ve platform zıplamasının "hissi".
 *
 * ⚠️ NEDEN GEREKLİ: ses katmanı 15 oyunun hepsine yayılmıştı ama görsel
 * taraf boştu — `SARSINTI_SINIFI` dışa aktarılmış olmasına rağmen HİÇBİR
 * oyun kullanmıyordu (ölü kod). Oyunlar doğru çalışıyor ama "tokat" atmıyordu.
 *
 * Kaynaklar (tür tür araştırıldı):
 * · Steve Swink, *Game Feel* — gerçek zamanlı kontrol + benzetilmiş uzam +
 *   cila. İlk ikisi "hissiyat", üçüncüsü "juice".
 * · Jan Willem Nijman (Vlambeer), *The Art of Screenshake* — donma karesi
 *   (hitstop) 60-80 ms, kamera tekmesi, kalıcılık, namlu parlaması.
 * · Jonasson & Purho, *Juice it or lose it* — ezilme-uzama, yumuşatma,
 *   parçacık, aşımlı (overshoot) yaylanma.
 * · Squirrel Eiserloh, *Juicing Your Cameras With Math* — TRAVMA modeli:
 *   sarsıntı travmanın KARESİYLE ölçeklenir, böylece küçük olaylar hafif,
 *   büyük olaylar sert hissettirir ve sarsıntı doğrusal sönümlenir.
 * · Platform türü (Mario/Celeste ölçüleri): sekmeli zamanı ~100 ms, zıplama
 *   tamponu ~150 ms, düşüşte yerçekimi 1.5-2.5×, tepeye varış 0.3-0.45 sn.
 *
 * ⚠️ ÇOCUK KISITI: sarsıntı OYUN ALANINA uygulanır, sayfaya değil; genlik
 *   küçük tutulur (yazı okunmaz olmasın, mide bulanmasın) ve donma karesi
 *   100 ms'i geçmez — 6 yaşındaki çocuk uzun donmayı "takıldı" sanıyor.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// ------------------------------------------------------------ sabitler

/** Tür araştırmasından çıkan ölçüler; oyunlar bunları temel alır. */
export const HIS = {
  /** Zemini terk ettikten sonra zıplama hakkının sürdüğü süre (sn). */
  COYOTE: 0.1,
  /** Havadayken basılan zıplamanın hatırlanma süresi (sn). */
  TAMPON: 0.15,
  /** Düşerken yerçekimi çarpanı — çıkış yavaş, iniş hızlı olsun. */
  DUSUS_CARPANI: 2.0,
  /** |vy| bu eşiğin altındayken (tepe noktası) yerçekimi azalır. */
  APEX_ESIK: 130,
  /** Tepe noktasındaki yerçekimi çarpanı — kısa bir "asılı kalma". */
  APEX_CARPAN: 0.55,
  /** Donma karesi (sn). Vlambeer 60-80 ms diyor; çocukta üst sınır 0.1. */
  HITSTOP: 0.07,
  /** Sarsıntının tamamen sönmesi (sn). */
  SARSINTI_SURE: 0.45,
} as const;

// ------------------------------------------------------------ yumuşatma

/**
 * ⚠️ **HAREKET DUYARLILIĞI (`prefers-reduced-motion`)** — sarsıntı, görüş
 * açısı oynaması ve ekran titremesi benzetim baş dönmesinin (simülasyon
 * hastalığı) bilinen tetikleyicileri; insanların üçte birine kadarını
 * etkiliyor ve bu bir ÇOCUK uygulaması. Kullanıcı (ya da veli) cihaz
 * ayarlarından "hareketi azalt" dediyse görsel his katmanı KISILIR:
 * geri bildirim kaybolmaz ama genliği dörtte bire iner.
 *
 * ⚠️ Değer önbelleğe ALINMAZ ama medya sorgusu her karede okunmaz — sorgu
 * nesnesi bir kez kurulur, `matches` alanı canlıdır (ayar değişince kendi
 * kendine güncellenir).
 */
let _azSorgu: MediaQueryList | null = null;
/**
 * Yalnız test içindir: sorgu nesnesi bir kez kurulup önbelleğe alınıyor
 * (gerçek tarayıcıda `matches` CANLI, ayar değişince kendi güncelliyor) —
 * testte `window.matchMedia` taklit edilince önbellek eskimiş kalıyor.
 * `srs.ts`'teki `__resetSelectorState` ile aynı desen.
 */
export function __resetHareket() { _azSorgu = null; }
export function hareketKatsayisi(): number {
  if (typeof window === "undefined" || !window.matchMedia) return 1;
  if (!_azSorgu) _azSorgu = window.matchMedia("(prefers-reduced-motion: reduce)");
  return _azSorgu.matches ? 0.25 : 1;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * KARE HIZINDAN BAĞIMSIZ yumuşatma. Düz `lerp(a, b, 0.1)` her karede bir kez
 * çalıştığı için 30 fps'lik telefonda 60 fps'lik telefondan YAVAŞ takip eder;
 * kamera cihaza göre başka türlü hissettirir. Üstel form bunu düzeltir.
 */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hedefi biraz aşıp geri gelir — "pop" hissi (Jonasson & Purho). */
export function easeOutBack(t: number, asim = 1.70158): number {
  const c = asim + 1;
  return 1 + c * Math.pow(t - 1, 3) + asim * Math.pow(t - 1, 2);
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;

/** 0→1→0 : bir kere şişip sönen darbe eğrisi. */
export const darbe = (t: number) => Math.sin(Math.PI * clamp(t, 0, 1));

// ------------------------------------------------------------ ekran sarsıntısı

export interface Sarsinti {
  /** Olay şiddeti ekle (0..1). Aynı karede birden çok olay birikir. */
  ekle(miktar: number): void;
  /** Her karede bir kez çağır. */
  guncelle(dt: number): void;
  /** O anki kaydırma. `rot` radyan — 3B kamerada kullanma, 2B'de hoş durur. */
  ofset(): { x: number; y: number; rot: number };
  /** 0 = sakin. Oyun kendi efektini buna bağlamak isterse. */
  readonly travma: number;
}

/**
 * TRAVMA MODELİ (Eiserloh): sarsıntı = travma². Doğrusal kullanılırsa küçük
 * olaylar bile gözü tırmalıyor; kare alınca hafif olaylar neredeyse
 * görünmez, sert olaylar patlıyor — ikisi TEK sayıyla ayarlanıyor.
 *
 * @param maks piksel (2B) ya da dünya birimi (3B) cinsinden en büyük kayma
 */
export function createSarsinti(maks = 10, maksRot = 0.02): Sarsinti {
  let travma = 0;
  let t = 0;
  return {
    get travma() { return travma; },
    ekle(miktar) { travma = clamp(travma + miktar, 0, 1); },
    guncelle(dt) {
      t += dt;
      travma = Math.max(0, travma - dt / HIS.SARSINTI_SURE);
    },
    ofset() {
      if (travma <= 0) return { x: 0, y: 0, rot: 0 };
      const s = travma * travma * hareketKatsayisi();   // ⚠️ kare — modelin özü
      // Gürültü olarak farklı frekanslı sinüsler: rastgele sayı her karede
      // zıpladığı için titreşim "kar gürültüsü" gibi görünüyor, sinüs
      // karışımı gerçek bir sarsıntı gibi salınıyor.
      return {
        x: s * maks * Math.sin(t * 57.1),
        y: s * maks * Math.sin(t * 43.7 + 1.7),
        rot: s * maksRot * Math.sin(t * 37.3 + 0.6),
      };
    },
  };
}

// ------------------------------------------------------------ donma karesi

export interface Hitstop {
  /** Vuruşu bildir; süre sn (varsayılan HIS.HITSTOP). */
  vur(sure?: number): void;
  /** dt'yi süzer: donma sırasında 0 döner, oyun olduğu yerde kalır. */
  suz(dt: number): number;
  readonly donuk: boolean;
}

/**
 * DONMA KARESİ ("hitstop"): vuruş anında oyun 60-80 ms duruyor. Vlambeer'in
 * tespiti — bu minik sürtünme beyne "bu ÖNEMLİYDİ" diyor. Sarsıntıyla
 * birlikte kullanılır: önce dur, sonra sars.
 *
 * ⚠️ Donma dt'yi 0'a çeker ama SARSINTI donma sırasında da işlemeli, yoksa
 * ekran donarken sarsıntı da donar ve etki kaybolur. Bu yüzden oyunlar
 * `sarsinti.guncelle(gercekDt)` + `oyunAdimi(hitstop.suz(gercekDt))` sırasını
 * kullanır.
 */
export function createHitstop(): Hitstop {
  let kalan = 0;
  return {
    get donuk() { return kalan > 0; },
    vur(sure = HIS.HITSTOP) { kalan = Math.max(kalan, sure); },
    suz(dt) {
      if (kalan <= 0) return dt;
      kalan -= dt;
      return 0;
    },
  };
}

// ------------------------------------------------------------ ezilme–uzama

/**
 * EZİLME-UZAMA (squash & stretch) — animasyonun 12 ilkesinden ilki.
 * Yükselirken incelip uzar, düşerken de uzar (ama ters yönde okunur),
 * yere çarpınca EZİLİR. Hacim korunur (sx * sy ≈ 1), yoksa karakter
 * şişip söner gibi görünür.
 *
 * @param vy      dikey hız (ekran ekseni: aşağısı +)
 * @param maksVy  ölçeğin doyduğu hız
 * @param inisT   inişten bu yana geçen süre (sn) — 0..INIS_SURE arası ezer
 */
export const INIS_SURE = 0.14;
export function ezilmeUzama(vy: number, maksVy: number, inisT = 99): { sx: number; sy: number } {
  if (inisT < INIS_SURE) {
    // İniş ezilmesi: önce çök, sonra yaylanarak geri gel (aşımlı).
    const k = 1 - inisT / INIS_SURE;
    const e = 0.26 * k * k;
    return { sx: 1 + e, sy: 1 - e };
  }
  const u = clamp(vy / maksVy, -1, 1);
  const e = 0.18 * u;              // yukarı (vy<0) → uzar, aşağı → hafif uzar
  return { sx: 1 - Math.abs(e) * 0.7, sy: 1 + Math.abs(e) };
}

// ------------------------------------------------------------ zıplama yardımı

export interface ZiplamaYardimi {
  /** Her karede: zeminde mi, zıplama tuşuna basıldı mı, tuş basılı mı. */
  guncelle(dt: number, zeminde: boolean, basildi: boolean): boolean;
  /** Yerçekimi çarpanı — çıkış/tepe/iniş için ayrı (Mario asimetrisi). */
  yercekimiCarpani(vy: number): number;
  /** Tuş erken bırakıldıysa yükselişi kes. */
  kes(vy: number, basiliMi: boolean, kesHizi: number): number;
}

/**
 * ⚠️ ÜÇ AYRI HİLE, ÜÇÜ DE "ADALETSİZ" AMA DOĞRU HİSSETTİRİR:
 *  1. SEKMELİ ZAMAN (coyote time, ~100 ms): kenardan düştükten sonra hâlâ
 *     zıplayabilirsin. İnsan tepki gecikmesiyle tam örtüşüyor; oyuncu
 *     "bastım ama zıplamadı" demiyor.
 *  2. ZIPLAMA TAMPONU (~150 ms): havadayken basılan zıplama hatırlanır,
 *     yere değer değmez tetiklenir. Yoksa çocuk her inişte bir zıplama
 *     kaybediyor.
 *  3. ASİMETRİK YERÇEKİMİ: iniş çıkıştan ~2× hızlı. Simetrik zıplama
 *     "uçuyor" gibi hissettiriyor; tepe noktasında yerçekimini AZALTMAK
 *     (apex) ise havada nişan almayı kolaylaştırıyor.
 */
export function createZiplamaYardimi(
  coyote = HIS.COYOTE,
  tampon = HIS.TAMPON,
): ZiplamaYardimi {
  let coyoteT = 0;
  let tamponT = 0;
  return {
    guncelle(dt, zeminde, basildi) {
      if (basildi) tamponT = tampon;
      else tamponT = Math.max(0, tamponT - dt);
      if (zeminde) coyoteT = coyote;
      else coyoteT = Math.max(0, coyoteT - dt);
      if (tamponT > 0 && coyoteT > 0) {
        tamponT = 0;
        coyoteT = 0;
        return true;                   // zıpla
      }
      return false;
    },
    yercekimiCarpani(vy) {
      if (Math.abs(vy) < HIS.APEX_ESIK) return HIS.APEX_CARPAN;
      return vy > 0 ? HIS.DUSUS_CARPANI : 1;
    },
    kes(vy, basiliMi, kesHizi) {
      return !basiliMi && vy < kesHizi ? kesHizi : vy;
    },
  };
}

// ------------------------------------------------------------ parçacıklar

export interface Parcacik {
  x: number; y: number; vx: number; vy: number;
  t: number; omur: number; r: number; renk: string;
  yercekimi?: number;
}

/**
 * Küçük parçacık havuzu (canvas oyunları için). ⚠️ ÜST SINIR ŞART: telefonda
 * sınırsız parçacık kareyi düşürür; en eskiler atılır.
 */
export function createParcaciklar(maks = 90) {
  const list: Parcacik[] = [];
  return {
    get liste() { return list as readonly Parcacik[]; },
    /** Bir noktadan yelpaze şeklinde saçar. */
    patlat(x: number, y: number, adet: number, renk: string, opts?: {
      hiz?: number; omur?: number; r?: number; yercekimi?: number; aci?: number; yayilim?: number;
    }) {
      const hiz = opts?.hiz ?? 120;
      const aci = opts?.aci ?? -Math.PI / 2;
      const yayilim = opts?.yayilim ?? Math.PI * 2;
      for (let i = 0; i < adet; i++) {
        const a = aci + (Math.random() - 0.5) * yayilim;
        const h = hiz * (0.45 + Math.random() * 0.75);
        list.push({
          x, y,
          vx: Math.cos(a) * h, vy: Math.sin(a) * h,
          t: 0,
          omur: (opts?.omur ?? 0.5) * (0.7 + Math.random() * 0.6),
          r: (opts?.r ?? 3) * (0.6 + Math.random() * 0.8),
          renk,
          yercekimi: opts?.yercekimi ?? 420,
        });
      }
      while (list.length > maks) list.shift();
    },
    guncelle(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.t += dt;
        if (p.t >= p.omur) { list.splice(i, 1); continue; }
        p.vy += (p.yercekimi ?? 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    ciz(g: CanvasRenderingContext2D) {
      for (const p of list) {
        const k = 1 - p.t / p.omur;
        g.globalAlpha = k;
        g.fillStyle = p.renk;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (0.35 + k * 0.65), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    },
    temizle() { list.length = 0; },
  };
}

// ------------------------------------------------------------ DOM oyunları

/**
 * DOM (React) oyunları için ekran sarsıntısı. Canvas/3B oyunlar
 * `createSarsinti` kullanır; burada iş CSS animasyonuna düşüyor.
 *
 * ⚠️ CSS animasyonu YENİDEN TETİKLENMEZ: aynı sınıf zaten duruyorsa tarayıcı
 * hiçbir şey yapmaz. Bu yüzden sınıf bir kare için kaldırılıp geri konur.
 * ⚠️ Sarsıntı OYUN ALANINA uygulanır, sayfaya değil (başlık ve puan okunur
 * kalsın; çocukta tüm sayfayı sarsmak mide bulandırıyor).
 */
export function useSarsinti(): { sinif: string; sars: () => void } {
  const [aktif, setAktif] = useState(false);
  const zaman = useRef<number | null>(null);
  const sars = useCallback(() => {
    // Hareket azaltma isteniyorsa DOM sarsıntısı hiç oynatılmaz (CSS
    // animasyonunun genliğini kısmak mümkün değil — ya var ya yok).
    if (hareketKatsayisi() < 1) return;
    if (zaman.current) window.clearTimeout(zaman.current);
    setAktif(false);
    requestAnimationFrame(() => setAktif(true));
    zaman.current = window.setTimeout(() => setAktif(false), 300);
  }, []);
  useEffect(() => () => { if (zaman.current) window.clearTimeout(zaman.current); }, []);
  return { sinif: aktif ? SARSINTI_SINIFI : "", sars };
}

/** `juice.ts` ile aynı sınıf — tek kaynak. */
export const SARSINTI_SINIFI = "animate-juice-shake";
