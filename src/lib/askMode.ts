// OYUNLARDA SORU SORMA YÖNTEMİ — deneysel modlar (kullanıcı fikri).
//
// Klasik yöntem TERS YÖNDE ölçüyor: sesi duy → şekli seç. Oysa hedef beceri
// üretimdir: harfi GÖR → adını söyle (Elifbâ kitabının ve Kur'an okumanın
// istediği yön). Yeni modlar soruyu bu yöne çeviriyor: GLİF gösterilir,
// şıklar harfin ADIDIR (yazılı).
//
// ⚠️ ESKİ MOD SİLİNMEDİ. Ayarlar'dan geçiş yapılır, beğenilmezse geri dönülür.
//
// ⚠️ OKUMA ŞARTI: yazılı şıklar çocuğun LATİN harflerini okuyabilmesini
// gerektirir. 5-6 yaşındaki bir çocuk Türkçe okuyamıyorsa bu modlar onun için
// çalışmaz — bu yüzden varsayılan hâlâ "klasik". Deneyip karar vermek için var.
import { useEffect, useState } from "react";
import type { ContentItem } from "@/data/types";

export type AskMode =
  /** Ses çalar → glif şıklarından seç. (Eski/varsayılan) */
  | "klasik"
  /** Glif 1 sn yarı saydam parlar sönür → yazılı ad şıklarından seç. */
  | "flash"
  /** Glif kapının üstünde ASILI durur → yazılı ad şıklarından seç. */
  | "ustte"
  /**
   * ÖĞRET — önce SÖYLER, sonra sorar.
   *
   * ⚠️ Kullanıcının teşhisi: "oyun düzgün öğretmiyor". Haklı — klasik modda
   * oyun harfi hiç TANITMAZ, yalnız yoklar. Çocuk bilmediği harfte tahmin
   * eder, yanlış yapar, bir daha tahmin eder; hiçbir noktada "bu harf Be"
   * denmez. Bu modda her sorudan önce harf BÜYÜK gösterilir, adı yazılır ve
   * sesi çalınır; hemen ardından aynı harf sorulur. Yani her karşılaşma bir
   * öğretme + bir yoklama. (Yarış/parti oyunlarında bu bir "öğretme kapısı":
   * tek büyük harf, yanlış şık yok, içinden geçerken adını söyler.)
   */
  | "ogret";

const KEY = "elifba-ask-mode-v1";
export const ASK_MODE_EVENT = "elifba-ask-mode-updated";

export const ASK_MODES: Array<{ id: AskMode; ad: string; aciklama: string }> = [
  { id: "klasik", ad: "Klasik", aciklama: "Sesi duy → harfi seç (mevcut)" },
  { id: "flash", ad: "Şimşek", aciklama: "Harf 1 sn parlar → adını seç" },
  { id: "ustte", ad: "Tabela", aciklama: "Harf ekranda asılı → adını seç" },
  { id: "ogret", ad: "Öğret", aciklama: "Önce harfi gösterip söyler, sonra sorar" },
];

const GECERLI = new Set<string>(ASK_MODES.map((m) => m.id));

/** Şimşek modunda şık sayısı. */
export const FLASH_SIK = 2;
/** Tabela modunda şık sayısı (glif ekranda durduğu için okumaya vakit var). */
export const USTTE_SIK = 3;
/**
 * Glifin ekranda parladığı süre (ms).
 *
 * ⚠️ SÜRE DARBOĞAZ DEĞİL: Sperling'in ölçümünde 50 ms'lik bir gösterim
 * 9-12 harfi erişilebilir kılıyor (ikonik bellek ~250-500 ms tutuyor). Tek
 * bir glif için 1 saniye zaten fazlasıyla yeterli. Darboğaz ENCODING değil
 * DİKKAT: çocuk direksiyondayken önce parlamayı fark etmeli, bakışını
 * kaydırmalı, sonra okumalı. Bakış kaydırmanın kendisi ~200-300 ms.
 * Bu yüzden 1100 yerine 1300: fazladan süre okumak için değil, BAKIŞI
 * ÇEVİRMEK için.
 */
