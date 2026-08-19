// OYUN SONUCU — rekor, oturum kapanışı ve günlük seri, TEK YERDE.
//
// ⚠️ NEDEN VAR: ölçüldü, 15 oyunun 12'si oturumlar arasında HİÇBİR ŞEY
// kaydetmiyordu. Ne rekor, ne yıldız, ne süre. Çocuk 40 harf bilse ertesi gün
// hiçbir izi kalmıyordu — dönmek için sebep yoktu.
//
// ⚠️ REKOR **KENDİ** REKORUDUR, başka çocukla sıralama YOK. 5-8 yaşta
// karşılaştırma yetkinlik hissini besleyen değil zedeleyen bir şey; kendi
// geçmişiyle yarışmak ise rakip gerektirmez, adaletsiz olmaz, hiç bitmez.
//
// ⚠️ İKİ YÖNLÜ SKOR: bazı oyunlarda BÜYÜK iyi (skor, mesafe, dalga), bazısında
// KÜÇÜK iyi (hamle sayısı, süre). Tek bir "en iyi" alanı ikisini de tutamaz;
// yön oyunla birlikte saklanır, yoksa Hafıza'da "en iyi 40 hamle" gibi ters
// bir rekor çıkıyor.
import { useEffect, useRef, useState } from "react";

const KEY = "elifba-oyun-sonuc-v1";
export const OYUN_SONUC_EVENT = "elifba-oyun-sonuc-updated";

/** `yuksek`: büyük değer daha iyi (skor). `dusuk`: küçük daha iyi (hamle/süre). */
export type SkorYonu = "yuksek" | "dusuk";

export interface OyunKaydi {
  enIyi: number;
  yon: SkorYonu;
  /** Kaç kez oynandı — oyun listesinde "hiç oynamadın" ayrımı için. */
  oynama: number;
  /** Son oynama (ms). */
  son: number;
  /** Skorun birimi: "puan" · "harf" · "hamle" · "sn" · "dalga" · "metre" */
  birim: string;
}

type Kayit = Record<string, OyunKaydi>;

function oku(): Kayit {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Kayit; } catch { return {}; }
}

function yaz(k: Kayit) {
  try { localStorage.setItem(KEY, JSON.stringify(k)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(OYUN_SONUC_EVENT)); } catch { /* ignore */ }
}

export interface SonucRaporu {
  /** Bu oturumda rekor kırıldı mı. */
  rekor: boolean;
  /** Bu oturumdan ÖNCEKİ en iyi (yoksa null — ilk oyun). */
  oncekiEnIyi: number | null;
  /** Rekora kalan (yalnız rekor kırılmadıysa ve anlamlıysa). */
  kalan: number | null;
}

/**
 * Oyun bitti: skoru kaydet, rekoru güncelle, günlük seriyi besle.
 *
 * ⚠️ SERİYİ BURADAN BESLİYORUZ. Seri sistemi yalnız SRS cevabıyla ilerliyordu;
 * NORMAL modda oyun cevapları SRS'e yazılmadığı için oyun oynayan çocuğun
 * serisi hiç ilerlemiyordu. Uygulamanın tek günlük geri dönüş kancasının,
 * çocuğun en çok vakit geçirdiği yerden beslenmemesi sistemi yarım bırakıyordu.
 */
