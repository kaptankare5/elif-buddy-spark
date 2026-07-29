// ✂️ KUYRUK SİLME animasyonu — "yalın hâlin kuyruğunu silersen başta hâli çıkar".
//
// Eskiden sahnede her harf için AYNI sabit kırmızı dikdörtgen vardı. O kutu
// harfin gerçek kuyruğuyla örtüşmediği için: Cim ile Be'nin NOKTASI kutunun
// içinde kalıp siliniyor, Sin/Şin/Kaf/Dad'ın kuyruk ucu kutunun dışında kalıp
// yeşil şerit bırakıyor, Sad/Dad'ın başı fazla kesiliyor, Lem baştan aşağı
// kırmızı görünüyordu. Artık sahne bir KANVAS: kırmızı bölge, oyunla birebir
// aynı piksel maskesinden geliyor (src/lib/tailMask.ts) — nokta asla silinmez,
// kuyruk ucunda yeşil kalmaz.
//
// Döngü (~5.2sn): işaretle (kırmızı nabız) → silgi soldan sağa süpürür ve
// kuyruk gerçekten yok olur → kalan baş → başta hâline çapraz geçiş → bekle.
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TailRule } from "@/data/writingMnemonics";
import { buildTailMask, drawCentered, tailFontSpec, type TailMask, type TailMaskGeom } from "@/lib/tailMask";

const S = 2; // iç çözünürlük çarpanı

const GEOM: Record<"sm" | "md", { w: number; h: number; geom: TailMaskGeom }> = {
  sm: { w: 200, h: 112, geom: { cw: 200 * S, ch: 112 * S, fontPx: 68 * S, baseY: Math.round(112 * S * 0.7) } },
  md: { w: 220, h: 128, geom: { cw: 220 * S, ch: 128 * S, fontPx: 80 * S, baseY: Math.round(128 * S * 0.7) } },
};

// Faz sınırları (ms)
const T_MARK = 1000;   // kırmızı nabız
const T_WIPE = 3100;   // silgi süpürür
const T_HOLD = 3600;   // kalan baş
const T_MORPH = 4400;  // başta hâline geçiş
const T_LOOP = 5400;   // döngü sonu

