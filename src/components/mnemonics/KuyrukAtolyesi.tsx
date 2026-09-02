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
import { buildTailMask, drawCentered, tailFontSpec, type TailMask, type TailMaskGeom } from "@/lib/tailMask";
import { harfRengi, acikTon } from "@/data/harfRenkleri";
import { sfx } from "@/lib/juice";
import { playItem } from "@/lib/audio";
import { findItem } from "@/data/subjects";
import { writingItemIds } from "@/data/writingMnemonics";
import { belirtmeHali, iyelikBelirtme } from "@/lib/turkce";

const W = 300, H = 190;          // CSS px
const S = 2;                      // iç çözünürlük
const CW = W * S, CH = H * S;
const BRUSH = 17 * S;             // sünger yarıçapı — çocuk parmağına bol
const BITIS = 0.85;               // kuyruğun bu oranı silinince tamam
/**
 * ⚠️ SAHNEDEKİ YERLEŞİM ÖLÇÜLEREK SEÇİLDİ, gözle değil. İlk değerlerde
 * (baseY 0.66 · font 108) mürekkep 15 harfte 0.23-0.95 aralığına düşüyordu:
 * üstte %23 boşluk, altta %5 — harf sahnenin dibine yapışıyor ve sünger
 * dışarı taşıyordu. Denenen beş ikiliden en dengelisi:
 *   baseY 0.66/108 → 0.23-0.95 (dengesiz)
 *   baseY 0.58/116 → 0.12-0.89 (üst %12, alt %11 — SEÇİLEN)
 *   baseY 0.56/124 → 0.07-0.89 (harf büyük ama üstte pay kalmıyor)
 * Hiçbirinde taşma yok; ölçüm aracı `tools/perf/_yerlesim.mjs` deseni.
 */
const GEOM: TailMaskGeom = { cw: CW, ch: CH, fontPx: 116 * S, baseY: Math.round(CH * 0.58) };

const mkCanvas = () => {
  const c = document.createElement("canvas");
  c.width = CW; c.height = CH;
  return c;
};

interface Kopuk { x: number; y: number; vx: number; vy: number; r: number; om: number }

export function KuyrukAtolyesi({ rule, onDone }: { rule: TailRule; onDone?: () => void }) {
  const renk = harfRengi(rule.n);

  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<TailMask | null>(null);
  const initRef = useRef<HTMLCanvasElement | null>(null);
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
        // kuyruk, silinmemişken hafifçe nabız atar: "burayı sil" işareti
        g.globalAlpha = 0.30 + 0.22 * (0.5 - 0.5 * Math.cos(t / 380));
        g.drawImage(m.tailTint, 0, 0);
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = "destination-out";
      g.drawImage(limited, 0, 0);
      g.globalCompositeOperation = "source-over";
    }

    // 3) GÖZLER — başın MÜREKKEBİNİN üstünde, süngere bakar
    const yer = gozYeri(m);
    const { gx, gy, ar, ayrik } = yer;
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
    // gülümseme (bitince büyür)
    g.strokeStyle = "#1f2937";
    g.lineWidth = 2 * S; g.lineCap = "round";
    g.beginPath();
    const agizR = ar * (bittiRef.current ? 1.05 : 0.7);
    g.arc(gx, gy + ar * 1.5, agizR, 0.2 * Math.PI, 0.8 * Math.PI);
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
      sfx("kutlama");
      onDone?.();
    }
  }, [onDone]);

  // Maskeleri kur
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await document.fonts.load(tailFontSpec(GEOM), rule.iso + rule.init);
        await document.fonts.ready;
      } catch { /* yoksay */ }
      if (!alive) return;
      const m = buildTailMask(rule, GEOM, renk);
      maskRef.current = m;
      initRef.current = drawCentered(rule.init, GEOM, renk);
      strokeRef.current = mkCanvas();
      limitedRef.current = mkCanvas();
      kopukRef.current = [];
      spongeRef.current = null;
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

  useEffect(() => () => { if (uyariT.current) clearTimeout(uyariT.current); }, []);

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
          style={{ width: "100%", height: H, touchAction: "none" }}
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
          <div className="flex items-center justify-center gap-2" dir="ltr">
            <span className="font-arabic text-2xl leading-[1.7]" style={{ color: renk }} dir="rtl">{rule.iso}</span>
            <span className="text-[10px] font-extrabold text-muted-foreground">kuyruksuz</span>
            <span className="text-lg" aria-hidden>→</span>
            <span className="font-arabic text-2xl leading-[1.7]" style={{ color: renk }} dir="rtl">{rule.init}</span>
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

/**
 * GÖZLERİ HARFİN MÜREKKEBİNE OTURT.
 *
 * ⚠️ İLK SÜRÜM `headBox`IN ORTASINI KULLANIYORDU ve ÖLÇÜMDE 15 harfin 3'ünde
 * göz HAVADA kalıyordu (Hı, Dad, Lem): kutuya harfin NOKTASI da giriyor,
 * nokta gövdeden uzakta olduğu için kutunun ortası mürekkebin dışına düşüyor.
 * (Lem'de gövde ince ve dik, kutu ortası boşluğa geliyor.)
 *
 * Doğrusu kutuya değil PİKSELE bakmak: başın üst bölgesinde EN GENİŞ mürekkep
 * satırını bul, iki gözü o satırın gerçek mürekkep aralığına yerleştir.
 * Sonuç ölçüldü: 15/15 göz harfin üstünde.
 */
function gozYeri(m: TailMask): { gx: number; gy: number; ar: number; ayrik: number } {
  const hb = m.headBox;
  const bw = Math.max(1, hb.right - hb.left);
  const bh = Math.max(1, hb.bottom - hb.top);
  // başın üst %65'inde satır satır mürekkep aralığı ara
  let enIyi = { y: hb.top + bh * 0.3, sol: hb.left, sag: hb.right, gen: -1 };
  for (let y = Math.round(hb.top + bh * 0.12); y <= Math.round(hb.top + bh * 0.65); y += 2) {
    let sol = -1, sag = -1;
    for (let x = hb.left; x <= hb.right; x++) {
      if (m.headFlags[y * CW + x]) { if (sol < 0) sol = x; sag = x; }
    }
    if (sol < 0) continue;
    const gen = sag - sol;
    if (gen > enIyi.gen) enIyi = { y, sol, sag, gen };
  }
  const gen = Math.max(1, enIyi.gen);
  const ar = Math.max(7 * S, Math.min(11 * S, gen * 0.14));
  // iki göz mürekkep aralığının içinde kalsın (kenarlara yapışmasın)
  const ayrik = Math.max(ar * 1.15, Math.min(gen * 0.26, ar * 2.2));
  const gx = (enIyi.sol + enIyi.sag) / 2;
  return { gx, gy: enIyi.y, ar, ayrik };
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