export const FLASH_MS = 1300;
/**
 * "Öğret" modunda tanıtım kartının ekranda kaldığı süre (ms).
 *
 * Şimşek'ten uzun, çünkü burada amaç TERSİ: harf kaybolmadan önce çocuğun
 * onu adıyla birlikte kodlaması isteniyor. Ses (~0.8 sn) bittikten sonra
 * harfe bakacak zaman kalmalı.
 */
export const OGRET_MS = 1900;

/** Şıklar YAZILI ad mı gösterecek (glif yerine)? */
export function yaziliSik(m: AskMode): boolean {
  return m === "flash" || m === "ustte";
}

/** Bu modda kaç şık olmalı? `klasikVarsayilan` oyunun kendi sayısıdır. */
export function sikSayisi(m: AskMode, klasikVarsayilan: number): number {
  if (m === "flash") return FLASH_SIK;
  if (m === "ustte") return USTTE_SIK;
  return klasikVarsayilan;
}

export function getAskMode(): AskMode {
  if (typeof window === "undefined") return "klasik";
  try {
    const v = localStorage.getItem(KEY);
    return v && GECERLI.has(v) ? (v as AskMode) : "klasik";
  } catch { return "klasik"; }
}

export function setAskMode(m: AskMode) {
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(ASK_MODE_EVENT)); } catch { /* ignore */ }
}

