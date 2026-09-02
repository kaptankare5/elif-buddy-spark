// 🧽 KUYRUK ATÖLYESİ — "kuyruğu sil, başta hâli çıksın" dersinin oyunlaşmış hâli.
//
// Kullanıcı isteği: "cıvıl cıvıl renkli, çocuklara göre güzel animasyonlu bir
// oyun benzeri bir şey… harflerin gözleri olsun, kuyruklarını süngerle silelim,
// yine aynı harf olduğunu belirtelim… harfler rengarenk olsun".
//
// ⚠️ BU BİR DERS, ÖLÇÜM DEĞİL — HİÇBİR ŞEYE ETKİ ETMEZ (kullanıcı şartı: "bu
// bölüm başka şeylere etki etmesin, harflerin seviye tekrar sistemine etki
// etmesin"). Burada SRS'e, karışıklık ısısına, oyun ilerlemesine, günlük
// seriye YAZAN TEK BİR ÇAĞRI YOKTUR: `recordSrsAnswer`, `recordGameAnswer`,
// `oyunBitti`, `setYildiz`, `recordConfusionPick` — hiçbiri kullanılmaz.
// Yalnız ses (juice/sfx) ve yerel bileşen durumu vardır.
// Bekçi: `src/test/kuyrukAtolyesi.test.ts`.
//
// TASARIM KARARLARI
// · GÖZLER BAŞA TAKILIR, kuyruğa değil (`headBox`): kuyruk silinince gözler
//   kaybolmamalı — "harf hâlâ orada, yalnız kuyruğu gitti" mesajının görsel
//   taşıyıcısı gözlerdir. Gözler süngeri TAKİP EDER (bakış yönü), silme
//   bitince sevinir (yay gibi kısılır).
// · RENK harften gelir (`data/harfRenkleri.ts`) — Elif sarı, Be pembe…
// · SÜNGER parmağı izler, köpük baloncukları saçar; dokunulmayınca "beni
//   sürükle" diye hafifçe sallanır (çocuk ne yapacağını okumadan anlasın).
// · BAŞ SİLİNEMEZ: fırça izi kuyruk maskesiyle kesiştirilir. Çocuk başı
//   ovalarsa hiçbir şey gitmez ve "orası kalacak!" uyarısı çıkar.
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TailRule } from "@/data/writingMnemonics";
import { buildTailMask, drawCentered, inkBox, inkFlags, measureGlyph, tailFontSpec, type TailMask, type TailMaskGeom } from "@/lib/tailMask";
import { yuzYeri, type Yuz } from "@/lib/harfYuzu";
import { EmojiView } from "@/components/EmojiView";
import { harfRengi, acikTon, kuyrukRengi } from "@/data/harfRenkleri";
import { sfx } from "@/lib/juice";
import { playItem } from "@/lib/audio";
import { findItem } from "@/data/subjects";
import { writingItemIds } from "@/data/writingMnemonics";
import { belirtmeHali, iyelikBelirtme } from "@/lib/turkce";

/**
 * SAHNE ÖLÇÜLERİ — hem BÜYÜKLÜK hem SİLME ZORLUĞU buradan çıkıyor.
 *
 * ⚠️ İKİSİ AYNI SORUNUN İKİ YÜZÜ (kullanıcı: "harfler küçük… bayağı büyüt…
 * bir de çok çabuk siliniyor, en azından iki kere silsin"). Sahne küçükken
 * kuyruk da küçük oluyor ve çocuğun tek yatay hamlesi kuyruğun tamamını
 * süpürüyordu.
 *
 * ÖLÇÜLDÜ (15 harf, kuyruğun ortasından tek soldan-sağa geçiş):
 *   300×190 · font 116 · fırça 17 → tek geçişte **%86** siliniyor (eşik %85)
 *      yani BİR hamlede bitiyor; ekranda glif ~93 px.
 *   360×270 · font 186 · fırça 16 → tek geçişte **%36**, yani ~2.4 hamle
 *      gerekiyor; ekranda glif ~149 px (**+%60**). Taşma 0.
 * Ara adaylar da denendi (340×250/168, 360×260/176, 360×280/196); bu ikili
 * "iki kere sil" isteğini karşılayan en büyük taşmasız seçenek.
 */
