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
import { Volume2 } from "lucide-react";
import { EmojiView } from "@/components/EmojiView";
import { playItem } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { sikSayisiIcin } from "@/lib/zorluk";
import { baskaSekil } from "@/lib/sekilSoru";
import { letterNumOf } from "@/lib/confusables";
import {
  getAskMode, okunurAd, pickNameWrongs, adZorlugu, sikSayisi, yaziliSik, sameName,
  asiliGlif, sesliSik,
  getFlashMs, FLASH_CUE_MS, markGlifBekleniyor, markGlifGosterildi, clearGlifIzi,
  type AskMode,
} from "@/lib/askMode";
import { getGameItemLevel } from "@/lib/gameProgress";
import { glifKaydirmaEm } from "@/lib/glifOlcu";
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
  // SES ŞIKLARI: şıkta harf DE yazı DA yok — yalnız hoparlör. Çocuk dinleyip
  // ekrandaki glifle eşleştirir. Glif göstermek soruyu ele verirdi.
  if (sesliSik(mode)) {
    return (
      <span className={cn("flex items-center justify-center", className)} aria-label="Sesi dinle">
        <Volume2 className="h-2/3 w-2/3 min-h-6 min-w-6 max-h-14 max-w-14 text-primary" />
      </span>
    );
  }
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
  /** Hedef + çeldiriciler, karıştırılmış. Mod ve seviyeye göre seçilir. */
  secenekler: (pool: ContentItem[], target: ContentItem, klasikVarsayilan: number) => ContentItem[];
  /**
   * Şık seçimi ONAYLANDI mı? Ses Şıkları modunda ilk dokunuş yalnız
   * DİNLETİR (false döner), ikinci dokunuş seçer. Öteki modlarda hep true.
   * Oyunlar seçim işleyicisinin ilk satırına koyar: `if (!ask.onayla(o)) return;`
   */
  onayla: (item: ContentItem | null | undefined) => boolean;
  /**
   * "Tekrar dinle/göster" düğmesi anlamlı mı?
   *
   * ⚠️ Tabela / Ses Şıkları / Şekil Eşlemede tekrar çalınacak bir SES YOK —
   * sesi çalmak cevabı vermek olurdu. Düğmeyi yine de göstermek çocuğa
   * ÖLÜ bir düğme sunar; oyunlar bunu okuyup gizler.
   */
  tekrarVar: boolean;
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
   * şimşek/tabela modu KLASİĞE düşer.
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
   * Oyun SES ŞIKLARI gösterebiliyor mu?
   *
   * ⚠️ Aksiyon oyunlarında şıkkın kendisi engel/hedef (Kuş'ta harf çarpışma
   * alanı, Uzay'da vurulacak düşman). Oraya hoparlör koymak hem dinlemeye
   * vakit bırakmaz hem "iki dokunuş" kuralı işlemez. O oyunlarda Ses
   * Şıkları KLASİĞE düşer.
   */
  sesliDestek?: boolean;
  /**
   * Oyun ŞEKİL EŞLEME gösterebiliyor mu?
   *
   * ⚠️ Şekil Eşleme "ekrandaki şekil hangi HARF?" diye sorar; bu yüzden
   * tahtadaki şıkların hepsi FARKLI harf olmalı. Kutu Boşalt'ın tahtası
   * birkaç TÜRDEN çok sayıda kopya ile kuruluyor (aynı harfin değişik
   * harekeleri yan yana), yani soru orada tek cevaplı olmuyor → klasiğe düşer.
   */
  sekilDestek?: boolean;
}): AskLayer {
  // Mount anında dondur (yukarıdaki not).
  const [mode] = useState<AskMode>(() => {
    const m = getAskMode();
    if (opts?.yaziliDestek === false && yaziliSik(m)) return "klasik";
    // Ses Şıkları ve Şekil Eşleme ASILI GLİF ister; onu gösteremeyen oyun
    // (tabelayı desteklemeyen oyun) klasiğe düşer.
    if (opts?.yaziliDestek === false && (m === "sekil")) return "klasik";
    if (opts?.sesliDestek === false && m === "sesli") return "klasik";
    if (opts?.sekilDestek === false && m === "sekil") return "klasik";
    return m;
  });
  const [flashGlif, setFlashGlif] = useState<ContentItem | null>(null);
  const [flashCue, setFlashCue] = useState(false);
  // Süre oyuna girerken dondurulur (mod gibi).
  const [flashMs] = useState(() => getFlashMs());
  // Şimşek zamanlayıcıları AYRI tutulur: yeni şimşek eskisini iptal eder.
  /** Şekil Eşleme: bu soru için asılan alternatif şekil. */
  const sekilRef = useRef<{ glif: string; etiket: string } | null>(null);
  /**
   * Ses Şıkları: son DİNLENEN şık. İlk dokunuş dinletir, ikincisi seçer.
   * ⚠️ Tek dokunuşla seçtirmek çocuğa şıkları dinleme fırsatı bırakmıyordu;
   * ses şıkkı görünmez olduğu için "önce dinle, sonra seç" şart.
   */
  const sesOnayRef = useRef<{ id: string; at: number } | null>(null);
  const flashTimers = useRef<number[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => {
    flashTimers.current.forEach((t) => window.clearTimeout(t));
    timers.current.forEach((t) => window.clearTimeout(t));
    clearGlifIzi();   // oyundan çıkınca kalıntı iz taşınmasın
  }, []);

  /**
   * ŞİMŞEK: önce BAKIŞ İŞARETİ, sonra glif.
   *
   * ⚠️ İşaret şart. Glif oyun görüntüsünün ortasında ve çok kısa parlıyor;
   * çocuğun gözü o an başka yerdeyse (yolu izliyorsa) 300 ms'lik bir
   * gösterimi hiç göremez — 8 yaşında bakışı kaydırmak ~411 ms sürüyor,
   * üstelik 6 yaşındaki çocuk tek odaklı dikkat kullanıyor. Küçük halka
   * bakışı ÖNCEDEN yerine çeker; glif geldiğinde göz zaten oradadır.
   */
  const parlat = useCallback((item: ContentItem) => {
    // ⚠️ BEKLEYEN ŞİMŞEĞİ İPTAL ET. İki soru arka arkaya gelirse (hızlı
    // cevap, "tekrar göster"e üst üste basma) eski zamanlayıcı yenisinin
    // halkasını erken söndürüyor ya da glifini siliyordu.
    flashTimers.current.forEach((t) => window.clearTimeout(t));
    flashTimers.current = [];
    markGlifBekleniyor(item.id);   // kör cevap ayırıcı (bkz. askMode)
    setFlashCue(true);
    const t1 = window.setTimeout(() => {
      setFlashCue(false);
      markGlifGosterildi(item.id);
      setFlashGlif(item);
      const t2 = window.setTimeout(() => setFlashGlif(null), flashMs);
      flashTimers.current = [t2];
    }, FLASH_CUE_MS);
    flashTimers.current = [t1];
  }, [flashMs]);

  const sor = useCallback(async (item: ContentItem | null | undefined) => {
    if (!item) return;
    switch (mode) {
      case "flash":
        parlat(item);
        return;
      case "ustte":
      case "sesli":
        // Glif zaten tabelada asılı duruyor. SES ÇALINMAZ — sesi çalmak
        // harfin adını söylemek, yani cevabı vermek olurdu.
        return;
      case "sekil": {
        // Harfin BAŞKA bir hâli asılır; ses yine çalınmaz.
        const s2 = baskaSekil(item);
        sekilRef.current = s2;
        // ⚠️ Şekli olmayan öğe (harekeli hece, Ekstra kart) için soru
        // sorulamaz — sessiz kalmak yerine KLASİĞE düşülür, yoksa çocuk
        // boş bir tabelaya bakar.
        if (!s2) await playItem(item);
        return;
      }
      default:
        await playItem(item);
    }
  }, [mode, parlat]);

  const tekrar = useCallback((item: ContentItem | null | undefined) => {
    if (!item) return;
    if (mode === "flash") parlat(item);
    // Asılı glifli modlarda "tekrar dinle" harfin adını söylemek olurdu;
    // Şekil Eşlemede şekli olmayan öğe klasiğe düştüyse ses tekrar çalar.
    else if (mode === "sekil" && !sekilRef.current) void playItem(item);
    else if (!asiliGlif(mode)) void playItem(item);
  }, [mode, parlat]);

  const celdiriciler = useCallback((pool: ContentItem[], target: ContentItem, n: number) => {
    // ⚠️ ŞEKİL EŞLEMEDE ÇELDİRİCİLER BAŞKA HARF OLMALI. Soru "ﺘ hangi harf?"
    // — şıklar aynı harfin farklı harekeleri olursa (تِ / تُ) sorunun İKİ
    // doğru cevabı olur. Ölçüldü: Hızlı Quiz'de hedef 3. konudan (harekeler)
    // gelince çeldiriciler hep aynı harfin öbür harekeleriydi.
    if (mode === "sekil") {
      const hedefHarf = letterNumOf(target.id);
      const farkli = pickWrongs(pool, target, n * 4).filter(
        (c) => hedefHarf == null || letterNumOf(c.id) !== hedefHarf,
      );
      const out: ContentItem[] = [];
      for (const c of farkli) {
        if (out.length >= n) break;
        if (out.some((o) => letterNumOf(o.id) != null && letterNumOf(o.id) === letterNumOf(c.id))) continue;
        out.push(c);
      }
      // Aday yetmezse ŞIK AZ OLSUN — bozuk soru sorma (aynı ilke ad-tekillikte).
      return out;
    }
    if (!yaziliSik(mode)) return pickWrongs(pool, target, n);
    const z = adZorlugu(getGameItemLevel(target));
    const adlar = pickNameWrongs(pool, target, n, { zorluk: z });
    if (adlar.length >= n) return adlar;
    // ⚠️ YEDEK DE AD-TEKİL OLMALI. Eskiden doğrudan `pickWrongs`e düşüyordu;
    // o ada bakmadığı için sorunun İKİ doğru cevabı olabiliyordu (ثَ ile سَ
    // ikisi de "se"). Havuz yetmiyorsa ŞIK AZ OLSUN — bozuk soru sorma.
    // (Aynı ilke `distractorKey` için de geçerli, bkz. CLAUDE.md.)
    const out = [...adlar];
    for (const c of pickWrongs(pool, target, n * 3)) {
      if (out.length >= n) break;
      if (c.id === target.id || sameName(c, target)) continue;
      if (out.some((o) => o.id === c.id || sameName(o, c))) continue;
      out.push(c);
    }
    return out;
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

  const secenekler = useCallback((pool: ContentItem[], target: ContentItem, k: number) => {
    // Şık sayısı iki filtreden geçer:
    //  1) SORU YÖNTEMİ — şimşek 2, tabela 3, klasik oyunun istediği kadar
    //  2) ZORLUK — Kolay 2, Orta 3, Zor 4
    // ⚠️ (2) ÖLÇÜM BÖLGESİNİ KORUR: `sikSayisiIcin` az şıkkı yalnız L1-L2
    // harflerde verir. L3+ "biliyor sayıldı" demek ve L3→L4→L5 kararı orada
    // veriliyor; orada şık azaltmak yalan ustalık üretirdi.
    const n = sikSayisiIcin(getGameItemLevel(target), sikSayisi(mode, k));
    return shuffle([target, ...celdiriciler(pool, target, Math.max(0, n - 1))]);
  }, [mode, celdiriciler]);

  const katman = (
    <>
      {/* ŞİMŞEK — görme araştırmasına göre: GLİFİN KENDİSİ SAYDAM DEĞİL,
          altındaki plaka saydam (harf tanıma parlaklık karşıtlığına bağlı;
          saydam harf = düşük karşıtlık = zor okunur). Oyun plakanın
          çevresinde görünmeye devam eder. */}
      {/* BAKIŞ İŞARETİ — glif gelmeden önce yanar, gözü yerine çeker. */}
      {flashCue && (
        <div className={cn("pointer-events-none fixed inset-x-0 z-50 flex justify-center", "top-1/2 -translate-y-1/2")}>
          <div className="h-10 w-10 animate-ping rounded-full border-4 border-primary/80" />
        </div>
      )}
      {flashGlif && (
        <div className={cn("pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4", "top-1/2 -translate-y-1/2")}>
          {/* ⚠️ GLİF KIRPILMAMALI: `leading-[1.35]` ile ج ح خ tabanın altına,
              kesreli harfler yuvarlağın dışına taşıyordu (kullanıcı gördü).
              Arapça glif taban çizgisinin altına ve üstüne taşar → 1.7.
              ⚠️ KONUM: oyun görüntüsünün ORTASI (kullanıcı isteği). Kenarda
              belirirse çocuk 300 ms'lik gösterimi göremiyor — bakışı
              kaydırmak 8 yaşında ~411 ms.
              ⚠️ SİYAH ÇERÇEVE: şıkların etrafındaki gibi ince koyu çizgi. */}
          <div className="animate-pop rounded-[2rem] border-2 border-foreground/75 bg-white/85 px-7 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
            <div
              className="block font-arabic text-emerald-950"
              style={{
                fontSize: opts?.flashBoy ?? "min(5.5rem, 22vw)",
                lineHeight: 1.7,
                // ⚠️ MÜREKKEBİ ORTALA: line-height satır kutusunu büyütür ama
                // glifi ortalamaz — ج ح خ çanağı plakanın altından sarkıyordu
                // (kullanıcı gördü). Kaydırma glif başına ÖLÇÜLÜR.
                transform: `translateY(${glifKaydirmaEm(flashGlif.emoji ?? "").toFixed(4)}em)`,
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
    if (!asiliGlif(mode) || !item) return null;
    // ⚠️ ŞEKİL EŞLEMEDE ASILAN GLİF HEDEFİN KENDİSİ DEĞİL: harfin başka bir
    // yazılış hâli asılır ("ـبـ hangi harf?"). Şekli olmayan öğede
    // (harekeli hece, Ekstra) `baskaSekil` null döner ve soru klasiğe düşer
    // — o zaman asılacak bir şey de yoktur.
    const asilan = mode === "sekil" ? sekilRef.current?.glif : item.emoji;
    if (!asilan) return null;
    const etiket = mode === "sekil" ? sekilRef.current?.etiket : undefined;
    return (
      <div className={cn("mb-3 flex flex-col items-center justify-center gap-1", opts?.className)}>
        {/* Siyah ince çerçeve (kullanıcı isteği): şıkların etrafındaki gibi. */}
        <div className="overflow-visible rounded-3xl border-2 border-foreground/75 bg-card px-8 py-2 shadow-card">
          <span
            className={cn("block font-arabic text-primary", opts?.boy ?? "text-[4.5rem]")}
            style={{
              lineHeight: 1.7,
              // Mürekkep ortalama — bkz. glifOlcu.ts (ج ح خ sarkıyordu).
              transform: `translateY(${glifKaydirmaEm(item.emoji ?? "").toFixed(4)}em)`,
            }}
            dir="rtl"
          >
            {asilan}
          </span>
        </div>
        {etiket && (
          <span className="text-[11px] font-extrabold text-muted-foreground">
            ({etiket} hâli)
          </span>
        )}
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
  /**
   * SES ŞIKLARINDA İKİ DOKUNUŞ: birincisi DİNLETİR, ikincisi SEÇER.
   *
   * ⚠️ Tek dokunuşla seçtirmek şıkları dinleme fırsatı bırakmıyordu — şık
   * görünmez (yalnız hoparlör), dinlemeden seçmek kör atıştır. Öteki
   * modlarda hep true döner, oyunlar tek satırla korunur.
   * `hedefTekrar` süresi geçince onay sıfırlanır (çocuk başka şıkka geçti).
   */
  const onayla = useCallback((item: ContentItem | null | undefined) => {
    if (!item) return false;
    if (!sesliSik(mode)) return true;
    const s = sesOnayRef.current;
    if (s && s.id === item.id && Date.now() - s.at < 10_000) {
      sesOnayRef.current = null;
      return true;
    }
    sesOnayRef.current = { id: item.id, at: Date.now() };
    void playItem(item);
    return false;
  }, [mode]);

  const cevapSesi = useCallback(async (item: ContentItem | null | undefined, dogru: boolean) => {
    // ⚠️ Şekil Eşlemede de çalar: soru görsel sorulduğu için çocuk harfin
    // sesini hiç duymadan doğru yapabiliyor. Ses Şıklarında zaten dinledi.
    if (!item || !dogru || (!yaziliSik(mode) && mode !== "sekil")) return;
    // ⚠️ SÖZ, SES BİTİNCE ÇÖZÜLÜR. Önce "çal ve unut" idi; oyun kendi
    // zamanlayıcısıyla sıradaki soruya geçtiği için kayıt devam ederken yeni
    // soru ekrana geliyordu (kullanıcı: "ses devam ederken yeni soru
    // gözüküyor"). Çağıran oyun bunu `await` ederek geçişi geciktirir.
    await new Promise<void>((r) => {
      const t = window.setTimeout(() => {
        timers.current = timers.current.filter((x) => x !== t);
        r();
      }, 220);
      timers.current.push(t);
    });
    await playItem(item);
  }, [mode]);

  return {
    mode,
    yazili: yaziliSik(mode),
    sik: (item: ContentItem, className?: string) => sikIcerik(item, mode, className),
    secenekler,
    celdiriciler,
    ayriAdlar,
    sor,
    tekrar,
    tekrarEtiketi: mode === "flash" ? "Harfi tekrar göster" : "Tekrar dinle",
    tekrarVar: !asiliGlif(mode) || mode === "flash",
    onayla,
    katman,
    tabela,
    cevapSesi,
  };
}
