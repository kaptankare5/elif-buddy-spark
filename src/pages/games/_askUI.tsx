// OYUNLARDA SORU SORMA YÖNTEMİ — 2B (DOM) oyunlar için ortak katman.
//
// 3B oyunlar (Yarışı/Partisi/Koşusu) glifi three.js dokusuyla çizdiği için
// kendi çizimini yapar; buradaki bileşenler DOM oyunları içindir. Ama İKİSİ
// DE aynı sözleşmeyi kullanır (`src/lib/askMode.ts`): mod, şık sayısı,
// yazılı ad çeldiricisi ve kademeli zorluk tek yerde tanımlı.
//
// ⚠️ MOD OYUNA GİRERKEN DONDURULUR. Ayarlar'dan değişirse oyunun ortasında
// şıkların anlamı değişmesin diye mount anında bir kez okunur; çocuk oyundan
// çıkıp girince yeni mod geçerli olur.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EmojiView } from "@/components/EmojiView";
import { playItem } from "@/lib/audio";
import { cn } from "@/lib/utils";
import {
  getAskMode, okunurAd, pickNameWrongs, adZorlugu, sikSayisi, yaziliSik, sameName,
  FLASH_MS, type AskMode,
} from "@/lib/askMode";
import { getGameItemLevel } from "@/lib/gameProgress";
import { pickWrongs, shuffle } from "./_shared";
import type { ContentItem } from "@/data/types";

/**
 * Şıkta ne yazacak: yazılı modda harfin adı, yoksa glifin kendisi.
 *
 * ⚠️ BİLEŞEN DEĞİL, düz bir çizim fonksiyonu (küçük harfle başlar). Bu dosya
 * hook dışa veriyor; aynı dosyada PascalCase bir bileşen tanımlamak Fast
 * Refresh'i bozuyor (react-refresh/only-export-components). Hook'un kendisi
 * zaten JSX döndürdüğü için ayrı bir bileşene gerek yok.
 */
function sikIcerik(item: ContentItem, mode: AskMode, className?: string): ReactNode {
  if (yaziliSik(mode)) {
    const ad = okunurAd(item);
    // Ad yoksa glife düş — sorunun cevapsız kalmasındansa glif göstermek iyi.
    if (ad) {
      return (
        <span className={cn("px-1 text-center font-extrabold leading-tight tracking-tight", className)}>
          {ad}
        </span>
      );
    }
  }
  return <EmojiView value={item.emoji} />;
}

interface AskLayer {
  mode: AskMode;
  /** Şıklar yazılı ad mı gösteriyor? (kutu boyutlarını büyütmek için) */
  yazili: boolean;
  /** Bir şıkkın içeriği: yazılı modda ad, klasikte glif. */
  sik: (item: ContentItem, className?: string) => ReactNode;
  /** Bu modda kaç şık olmalı? */
  sikAdedi: (klasikVarsayilan: number) => number;
  /** Hedef + çeldiriciler, karıştırılmış. Mod ve seviyeye göre seçilir. */
  secenekler: (pool: ContentItem[], target: ContentItem, klasikVarsayilan: number) => ContentItem[];
  /** Yalnız çeldiriciler (hedefi kendi ekleyen oyunlar için). */
  celdiriciler: (pool: ContentItem[], target: ContentItem, n: number) => ContentItem[];
  /**
   * Tahtayı kendi kuran oyunlar için: aday listesinden, yazılı modda AYNI
   * ADI taşıyanları eleyerek en fazla n öğe seçer (bkz. `sameName`).
   */
  ayriAdlar: (adaylar: ContentItem[], n: number) => ContentItem[];
  /** Soruyu modun yöntemiyle sorar. Öğret modunda önce tanıtır. */
  sor: (item: ContentItem | null | undefined) => Promise<void>;
  /** "Tekrar" düğmesi: klasikte sesi çalar, şimşekte glifi tekrar gösterir. */
  tekrar: (item: ContentItem | null | undefined) => void;
  /** Tekrar düğmesinin etiketi (mod başına değişir). */
  tekrarEtiketi: string;
  /** Ekran üstü katmanlar (şimşek parlaması + öğretme kartı). Oyun render eder. */
  katman: ReactNode;
  /** "Tabela" modunda sahnenin üstüne asılan glif. Diğer modlarda null. */
  tabela: (item: ContentItem | null | undefined, opts?: { className?: string; boy?: string }) => ReactNode;
  /**
   * Yazılı modlarda DOĞRU cevaptan sonra harfin gerçek kaydını çalar.
   * Dönen söz SES BİTİNCE çözülür — oyun sıradaki soruyu ondan sonra
   * göstermeli, yoksa kayıt yarıda kalıp çocuk harfi duymuyor.
   */
  cevapSesi: (item: ContentItem | null | undefined, dogru: boolean) => Promise<void>;
}