const W = 360, H = 270;          // CSS px
const S = 2;                      // iç çözünürlük
const CW = W * S, CH = H * S;
const BRUSH = 16 * S;             // sünger yarıçapı — çocuk parmağına bol
const BITIS = 0.85;               // kuyruğun bu oranı silinince tamam
/** Kutlama çanı bitmeden harfin sesi başlamasın (çan ~1.0 sn). */
const HARF_SESI_GECIKME = 900;
/** Ses hiç bitmezse (dosya yüklenemedi) en geç bu kadar sonra devam et. */
const SES_EMNIYET = 4000;
/**
 * ⚠️ YERLEŞİM ÖLÇÜLEREK SEÇİLDİ, gözle değil. Mürekkep 15 harfte 0.05-0.92
 * aralığında kalıyor — taşma 0, sünger için altta pay var. (İlk sürümde
 * baseY 0.66 · font 108 ile 0.23-0.95'e düşüyordu: üstte %23 boşluk, harf
 * dibe yapışık.)
 */
const GEOM: TailMaskGeom = { cw: CW, ch: CH, fontPx: 186 * S, baseY: Math.round(CH * 0.57) };

/** Harfin mürekkebi sahnenin bu kadarını kaplasın (dikey). */
const HEDEF_DOLULUK = 0.78;
/** Yatayda taşmasın diye üst sınır. */
const EN_COK_EN = 0.86;

const mkCanvas = () => {
  const c = document.createElement("canvas");
  c.width = CW; c.height = CH;
  return c;
};

interface Kopuk { x: number; y: number; vx: number; vy: number; r: number; om: number }

/**
 * HER HARFİ KENDİ ÖLÇÜSÜNE GÖRE BÜYÜT VE ORTALA.
 *
 * ⚠️ SABİT TABAN ÇİZGİSİ SAHNEYİ İSRAF EDİYOR: harflerin mürekkebi ölçüldü —
 * sahnenin ortalama **%55'ini** kullanıyorlar (Sin %41, Sad %43, Be %44,
 * Cim/Ha %53) ve dikey merkezleri **0.32-0.66** arasında savruluyor (ideal
 * 0.50). Yani kimi harf küçücük kalıyor, kimi kenara yapışıyor.
 *
 * ⚠️ "ÖLÇEKLE, SONRA YENİDEN ÖLÇ" YÖNTEMİ YANLIŞ SONUÇ VERDİ: büyütülen glif
 * ölçüm sırasında kanvasın dışına taşıp KIRPILIYOR, kırpık kutudan hesaplanan
 * merkez de yanlış çıkıyordu (ölçüldü: Fe'nin mürekkebi [0, 419] okunuyor,
 * merkez 0.39 — üst kenara dayanmış ve kesilmiş).
 *
 * Doğrusu ANALİTİK: mürekkep kutusunu TABAN ÇİZGİSİNE GÖRE bir kez ölç
 * (`ustOfs`, `altOfs`), bu ofsetler punto ile DOĞRUSAL ölçeklenir. Gereken
 * ölçek ve taban çizgisi doğrudan hesaplanır; ikinci bir ölçüm — dolayısıyla
 * kırpılma ihtimali — yok.
 */