/** Hareket azaltma tercihi — kanvas döngüsü CSS'ten yönetilmediği için burada okunur. */
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function TailErase({ rule, size = "md" }: { rule: TailRule; size?: "sm" | "md" }) {
  // Duraklat/oynat — çocuk kendi hızında inceleyebilsin (özerklik).
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [ready, setReady] = useState(false);

  const { w: W, h: H, geom } = GEOM[size];
  const { cw: CW, ch: CH } = geom;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<TailMask | null>(null);
  const initRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  /** Tek kare çiz — t: döngü içindeki ms */
  const frame = useCallback((t: number) => {
    const cv = canvasRef.current, m = maskRef.current;
    if (!cv || !m) return;
    const g = cv.getContext("2d")!;
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, CW, CH);

    if (t < T_MARK) {
      // 1) İŞARETLE — tam glif + kuyruk kırmızı, nabız gibi parlar
      g.drawImage(m.glyph, 0, 0);
      g.globalAlpha = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((t / T_MARK) * Math.PI * 4));
      g.drawImage(m.tailTint, 0, 0);
      g.globalAlpha = 1;
      return;
    }

    if (t < T_WIPE) {
      // 2) SİL — silgi soldan sağa geçer, geçtiği yerdeki KUYRUK pikselleri gider
      const k = (t - T_MARK) / (T_WIPE - T_MARK);
      const pad = Math.round(CW * 0.06);
      const from = Math.max(0, m.tailBox.left - pad);
      const to = Math.min(CW, m.tailBox.right + pad);
      const front = Math.round(from + (to - from) * k);
      g.drawImage(m.glyph, 0, 0);
      g.drawImage(m.tailTint, 0, 0);
      if (front > 0) {
        // yalnız kuyruk maskesi kadarını sil → baş asla eksilmez
        g.globalCompositeOperation = "destination-out";
        g.drawImage(m.tailMask, 0, 0, front, CH, 0, 0, front, CH);
        g.globalCompositeOperation = "source-over";
      }
      // Silgi kuyruğun ALT kısmında gezer: tam ortada olsa Cim/Be gibi
      // harflerin NOKTASININ üstünü kapatır, çocuk "nokta da siliniyor" sanır.
      const cy = m.tailBox.top + (m.tailBox.bottom - m.tailBox.top) * 0.8;
      g.font = `${Math.round(32 * S)}px serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("🧽", front, cy);
      return;
    }

    if (t < T_HOLD) {
      g.drawImage(m.head, 0, 0);  // 3) kalan baş
      return;
    }

    if (t < T_MORPH) {
      // 4) çapraz geçiş: kalan baş → gerçek "başta" hâli
      const k = (t - T_HOLD) / (T_MORPH - T_HOLD);
      g.globalAlpha = 1 - k;
      g.drawImage(m.head, 0, 0);
      if (initRef.current) {
        g.globalAlpha = k;
        g.drawImage(initRef.current, 0, 0);
      }
      g.globalAlpha = 1;
      return;
    }

    // 5) başta hâli beklemede
    if (initRef.current) g.drawImage(initRef.current, 0, 0);
  }, [CW, CH]);

  // Maskeleri kur (font yüklendikten sonra)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        await document.fonts.load(tailFontSpec(geom), rule.iso + rule.init);
        await document.fonts.ready;
      } catch { /* yoksay */ }
      if (!alive) return;
      const m = buildTailMask(rule, geom);
      maskRef.current = m;
      initRef.current = drawCentered(rule.init, geom, "#0f766e");
      setReady(!!m && m.tailInk > 200);
      startRef.current = performance.now();
      frame(0);
    };
    run();
    return () => { alive = false; };
  }, [rule, geom, frame]);

  // Döngü
  useEffect(() => {
    if (!ready) return;
    if (!playing) {
      frame(0); // duraklatılınca "işaretli" kare kalsın — kuyruk kırmızı görünür
      return;
    }
    startRef.current = performance.now();
    const tick = () => {
      const t = (performance.now() - startRef.current) % T_LOOP;
      frame(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready, playing, frame]);

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card p-3 shadow-soft">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-foreground">{rule.name}</span>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground active:scale-95"
          aria-label={playing ? "Animasyonu duraklat" : "Animasyonu oynat"}
        >
          {playing ? "⏸ durdur" : "▶ oynat"}
        </button>
      </div>

      {/* Sahne: gerçek kuyruk maskesi üzerinde silme */}
      <div className="mx-auto w-full" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ width: "100%", height: H }}
          className="rounded-xl bg-emerald-50/60"
          role="img"
          aria-label={`${rule.name}: yalın hâlin ${rule.tailName}ı silinince başta hâli kalır`}
        />
      </div>

      {/* Yalın → başta özeti (animasyondan bağımsız, her zaman okunur).
          Glif kutuları SABİT ve BOL yükseklikli: Arapça glifler (ج ع gibi derin
          çanaklılar) satır kutusunun dışına taşar; dar kutuda alttaki etikete
          biner. h-16 + üstte hizalama, taşan mürekkebe alan bırakır. */}
      <div className="mt-2 flex items-end justify-center gap-2 text-center" dir="ltr">
        <span className="flex flex-col items-center">
          <span className="flex h-16 items-start justify-center pt-1">
            <span className="font-arabic text-3xl leading-none text-emerald-900" dir="rtl">{rule.iso}</span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground">yalın</span>
        </span>
        <span className="flex flex-col items-center px-1">
          <span className="flex h-16 flex-col items-center justify-center">
            <span className="text-lg leading-none" aria-hidden>✂️</span>
            <span className="mt-0.5 text-[9px] font-extrabold leading-tight text-destructive">{rule.tailName}</span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground">silinir</span>
        </span>
        <span className="flex h-16 items-center pb-4 text-xl text-muted-foreground" aria-hidden>→</span>
        <span className="flex flex-col items-center">
          <span className="flex h-16 items-start justify-center pt-1">
            <span className="font-arabic text-3xl leading-none text-primary" dir="rtl">{rule.init}</span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground">başta</span>
        </span>
      </div>

      <p className="mt-2 text-center text-[11px] font-bold leading-snug text-foreground">
        {rule.say}
      </p>
      <p className="mt-0.5 text-center text-[10px] font-semibold text-muted-foreground">
        Kalan parça: <b className="text-primary">{rule.keepName}</b>
      </p>
    </div>
  );
}