/**
 * ⚠️ Yazılı modlarda çeldirici sayısı hedefin SEVİYESİNE göre incelir
 * (`adZorlugu`): yeni harfte uzak ad, öğrenilmiş harfte en yakın ad.
 * Kullanıcının "bear/giraffe → bear/beal" fikri; sahte ad uydurmadan,
 * gerçek harf adları arasından.
 */
export function useAskLayer(opts?: {
  /**
   * Oyun YAZILI şık gösterebiliyor mu?
   *
   * ⚠️ Bazı oyunlarda şıklar geometriye gömülü: Yılan'da harf bir ızgara
   * karesinin içinde, Kuş'ta harfin kendisi ÇARPIŞMA ALANI. Oraya "Be
   * (başta)" yazmak ya taşar ya oyunun zorluğunu değiştirir. Bu oyunlarda
   * şimşek/tabela modu KLASİĞE düşer — ama "Öğret" modu çalışmaya devam
   * eder, çünkü o bir ekran katmanıdır, şıkların biçimine dokunmaz.
   */
  yaziliDestek?: boolean;
  /**
   * Şimşek glifinin punto sınırı (CSS boyut ifadesi).
   *
   * ⚠️ Oyun alanı KÜÇÜK olan sahnelerde (Macera'nın 16/10 şeridi, Uçan Kuş)
   * varsayılan boy soruyu devasa yapıp oyunu kapatıyordu — kullanıcı
   * "sorular çok büyük" dedi. Geniş alanlı oyunlar (Quiz) varsayılanı
   * kullanır.
   */
  flashBoy?: string;
  /**
   * Şimşek plakasının dikey konumu (Tailwind `top-` sınıfı).
   *
   * ⚠️ Varsayılan `top-[20%]` bazı oyunlarda OYUN ALANININ TAM ORTASINA
   * denk geliyor: Yılan'da harf doğrudan yılanın üstünde beliriyordu
   * (kullanıcı: "oyun için iyi değil"). Oyun alanı ekranın üst yarısındaysa
   * plakayı başlığın hizasına çek.
   */
  flashYer?: string;
}): AskLayer {
  // Mount anında dondur (yukarıdaki not).
  const [mode] = useState<AskMode>(() => {
    const m = getAskMode();
    if (opts?.yaziliDestek === false && yaziliSik(m)) return "klasik";
    return m;
  });
  const [flashGlif, setFlashGlif] = useState<ContentItem | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const parlat = useCallback((item: ContentItem) => {
    setFlashGlif(item);
    timers.current.push(window.setTimeout(
      () => setFlashGlif((x) => (x?.id === item.id ? null : x)), FLASH_MS,
    ));
  }, []);

  const sor = useCallback(async (item: ContentItem | null | undefined) => {
    if (!item) return;
    switch (mode) {
      case "flash":
        parlat(item);
        return;
      case "ustte":
        // Glif zaten tabelada asılı duruyor. SES ÇALINMAZ — sesi çalmak
        // harfin adını söylemek, yani cevabı vermek olurdu.
        return;
      default:
        await playItem(item);
    }
  }, [mode, parlat]);

  const tekrar = useCallback((item: ContentItem | null | undefined) => {
    if (!item) return;
    if (mode === "flash") parlat(item);
    else if (mode !== "ustte") void playItem(item);
  }, [mode, parlat]);

  const celdiriciler = useCallback((pool: ContentItem[], target: ContentItem, n: number) => {
    if (!yaziliSik(mode)) return pickWrongs(pool, target, n);
    const z = adZorlugu(getGameItemLevel(target));
    const adlar = pickNameWrongs(pool, target, n, { zorluk: z });
    // Ad bulunamazsa (translit'i olmayan öğe) klasik çeldiriciye düş —
    // soru şıksız kalmasın.
    return adlar.length >= n ? adlar : pickWrongs(pool, target, n);
  }, [mode]);

  const ayriAdlar = useCallback((adaylar: ContentItem[], n: number) => {
    if (!yaziliSik(mode)) return adaylar.slice(0, n);
    const out: ContentItem[] = [];
    for (const c of adaylar) {
      if (out.length >= n) break;
      if (out.some((o) => o.id === c.id || sameName(o, c))) continue;
      out.push(c);
    }
    return out;
  }, [mode]);

  const sikAdedi = useCallback(
    (klasikVarsayilan: number) => sikSayisi(mode, klasikVarsayilan), [mode],
  );

  const secenekler = useCallback((pool: ContentItem[], target: ContentItem, k: number) => {
    const n = sikSayisi(mode, k);
    return shuffle([target, ...celdiriciler(pool, target, Math.max(0, n - 1))]);
  }, [mode, celdiriciler]);

  const katman = (
    <>
      {/* ŞİMŞEK — görme araştırmasına göre: GLİFİN KENDİSİ SAYDAM DEĞİL,
          altındaki plaka saydam (harf tanıma parlaklık karşıtlığına bağlı;
          saydam harf = düşük karşıtlık = zor okunur). Oyun plakanın
          çevresinde görünmeye devam eder. */}
      {flashGlif && (
        <div className={cn("pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4", opts?.flashYer ?? "top-[20%]")}>
          {/* ⚠️ GLİF KIRPILMAMALI: `leading-[1.35]` ile ج ح خ tabanın altına,
              kesreli harfler yuvarlağın dışına taşıyordu (kullanıcı gördü).
              Arapça glif taban çizgisinin altına ve üstüne taşar → 1.7.
              ⚠️ BOYUT EKRANA GÖRE SINIRLI: sabit 7rem, Macera gibi küçük
              oyun alanlı sahnelerde soruyu devasa yapıp oyunu kapatıyordu.
              `min(...)` ile dar ekranda kendiliğinden küçülür.
              ⚠️ SİYAH ÇERÇEVE (kullanıcı isteği): şıkların etrafındaki gibi
              ince koyu bir çizgi — plaka arka planla karışmasın. */}
          <div className="rounded-[2rem] border-2 border-foreground/75 bg-white/80 px-7 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
            <div
              className="block font-arabic text-emerald-950"
              style={{
                fontSize: opts?.flashBoy ?? "min(5.5rem, 22vw)",
                lineHeight: 1.7,
                // Beyaz hâle: harf hem açık hem koyu zeminde okunsun.
                textShadow: "0 0 10px rgba(255,255,255,0.95), 0 0 3px rgba(255,255,255,1)",
              }}
              dir="rtl"
            >
              {flashGlif.emoji}
            </div>
          </div>
        </div>
      )}
    </>
  );

  /**
   * "Tabela" modunda ekranda ASILI duran glif.
   *
   * ⚠️ GLİF KIRPILMAMALI. İlk sürümde `leading-[1.35]` + dar `py` vardı ve
   * Be'nin ALTTAKİ NOKTASI kutunun dışında kalıyordu (kullanıcı yakaladı).
   * Arapça glifler taban çizgisinin altına ve üstüne taşar: hareke yukarı,
   * nokta aşağı. `leading` 1.35'te satır kutusu glif kutusundan küçük
   * kalıyor. Bu yüzden `leading-[1.7]` + dikey pay + `overflow-visible`.
   */
  const tabela = useCallback((
    item: ContentItem | null | undefined,
    opts?: { className?: string; boy?: string },
  ) => {
    if (mode !== "ustte" || !item) return null;
    return (
      <div className={cn("mb-3 flex justify-center", opts?.className)}>
        {/* Siyah ince çerçeve (kullanıcı isteği): şıkların etrafındaki gibi. */}
        <div className="overflow-visible rounded-3xl border-2 border-foreground/75 bg-card px-8 py-2 shadow-card">
          <span
            className={cn("block font-arabic text-primary", opts?.boy ?? "text-[4.5rem]")}
            style={{ lineHeight: 1.7 }}
            dir="rtl"
          >
            {item.emoji}
          </span>
        </div>
      </div>
    );
  }, [mode]);

  /**
   * DOĞRU CEVAPTAN SONRA HARFİN SESİ.
   *
   * ⚠️ Kullanıcı şartı: yazılı modlarda şıklar LATİN harfle yazılı. Çocuk
   * "Dad" yazısını seçip doğru yapsa bile harfin nasıl OKUNDUĞUNU hiç
   * duymuyorsa yarım öğreniyor. Doğru cevapta gerçek hoca kaydı çalar —
   * yazı ile ses burada birleşir. (Klasik modda gerek yok: soru zaten
   * sesle soruldu.)
   */
  const cevapSesi = useCallback(async (item: ContentItem | null | undefined, dogru: boolean) => {
    if (!item || !dogru || !yaziliSik(mode)) return;
    // ⚠️ SÖZ, SES BİTİNCE ÇÖZÜLÜR. Önce "çal ve unut" idi; oyun kendi
    // zamanlayıcısıyla sıradaki soruya geçtiği için kayıt devam ederken yeni
    // soru ekrana geliyordu (kullanıcı: "ses devam ederken yeni soru
    // gözüküyor"). Çağıran oyun bunu `await` ederek geçişi geciktirir.
    await new Promise<void>((r) => { timers.current.push(window.setTimeout(r, 220)); });
    await playItem(item);
  }, [mode]);

  return {
    mode,
    yazili: yaziliSik(mode),
    sik: (item: ContentItem, className?: string) => sikIcerik(item, mode, className),
    sikAdedi,
    secenekler,
    celdiriciler,
    ayriAdlar,
    sor,
    tekrar,
    tekrarEtiketi: mode === "flash" ? "Harfi tekrar göster" : "Tekrar dinle",
    katman,
    tabela,
    cevapSesi,
  };
}