function harfeGoreGeom(iso: string): TailMaskGeom {
  const ol = measureGlyph(iso, GEOM);
  if (!ol) return GEOM;
  // Taban çizgisine göre ofsetler (negatif = çizginin üstünde)
  const ustOfs = ol.top - GEOM.baseY;
  const altOfs = ol.bottom - GEOM.baseY;
  const boy = Math.max(1, altOfs - ustOfs);
  const en = Math.max(1, ol.right - ol.left);
  const olcek = Math.max(0.6, Math.min(2.2, Math.min(
    (CH * HEDEF_DOLULUK) / boy,
    (CW * EN_COK_EN) / en,
  )));
  const fontPx = Math.round(GEOM.fontPx * olcek);
  const k = fontPx / GEOM.fontPx;                    // gerçekleşen ölçek
  const merkezOfs = ((ustOfs + altOfs) / 2) * k;     // ölçekli merkez ofseti
  let baseY = Math.round(CH / 2 - merkezOfs);
  // Emniyet: mürekkep sahnenin dışına taşmasın (kenarda pay bırak)
  const pay = Math.round(CH * 0.03);
  baseY = Math.min(baseY, Math.round(CH - pay - altOfs * k));
  baseY = Math.max(baseY, Math.round(pay - ustOfs * k));
  return { ...GEOM, fontPx, baseY };
}