export function useAskMode(): [AskMode, (m: AskMode) => void] {
  const [m, setM] = useState<AskMode>(() => getAskMode());
  useEffect(() => {
    const h = () => setM(getAskMode());
    window.addEventListener(ASK_MODE_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(ASK_MODE_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [m, (v: AskMode) => { setAskMode(v); setM(v); }];
}

/**
 * "AZ ÖNCE ÖĞRETİLDİ" İŞARETİ — hızlı geçişi kapatmak için.
 *
 * ⚠️ srs.ts'te HIZLI GEÇİŞ var: harfle İLK KEZ karşılaşıp doğru bilen çocuk
 * doğrudan L3'e çıkar ("öğrenmedi, zaten biliyormuş" sayılır). "Öğret"
 * modunda bu kural YANLIŞ tetikleniyordu: cevabı çocuğa 2 saniye önce biz
 * gösterdik — doğru bilmesi "zaten biliyordu" demek değil, "kopyaladı"
 * demek. Aynı gerekçeyle oyunlarda ilk karşılaşmada ipucu halkası da
 * yanmıyor (`gameProgress.showHintFor`); tanıtım kartı ondan çok daha
 * güçlü bir ipucudur.
 *
 * Tek kullanımlık: tanıtım yapılınca işaretlenir, o harfin cevabı
 * kaydedilirken okunup SİLİNİR.
 */
let _ogretilen: string | null = null;

/** Tanıtım kartı/kapısı gösterildi — bu harfin sıradaki cevabı "kopya"dır. */
export function markOgretildi(id: string) { _ogretilen = id; }

/** Bu harf az önce öğretildi mi? Okuyunca işaret silinir. */
export function ogretildiMi(id: string): boolean {
  if (_ogretilen !== id) return false;
  _ogretilen = null;
  return true;
}

/** Şıkta yazacak ad. Yoksa null → o öğe yeni modda sorulamaz. */
export function okunurAd(it: ContentItem): string | null {
  const s = (it.translit || "").trim();
  return s.length > 0 ? s : null;
}

/**
 * AYNI YAZILI ADI TAŞIYAN İKİ ÖĞE BİR ARADA GÖSTERİLEMEZ.
 *
 * ⚠️ `sameSound`un yazılı moddaki karşılığı. Havuzda 443 addan 113'ü
 * ÇAKIŞIYOR: ثَ ile سَ ikisi de "se", ذِ ile زِ ikisi de "zi" okunur.
 * Şıklar yazılı adken ikisi birden ekrana gelirse sorunun İKİ doğru cevabı
 * olur; çocuk doğru okuyup yanlış olana dokunur ve yanlış sayılır.
 * `pickNameWrongs` bunu zaten eliyor, ama tahtayı kendi kuran oyunlar
 * (Uçan Kuş, Kutu Boşalt) bu kontrolü ayrıca yapmalı.
 */
export function sameName(a: ContentItem, b: ContentItem): boolean {
  const x = okunurAd(a), y = okunurAd(b);
  return !!x && !!y && x.toLocaleLowerCase("tr") === y.toLocaleLowerCase("tr");
}

/** Levenshtein — ad benzerliği için. */
function mesafe(a: string, b: string): number {
  const x = a.toLocaleLowerCase("tr"), y = b.toLocaleLowerCase("tr");
  const dp = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[x.length][y.length];
}

/**
 * YAZILI ŞIK ÇELDİRİCİLERİ — adı hedefe EN BENZEYEN öğelerden seçilir.
 *
 * ⚠️ Kullanıcının yakaladığı açık: şıklar "Be" ve "Zanahoria" gibi çok farklıysa
 * çocuk kelimeyi OKUMADAN, ilk harfe bakıp seçer — kısayol öğrenir, harfi
 * öğrenmez. Çözüm, adı hedefe benzeyen çeldirici koymak: "Sin" ↔ "Şin",
 * "Sad" ↔ "Dad", "Te" ↔ "Tı", "Ha" ↔ "Hı", "Kef" ↔ "Kaf". O zaman çocuk
 * kelimenin TAMAMINI okumak zorunda kalır.
 *
 * ⚠️ UYDURMA AD KULLANILMAZ. Kullanıcının örneğinde ("bear" için sahte "beal")
 * mantık aynı, ama harf adlarında sahte bir ad göstermek çocuğa YANLIŞ AD
 * öğretme riski taşır. Gerçek harf adları arasında zaten yeterince benzer
 * çiftler var — uydurmaya gerek yok.
 *
 * ⚠️ KADEMELİ ZORLUK (`zorluk` 0..1) — kullanıcının "bear/giraffe → bear/beal"
 * fikri. Harfi yeni gören çocuğa en benzer adı vermek onu boğar; zaten
 * bileni UZAK adla sınamak da hiçbir şey ölçmez. `zorluk` sıralamada hangi
 * pencereden seçileceğini belirler: 0 = en UZAK adlar (yeni harf),
 * 1 = en YAKIN adlar (öğrenilmiş harf). Böylece aynı harf tekrar geldikçe
 * ayrım kendiliğinden incelir.
 */
export function pickNameWrongs(
  pool: ContentItem[],
  target: ContentItem,
  n: number,
  opts?: { zorluk?: number },
): ContentItem[] {
  const hedefAd = okunurAd(target);
  if (!hedefAd) return [];
  const adaylar = pool
    .filter((i) => i.id !== target.id)
    .map((i) => ({ it: i, ad: okunurAd(i) }))
    .filter((x): x is { it: ContentItem; ad: string } => !!x.ad && x.ad !== hedefAd);
  // Aynı adı taşıyan başka öğe olmasın (Fe'nin başta/ortada hâlleri gibi) —
  // yoksa sorunun iki doğru cevabı olur.
  const gorulen = new Set<string>([hedefAd]);
  const benzersiz = adaylar.filter((x) => {
    if (gorulen.has(x.ad)) return false;
    gorulen.add(x.ad);
    return true;
  });
  benzersiz.sort((a, b) => mesafe(a.ad, hedefAd) - mesafe(b.ad, hedefAd));
  // Pencere: zorluk 1 → başa (en benzer), 0 → sona (en farklı) kayar.
  const z = Math.min(1, Math.max(0, opts?.zorluk ?? 1));
  const pencere = Math.max(n, 6);
  const enGeri = Math.max(0, benzersiz.length - pencere);
  const bas = Math.round((1 - z) * enGeri);
  // Pencere içinden rastgele n tane — hep aynı çift çıkmasın.
  const havuz = benzersiz.slice(bas, bas + pencere);
  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [havuz[i], havuz[j]] = [havuz[j], havuz[i]];
  }
  return havuz.slice(0, n).map((x) => x.it);
}

/**
 * SRS seviyesinden çeldirici zorluğu. Yeni harfte uzak ad (çocuk önce
 * "hangisi olabilir"i öğrensin), öğrenilmiş harfte en yakın ad (artık
 * gerçekten ayırt etsin).
 */
export function adZorlugu(level: number): number {
  if (level <= 2) return 0.15;
  if (level === 3) return 0.55;
  return 1;
}