export function oyunBitti(
  oyunId: string,
  skor: number,
  opts?: { yon?: SkorYonu; birim?: string },
): SonucRaporu {
  const yon = opts?.yon ?? "yuksek";
  const birim = opts?.birim ?? "puan";
  const hepsi = oku();
  const eski = hepsi[oyunId];
  /**
   * ⚠️ ÖLÇEK DEĞİŞTİYSE ESKİ REKOR ATILIR.
   *
   * Bir oyunun neyi rekor saydığı değişebiliyor (Hafıza "en az hamle"den
   * "en çok tahta"ya geçti). Eski kayıt aynı anahtarda durursa sayılar
   * KARŞILAŞTIRILAMAZ hâle gelir: 6 hamlelik eski rekor, yeni ölçekte
   * "6 tahta" gibi okunup çocuktan 7 tahta bitirmesini ister. Yön ya da
   * birim uyuşmuyorsa kayıt yok sayılır, ilk oyun gibi baştan başlar.
   */
  const uyumlu = !!eski && eski.yon === yon && eski.birim === birim;
  const oncekiEnIyi = uyumlu && eski.oynama > 0 ? eski.enIyi : null;

  const daha = oncekiEnIyi === null ? true
    : yon === "yuksek" ? skor > oncekiEnIyi : skor < oncekiEnIyi;

  hepsi[oyunId] = {
    enIyi: daha ? skor : (oncekiEnIyi ?? skor),
    yon, birim,
    // Oynama sayısı ölçek değişse de korunur — "hiç oynamadın" rozeti için.
    oynama: (eski?.oynama ?? 0) + 1,
    son: Date.now(),
  };
  yaz(hepsi);

  // Günlük seri — oyun oynamak da "bugün çalıştım" sayılır.
  try {
    void import("@/lib/streak").then((m) => m.recordStreakActivity()).catch(() => {});
  } catch { /* ignore */ }

  // ⚠️ "Rekor" ilk oyunda GÖSTERİLMEZ: kıyaslanacak bir şey yokken
  // "rekor kırdın!" demek anlamsız ve sonraki gerçek rekoru değersizleştirir.
  const rekor = daha && oncekiEnIyi !== null;
  const kalan = !rekor && oncekiEnIyi !== null && yon === "yuksek"
    ? Math.max(1, oncekiEnIyi - skor + 1)
    : null;
  return { rekor, oncekiEnIyi, kalan };
}

export function getOyunKaydi(oyunId: string): OyunKaydi | null {
  return oku()[oyunId] ?? null;
}

export function getTumKayitlar(): Kayit {
  return oku();
}

/** Oyun listesi bunu dinler — rekor değişince kartlar kendini tazeler. */
export function useOyunKayitlari(): Kayit {
  const [k, setK] = useState<Kayit>(() => oku());
  useEffect(() => {
    const h = () => setK(oku());
    window.addEventListener(OYUN_SONUC_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(OYUN_SONUC_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return k;
}

/** "3 gün önce" gibi — oyun listesinde son oynama. */
export function neZaman(ms: number): string {
  const g = Math.floor((Date.now() - ms) / 86_400_000);
  if (g <= 0) return "bugün";
  if (g === 1) return "dün";
  if (g < 7) return `${g} gün önce`;
  if (g < 30) return `${Math.floor(g / 7)} hafta önce`;
  return "uzun zaman önce";
}

/**
 * Oyun bitince sonucu BİR KEZ yazan kanca.
 *
 * ⚠️ SKOR REF'TEN OKUNUR: bağımlılığa konursa skor her değiştiğinde effect
 * yeniden çalışır ve oyun bitmeden önceki her skor kaydedilir. Yazma bayrağı
 * da şart — React 18'de effect iki kez çalışabiliyor, oynama sayacı şişerdi.
 */
export function useOyunSonu(
  oyunId: string,
  bitti: boolean,
  skor: number,
  opts?: { yon?: SkorYonu; birim?: string },
): SonucRaporu | null {
  const [rapor, setRapor] = useState<SonucRaporu | null>(null);
  const skorRef = useRef(skor); skorRef.current = skor;
  const optRef = useRef(opts); optRef.current = opts;
  const yazildi = useRef(false);

  useEffect(() => {
    if (!bitti) { yazildi.current = false; setRapor(null); return; }
    if (yazildi.current) return;
    yazildi.current = true;
    setRapor(oyunBitti(oyunId, skorRef.current, optRef.current));
  }, [bitti, oyunId]);

  return rapor;
}