export function KuyrukAtolyesi({ rule, onDone, onSesBitti }: {
  rule: TailRule;
  /** Kuyruk silindiği ANDA — rozet/sayaç için. */
  onDone?: () => void;
  /**
   * Harfin sesi BİTTİĞİNDE. Sonraki harfe geçiş geri sayımı bununla başlar:
   * ⚠️ SABİT SÜRE YETMİYOR (kullanıcı: "ayn derken sonraki harfe geçiyor").
   * Ölçüldü — harf adlarının süresi 0.73 sn ile 2.33 sn arasında değişiyor
   * (Ğayn 2.325 · Ayn 1.907 · Be 0.758). Sabit 2.6 sn'lik geçişte sese
   * yalnız 1.7 sn kalıyordu, yani UZUN adlar yarıda kesiliyordu. Sabit süreyi
   * en uzun sese göre büyütmek de yanlış: kısa adlarda çocuk boşuna bekler.
   */
  onSesBitti?: () => void;
}) {
  const renk = harfRengi(rule.n);

  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<TailMask | null>(null);
  const initRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * ⚠️ İKİ AYRI YÜZ: yalın harfin (ج) ve "başta" hâlinin (ﺟ) mürekkebi FARKLI
   * yerlerde. Silme bitince harf ikinciye dönüşüyor; yüz birincinin yerinde
   * bırakılırsa surat havada kalıyor (kullanıcı: "silindikten sonraki
   * suratlar düzgün değil"). Dönüşüm boyunca iki yüz arasında geçiş yapılır.
   */
  const yuzIsoRef = useRef<Yuz | null>(null);
  const yuzInitRef = useRef<Yuz | null>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const limitedRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const cizimRef = useRef(false);
  const sonRef = useRef<{ x: number; y: number } | null>(null);
  // Süngerin yeri (iç çözünürlükte). null = çocuk daha dokunmadı.
  const spongeRef = useRef<{ x: number; y: number } | null>(null);
  const kopukRef = useRef<Kopuk[]>([]);
  const bittiRef = useRef(false);
  const sesRef = useRef(0);
  const kutlamaRef = useRef(0);
  const sesT = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Geri çağrılar ref'te: `olc` bağımlılığı değişince döngü kurulmasın.
  const onSesBittiRef = useRef(onSesBitti);
  onSesBittiRef.current = onSesBitti;

  const [oran, setOran] = useState(0);
  const [bitti, setBitti] = useState(false);
  const [hazir, setHazir] = useState(false);
  const [uyari, setUyari] = useState(false);
  const uyariT = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ekrandaki kareyi kur: harf + kuyruk vurgusu − silinen + gözler + sünger */
  const ciz = useCallback((t: number) => {
    const cv = cvRef.current, m = maskRef.current;
    const stroke = strokeRef.current, limited = limitedRef.current;
    if (!cv || !m || !stroke || !limited) return;
    const g = cv.getContext("2d")!;

    // 1) fırça izini KUYRUK maskesiyle kesiştir → baş asla silinmez
    const lg = limited.getContext("2d")!;
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, CW, CH);
    lg.drawImage(stroke, 0, 0);
    lg.globalCompositeOperation = "destination-in";
    lg.drawImage(m.tailMask, 0, 0);
    lg.globalCompositeOperation = "source-over";

    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, CW, CH);

    // 2) harf (kendi rengi) — bitince "başta" hâline yumuşak geçiş
    const kutlamaK = kutlamaRef.current
      ? Math.min(1, (t - kutlamaRef.current) / 480)
      : 0;
    if (kutlamaK > 0 && initRef.current) {
      // zıplayarak dönüşür: kısa bir esneme (squash & stretch)
      const z = Math.sin(kutlamaK * Math.PI) * 0.12;
      g.save();
      g.translate(CW / 2, CH * 0.62);
      g.scale(1 + z, 1 - z * 0.8);
      g.translate(-CW / 2, -CH * 0.62);
      g.globalAlpha = 1 - kutlamaK;
      g.drawImage(m.head, 0, 0);
      g.globalAlpha = kutlamaK;
      g.drawImage(initRef.current, 0, 0);
      g.globalAlpha = 1;
      g.restore();
    } else {
      g.drawImage(m.glyph, 0, 0);
      if (!bittiRef.current) {
        /**
         * ⚠️ KUYRUK BELİRGİN OLMALI (kullanıcı: "kuyruklar daha belirgin
         * olsun, silecek ya"). Önce yalnız soluk bir kırmızı gölge vardı
         * (0.30-0.52 alfa) ve harfin kendi rengi güçlü olduğu için hangi
         * parçanın silineceği okunmuyordu. Şimdi üç katman:
         *   1) kuyruk tamamen kırmızıya boyanır (yüksek alfa),
         *   2) çevresine parlayan bir hâle (shadowBlur) konur,
         *   3) hâlâ nabız atar ama tabanı yüksek — hiç sönmüyor.
         * Silinen piksel anında kaybolduğu için ilerleme de görünür oluyor.
         */
        const nabiz = 0.78 + 0.22 * (0.5 - 0.5 * Math.cos(t / 420));
        g.save();
        const kr = kuyrukRengi(renk);
        g.shadowColor = `rgba(${kr[0]},${kr[1]},${kr[2]},0.95)`;
        g.shadowBlur = 10 * S;
        g.globalAlpha = nabiz;
        g.drawImage(m.tailTint, 0, 0);
        g.drawImage(m.tailTint, 0, 0);   // ikinci geçiş: hâle belirginleşsin
        g.restore();
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = "destination-out";
      g.drawImage(limited, 0, 0);
      g.globalCompositeOperation = "source-over";
    }

    // 3) YÜZ — mürekkebin üstünde; dönüşürken yeni şeklin yerine kayar
    const yA = yuzIsoRef.current, yB = yuzInitRef.current;
    if (!yA) return;
    const k = kutlamaK > 0 && yB ? Math.min(1, kutlamaK * 1.4) : 0;
    const ka = (a: number, b: number) => a + (b - a) * k;
    const gx = yB ? ka(yA.gx, yB.gx) : yA.gx;
    const gy = yB ? ka(yA.gy, yB.gy) : yA.gy;
    const ar = yB ? ka(yA.ar, yB.ar) : yA.ar;
    const ayrik = yB ? ka(yA.ayrik, yB.ayrik) : yA.ayrik;
    const agizY = yB ? ka(yA.agizY, yB.agizY) : yA.agizY;
    const agizR = yB ? ka(yA.agizR, yB.agizR) : yA.agizR;
    const hedef = spongeRef.current;
    // bakış yönü (küçük kayma)
    let bx = 0, by = 0;
    if (hedef) {
      const dx = hedef.x - gx, dy = hedef.y - gy;
      const d = Math.hypot(dx, dy) || 1;
      bx = (dx / d) * ar * 0.34;
      by = (dy / d) * ar * 0.34;
    }
    const kirp = bittiRef.current ? 1 : ((t % 3800) > 3600 ? 0.12 : 1);
    for (const yon of [-1, 1]) {
      const ex = gx + yon * ayrik;
      if (bittiRef.current) {
        // sevinç: gözler yay gibi (^ ^)
        g.strokeStyle = "#1f2937";
        g.lineWidth = 2.6 * S;
        g.lineCap = "round";
        g.beginPath();
        g.arc(ex, gy + ar * 0.35, ar * 0.85, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        g.lineCap = "butt";
        continue;
      }
      g.fillStyle = "#fff";
      g.beginPath(); g.ellipse(ex, gy, ar, ar * kirp, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(31,41,55,0.35)"; g.lineWidth = 1 * S; g.stroke();
      if (kirp > 0.5) {
        g.fillStyle = "#1f2937";
        g.beginPath(); g.arc(ex + bx, gy + by, ar * 0.46, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff";
        g.beginPath(); g.arc(ex + bx - ar * 0.16, gy + by - ar * 0.18, ar * 0.16, 0, Math.PI * 2); g.fill();
      }
    }
    // gülümseme (bitince büyür) — yeri de mürekkebe göre ölçüldü
    g.strokeStyle = "#1f2937";
    g.lineWidth = 2 * S; g.lineCap = "round";
    g.beginPath();
    g.arc(gx, agizY, agizR * (bittiRef.current ? 1.15 : 0.85), 0.18 * Math.PI, 0.82 * Math.PI);
    g.stroke();
    g.lineCap = "butt";

    // 4) köpük baloncukları
    const kop = kopukRef.current;
    for (let i = kop.length - 1; i >= 0; i--) {
      const b = kop[i];
      b.x += b.vx; b.y += b.vy; b.vy += 0.08 * S; b.om -= 0.022;
      if (b.om <= 0) { kop.splice(i, 1); continue; }
      g.globalAlpha = Math.max(0, b.om);
      g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = acikTon(renk, 0.2); g.lineWidth = 1 * S; g.stroke();
      g.globalAlpha = 1;
    }

    // 5) SÜNGER — parmağın altında; dokunulmamışsa kuyruğun üstünde sallanır
    if (!bittiRef.current) {
      let sx: number, sy: number, egim: number;
      if (spongeRef.current) {
        sx = spongeRef.current.x; sy = spongeRef.current.y;
        egim = Math.sin(t / 90) * 0.14;
      } else {
        // ⚠️ SÜNGER SAHNENİN İÇİNDE KALMALI: kuyruğun alt ucu ölçüldü, bazı
        // harflerde kanvas yüksekliğinin %95'ine iniyor; "kuyruğun 16 px
        // altı" demek süngeri ekranın dışına atmak demekti (yarısı kesik
        // görünüyordu). Sahne içine kelepçelenir.
        const tb = m.tailBox;
        sx = tb.left + (tb.right - tb.left) * (0.5 + 0.28 * Math.sin(t / 620));
        sy = Math.min(tb.bottom + 16 * S, CH - 16 * S);
        egim = Math.sin(t / 300) * 0.22;
      }
      sx = Math.max(20 * S, Math.min(CW - 20 * S, sx));
      g.save();
      g.translate(sx, sy);
      g.rotate(egim);
      const sw = 34 * S, sh = 22 * S;
      g.fillStyle = "rgba(15,23,42,0.18)";
      rrect(g, -sw / 2, -sh / 2 + 3 * S, sw, sh, 6 * S); g.fill();
      g.fillStyle = "#fde68a";                     // sünger gövdesi
      rrect(g, -sw / 2, -sh / 2, sw, sh, 6 * S); g.fill();
      g.fillStyle = "#f6b93b";                     // alt şerit
      rrect(g, -sw / 2, sh * 0.10, sw, sh * 0.40, 5 * S); g.fill();
      g.fillStyle = "rgba(255,255,255,0.55)";      // gözenekler
      for (const [px, py] of [[-9, -4], [-1, -6], [7, -3], [-6, 2], [4, 3]] as const) {
        g.beginPath(); g.arc(px * S, py * S, 1.7 * S, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }, [renk]);

  /** Kalan kuyruk mürekkebini say → ilerleme */
  const olc = useCallback(() => {
    const cv = cvRef.current, m = maskRef.current;
    if (!cv || !m || m.tailInk === 0 || bittiRef.current) return;
    const lg = limitedRef.current!.getContext("2d", { willReadFrequently: true })!;
    const d = lg.getImageData(0, 0, CW, CH).data;
    let silinen = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) silinen++;
    const p = Math.max(0, Math.min(1, silinen / m.tailInk));
    setOran(p);
    if (p >= BITIS) {
      bittiRef.current = true;
      setBitti(true);
      kutlamaRef.current = performance.now();
      /**
       * ⚠️ ÖNCE KUTLAMA, SONRA HARFİN SESİ (kullanıcı isteği: "bir harfi
       * silince o harfin de sesi çıksın, tebrikler sesinden sonra").
       * İkisi AYNI ANDA çalarsa kutlama çanı hocanın sesini örtüyor —
       * çocuk asıl öğrenmesi gereken şeyi duymuyor. Kutlama ~1.0 sn
       * sürüyor, harf sesi onun bitişine yakın başlar.
       */
      sfx("kutlama");
      if (sesT.current) clearTimeout(sesT.current);
      sesT.current = setTimeout(() => {
        const it = findItem(writingItemIds(rule.n).init);
        if (!it) { onSesBittiRef.current?.(); return; }
        /**
         * ⚠️ EMNİYET ZAMANLAYICISI: `playItem` ses bitince çözülüyor, ama
         * dosya hiç yüklenemezse (mobil WebView, ağ) söz geç çözülebilir.
         * O zaman geçiş hiç başlamaz ve çocuk ekranda kilitli kalır.
         * En uzun kayıt 2.33 sn; 4 sn sonra her hâlükârda devam edilir.
         */
        let bitti = false;
        const kapan = () => { if (!bitti) { bitti = true; onSesBittiRef.current?.(); } };
        const emniyet = setTimeout(kapan, SES_EMNIYET);
        void playItem(it).finally(() => { clearTimeout(emniyet); kapan(); });
      }, HARF_SESI_GECIKME);
      onDone?.();
    }
  }, [onDone, rule.n]);

  // Maskeleri kur
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await document.fonts.load(tailFontSpec(GEOM), rule.iso + rule.init);
        await document.fonts.ready;
      } catch { /* yoksay */ }
      if (!alive) return;
      // ⚠️ Yalın harf ile "başta" hâli AYRI ölçülür: ikisi farklı genişlikte,
      // tek ölçekle çizilirse dönüşümde harf birden büyüyüp küçülüyor.
      const gIso = harfeGoreGeom(rule.iso);
      const gInit = harfeGoreGeom(rule.init);
      const m = buildTailMask(rule, gIso, renk, kuyrukRengi(renk));
      maskRef.current = m;
      initRef.current = drawCentered(rule.init, gInit, renk);
      // İki şeklin yüzü de burada, mürekkep ölçülerek hesaplanır.
      yuzIsoRef.current = m ? yuzYeri(m.headFlags, CW, m.headBox) : null;
      if (initRef.current) {
        const f = inkFlags(initRef.current);
        yuzInitRef.current = yuzYeri(f, CW, inkBox(f, CW, CH));
      } else {
        yuzInitRef.current = null;
      }
      strokeRef.current = mkCanvas();
      limitedRef.current = mkCanvas();
      kopukRef.current = [];
      spongeRef.current = null;
      // ⚠️ Harf değişirse bekleyen ses İPTAL: yoksa önceki harfin sesi yeni
      // harfin üstüne çalıyor ve çocuk yanlış eşleştirme öğreniyor.
      if (sesT.current) { clearTimeout(sesT.current); sesT.current = null; }
      bittiRef.current = false;
      kutlamaRef.current = 0;
      setBitti(false); setOran(0);
      setHazir(!!m && m.tailInk > 200);
    })();
    return () => { alive = false; };
  }, [rule, renk]);

  // Çizim döngüsü
  useEffect(() => {
    if (!hazir) return;
    const tick = () => {
      ciz(performance.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [hazir, ciz]);

  useEffect(() => () => {
    if (uyariT.current) clearTimeout(uyariT.current);
    if (sesT.current) clearTimeout(sesT.current);
  }, []);

  const yerel = (e: React.PointerEvent) => {
    const cv = cvRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
  };

  const sil = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const st = strokeRef.current;
    const m = maskRef.current;
    if (!st || !m) return;
    const g = st.getContext("2d")!;
    g.strokeStyle = "#000";
    g.lineWidth = BRUSH * 2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    // köpük saç
    if (kopukRef.current.length < 60) {
      for (let i = 0; i < 2; i++) {
        kopukRef.current.push({
          x: b.x + (Math.random() - 0.5) * BRUSH,
          y: b.y + (Math.random() - 0.5) * BRUSH,
          vx: (Math.random() - 0.5) * 1.6, vy: -Math.random() * 1.8 - 0.4,
          r: (2 + Math.random() * 3) * S, om: 1,
        });
      }
    }
    // BAŞIN üstünü ovalıyorsa uyar (orada hiçbir şey silinmiyor)
    const ix = Math.round(b.x), iy = Math.round(b.y);
    if (ix >= 0 && iy >= 0 && ix < CW && iy < CH && m.headFlags[iy * CW + ix]) {
      setUyari(true);
      if (uyariT.current) clearTimeout(uyariT.current);
      uyariT.current = setTimeout(() => setUyari(false), 1100);
    }
    // silme sesi — kısılmış, en fazla 120 ms'de bir (her karede çalmak gürültü)
    const now = performance.now();
    if (now - sesRef.current > 120) { sesRef.current = now; sfx("kaydir", { titresim: false }); }
  };

  const bas = (e: React.PointerEvent) => {
    if (bittiRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    cizimRef.current = true;
    const p = yerel(e);
    sonRef.current = p; spongeRef.current = p;
    sil(p, p);
  };
  const hareket = (e: React.PointerEvent) => {
    const p = yerel(e);
    spongeRef.current = p;              // sünger her zaman parmağı izler
    if (!cizimRef.current || bittiRef.current) return;
    const a = sonRef.current ?? p;
    sil(a, p);
    sonRef.current = p;
    olc();
  };
  const birak = () => { cizimRef.current = false; sonRef.current = null; olc(); };

  const bastanAl = () => {
    strokeRef.current?.getContext("2d")!.clearRect(0, 0, CW, CH);
    limitedRef.current?.getContext("2d")!.clearRect(0, 0, CW, CH);
    kopukRef.current = [];
    bittiRef.current = false; kutlamaRef.current = 0;
    setBitti(false); setOran(0);
  };

  const sesliOku = () => {
    const it = findItem(writingItemIds(rule.n).init);
    if (it) playItem(it);
  };

  if (!hazir) return null;

  return (
    <div
      className="rounded-3xl border-4 p-3 shadow-card transition-colors"
      style={{ borderColor: acikTon(renk, 0.45), background: acikTon(renk, 0.9) }}
    >
      {/* başlık: harfin adı + rengi */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white shadow-soft"
            style={{ background: renk }}
          >
            {rule.name[0]}
          </span>
          <span className="text-sm font-extrabold text-foreground">{rule.name}</span>
        </span>
        <span className="text-[10px] font-extrabold" style={{ color: renk }}>
          {/* ⚠️ Ek ELLE yazılmaz: "çanak"+"ı" = "çanakı" çıkıyordu (ekranda görüldü),
              doğrusu "çanağı". Ünlü uyumu + ünsüz yumuşaması için `lib/turkce`. */}
          {bitti ? "🎉 kuyruk gitti!" : `🧽 ${belirtmeHali(rule.tailName)} sil`}
        </span>
      </div>

      {/* sahne */}
      <div className="relative mx-auto w-full select-none" style={{ maxWidth: W }}>
        <canvas
          ref={cvRef}
          width={CW}
          height={CH}
          /* ⚠️ Sabit `height` yerine EN-BOY ORANI: kap genişliği telefondan
             telefona değişiyor; yükseklik sabit kalırsa çizim yatayda esner
             (glif şişer). Oran verilince her ekranda bozulmadan büyür. */
          style={{ width: "100%", aspectRatio: `${W} / ${H}`, touchAction: "none" }}
          className="rounded-2xl bg-white/80 shadow-inner"
          onPointerDown={bas}
          onPointerMove={hareket}
          onPointerUp={birak}
          onPointerLeave={birak}
          onPointerCancel={birak}
          role="img"
          aria-label={`${rule.name}: ${iyelikBelirtme(rule.tailName)} süngerle sil`}
        />
        {uyari && !bitti && (
          <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-max rounded-full bg-foreground/85 px-3 py-1 text-[10px] font-extrabold text-background">
            ✋ orası kalacak — {rule.keepName}
          </div>
        )}
        {bitti && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${(i * 29) % 100}%`, top: "-12%",
                  animationDelay: `${(i % 5) * 0.09}s`,
                  animationDuration: `${1.3 + (i % 4) * 0.2}s`,
                  fontSize: `${11 + (i % 3) * 6}px`,
                }}
              >
                {["✨", "🎉", "⭐"][i % 3]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* köpük çubuğu */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${Math.round(oran * 100)}%`, background: renk }}
        />
      </div>

      {/* sonuç: AYNI HARF vurgusu */}
      {bitti ? (
        <div className="mt-2 rounded-2xl bg-white/85 p-2 text-center">
          {/* ⚠️ GLİFLER `EmojiView` İLE: düz <span>'de Arapça mürekkep satır
              kutusunun altına kayıyor ve yandaki küçük yazının altında
              kalıyordu (ekran görüntüsünde görüldü). EmojiView mürekkebi
              ölçüp ortalıyor — uygulamanın her yerinde geçerli kural. */}
          <div className="flex items-center justify-center gap-2" dir="ltr">
            <span className="text-2xl" style={{ color: renk }}>
              <EmojiView value={rule.iso} />
            </span>
            <span className="text-[10px] font-extrabold text-muted-foreground">kuyruksuz</span>
            <span className="text-lg" aria-hidden>→</span>
            <span className="text-2xl" style={{ color: renk }}>
              <EmojiView value={rule.init} />
            </span>
          </div>
          <p className="mt-0.5 text-[11px] font-extrabold text-foreground">
            Yine <span style={{ color: renk }}>{rule.name}</span>! Sadece kuyruğu gitti,
            harf değişmedi — bu onun <b>başta</b> hâli.
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <button
              onClick={sesliOku}
              className="rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold shadow-soft active:scale-95"
              style={{ color: renk }}
            >🔊 dinle</button>
            <button
              onClick={bastanAl}
              className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-extrabold text-muted-foreground active:scale-95"
            >↺ tekrar</button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-center text-[11px] font-bold leading-snug text-foreground/80">
          {rule.say}
        </p>
      )}
    </div>
  );
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}
