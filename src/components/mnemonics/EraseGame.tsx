// ✋ SİL-ÇIKAR OYUNU — çocuk kuyruğu KENDİ PARMAĞIYLA siler.
//
// Pasif animasyon izlemek yerine çocuk eylemi kendisi yapar: yalın harfin
// kuyruğunu ovalayarak siler, silince başta hâli ortaya çıkar. Öğrenme bilimi:
// üretim etkisi (generation effect) + bedenlenmiş öğrenme.
//
// KUYRUK NEREDE? — Sabit bir "alt yarı" dikdörtgeni YANLIŞTI: Fe'de (ف) kuyruk
// SOLDA yatar, Ayn'da (ع) alt-solda, Cim'de (ج) altta, Mim'de (م) aşağı sarkar.
// "Yalın hâl eksi başta hâli" ile otomatik türetmeyi de denedik: bu fontlarda
// iki form FARKLI çizildiği için üst üste oturmuyor (ölçüm: örtüşme yalnız
// %21-56) ve baş da kuyruk sanılıyordu. Bu yüzden kuyruk yönü artık her harf
// için AÇIKÇA tanımlı (writingMnemonics.ts → TailRule.zone): "alt" ya da "sol"
// + mürekkep kutusuna göre oran. Font boyutundan bağımsız, doğrulanabilir.
//
// BAŞ SİLİNEMEZ: silgi, kuyruk maskesiyle kesiştirilir (destination-in), yani
// çocuk başın üstünü ovalasa da hiçbir şey silinmez — üstelik "orası kalacak"
// uyarısı çıkar. Böylece oyun DOĞRU şeyi öğretir: baş kalır, kuyruk gider.
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TailRule } from "@/data/writingMnemonics";
import { playFeedback } from "@/lib/audio";

const W = 260;             // CSS px
const H = 150;
const S = 2;               // iç çözünürlük çarpanı (netlik)
const CW = W * S, CH = H * S;
const FONT_PX = 96 * S;    // glif boyu (iç çözünürlükte)
const BASE_Y = Math.round(CH * 0.68); // taban çizgisi
const BRUSH = 15 * S;      // silgi yarıçapı — çocuk parmağı için bol
const SUCCESS_AT = 0.85;   // kuyruk mürekkebinin bu oranı silinince başarı
const FONT = `${FONT_PX}px "Amiri Quran", "Amiri", "Scheherazade New", serif`;

const mkCanvas = () => {
  const c = document.createElement("canvas");
  c.width = CW; c.height = CH;
  return c;
};

/** Glifi kendi kanvasına çizer; mürekkebin sağ kenarını (px) döndürür. */
function drawGlyph(ch: string, dx: number, dy = 0): {
  canvas: HTMLCanvasElement; right: number; ink: number; data: Uint8ClampedArray;
} {
  const c = mkCanvas();
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = FONT;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#134e3a";
  g.fillText(ch, dx, BASE_Y + dy);
  const d = g.getImageData(0, 0, CW, CH).data;
  let right = -1, left = CW, top = CH, bottom = -1, ink = 0;
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      if (d[(y * CW + x) * 4 + 3] > 40) {
        ink++;
        if (x > right) right = x;
        if (x < left) left = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { canvas: c, right, left, top, bottom, ink, data: d };
}

export function EraseGame({ rule }: { rule: TailRule }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Katmanlar: tam glif (yeşil), kuyruk vurgusu (kırmızı), kuyruk maskesi, fırça izi
  const glyphRef = useRef<HTMLCanvasElement | null>(null);
  const tailTintRef = useRef<HTMLCanvasElement | null>(null);
  const tailMaskRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const limitedRef = useRef<HTMLCanvasElement | null>(null);
  const headMaskDataRef = useRef<Uint8Array | null>(null);
  const tailInkRef = useRef(0);
  const headInkRef = useRef(0);

  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const solvedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [progress, setProgress] = useState(0);
  const [solved, setSolved] = useState(false);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ana kanvası yeniden çiz: glif + kuyruk vurgusu − (fırça ∩ kuyruk) */
  const compose = useCallback(() => {
    const cv = canvasRef.current;
    const glyph = glyphRef.current, tint = tailTintRef.current;
    const mask = tailMaskRef.current, stroke = strokeRef.current, limited = limitedRef.current;
    if (!cv || !glyph || !tint || !mask || !stroke || !limited) return;
    const g = cv.getContext("2d")!;
    // 1) fırça izini kuyruk maskesiyle kesiştir → yalnız kuyruk silinebilir
    const lg = limited.getContext("2d")!;
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, CW, CH);
    lg.drawImage(stroke, 0, 0);
    lg.globalCompositeOperation = "destination-in";
    lg.drawImage(mask, 0, 0);
    lg.globalCompositeOperation = "source-over";
    // 2) ana kanvas
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, CW, CH);
    g.drawImage(glyph, 0, 0);
    g.drawImage(tint, 0, 0);
    g.globalCompositeOperation = "destination-out";
    g.drawImage(limited, 0, 0);
    g.globalCompositeOperation = "source-over";
  }, []);

  /** Kalan kuyruk mürekkebini ölç → ilerleme */
  const measure = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || tailInkRef.current === 0) return;
    const g = cv.getContext("2d", { willReadFrequently: true })!;
    const d = g.getImageData(0, 0, CW, CH).data;
    let remaining = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) remaining++;
    const tailRemaining = Math.max(0, remaining - headInkRef.current);
    const p = Math.max(0, Math.min(1, 1 - tailRemaining / tailInkRef.current));
    setProgress(p);
    if (p >= SUCCESS_AT && !solvedRef.current) {
      solvedRef.current = true;
      setSolved(true);
      playFeedback(true);
    }
  }, []);

  /** Maskeleri kur (font yüklendikten sonra çağrılır) */
  const build = useCallback(() => {
    // 1) yalın hâli çiz, ortala
    const probe = drawGlyph(rule.iso, 0);
    if (probe.right < 0) return;                       // font yok / boş glif
    const isoDx = Math.round((CW - probe.right) / 2);  // yatayda ortala
    const iso = drawGlyph(rule.iso, isoDx);
    const d = iso.data;
    const N = CW * CH;

    // 2) mürekkep haritası + BAĞLI BİLEŞENLER
    //    Neden: (a) NOKTALAR ayrı küçük lekelerdir ve başta hâlinde de bulunur
    //    → asla silinmemeli (Cim'in ve Be'nin noktası siliniyordu). (b) Kuyruk
    //    ucu yukarı kıvrıldığı için düz kesik çizgisinin üstünde kalıp yeşil
    //    şerit bırakıyordu → kesikten sonra BAŞTAN KOPAN küçük parçalar da
    //    kuyruğa katılır. İkisi de bileşen analiziyle çözülür.
    const ink = new Uint8Array(N);
    for (let i = 0; i < N; i++) ink[i] = d[i * 4 + 3] > 40 ? 1 : 0;

    const labelComponents = (src: Uint8Array) => {
      const comp = new Int32Array(N).fill(-1);
      const sizes: number[] = [];
      const stack = new Int32Array(N);
      for (let start = 0; start < N; start++) {
        if (!src[start] || comp[start] !== -1) continue;
        const id = sizes.length;
        let sp = 0, size = 0;
        stack[sp++] = start;
        comp[start] = id;
        while (sp > 0) {
          const i = stack[--sp];
          size++;
          const x = i % CW, y = (i / CW) | 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
              const j = ny * CW + nx;
              if (src[j] && comp[j] === -1) { comp[j] = id; stack[sp++] = j; }
            }
          }
        }
        sizes.push(size);
      }
      let main = -1, best = -1;
      for (let k = 0; k < sizes.length; k++) if (sizes[k] > best) { best = sizes[k]; main = k; }
      return { comp, sizes, main };
    };

    // Ana gövde = en büyük bileşen; kalan küçük lekeler = NOKTALAR (korunur)
    const c1 = labelComponents(ink);

    // 3) kuyruk çekirdeği = ANA GÖVDE ∧ kuyruk bölgesi (noktalar hariç)
    const bw = iso.right - iso.left, bh = iso.bottom - iso.top;
    const cutY = Math.round(iso.top + bh * rule.zone.at);
    const cutX = Math.round(iso.left + bw * rule.zone.at);
    const tail = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!ink[i] || c1.comp[i] !== c1.main) continue;   // nokta ise atla
      const x = i % CW, y = (i / CW) | 0;
      if (rule.zone.dir === "alt" ? y >= cutY : x <= cutX) tail[i] = 1;
    }

    // 4) kesikten sonra baştan KOPAN parçalar da kuyruktur (kıvrık uçlar)
    const head0 = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (ink[i] && c1.comp[i] === c1.main && !tail[i]) head0[i] = 1;
    const c2 = labelComponents(head0);
    for (let i = 0; i < N; i++) {
      if (head0[i] && c2.comp[i] !== c2.main) tail[i] = 1; // ana baştan kopmuş → kuyruk
    }

    // 4b) TERSİ: kuyruk gövdesinden KOPUK küçük kırmızı lekeler başa geri döner.
    //     (Sad/Dad'ın halkasının sol ucu düz kesiğin soluna taşıp kopuk bir
    //     kırmızı çentik bırakıyordu — harfin başı gibi görünmüyordu.)
    const c3 = labelComponents(tail);
    for (let i = 0; i < N; i++) {
      if (tail[i] && c3.comp[i] !== c3.main) tail[i] = 0;
    }

    // 5) maske + kırmızı vurgu (glifin kendi yumuşak kenarları korunur)
    const tailMask = mkCanvas();
    const tmCtx = tailMask.getContext("2d")!;
    const tImg = tmCtx.createImageData(CW, CH);
    const tint = mkCanvas();
    const tgCtx = tint.getContext("2d")!;
    const rImg = tgCtx.createImageData(CW, CH);
    let tailInk = 0, headInk = 0;
    const headFlags = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!ink[i]) continue;
      const a = d[i * 4 + 3];
      if (tail[i]) {
        tailInk++;
        tImg.data[i * 4] = d[i * 4]; tImg.data[i * 4 + 1] = d[i * 4 + 1];
        tImg.data[i * 4 + 2] = d[i * 4 + 2]; tImg.data[i * 4 + 3] = a;
        rImg.data[i * 4] = 220; rImg.data[i * 4 + 1] = 38;
        rImg.data[i * 4 + 2] = 38; rImg.data[i * 4 + 3] = a;
      } else {
        headInk++;
        headFlags[i] = 1;
      }
    }
    tmCtx.putImageData(tImg, 0, 0);
    tgCtx.putImageData(rImg, 0, 0);

    glyphRef.current = iso.canvas;
    tailTintRef.current = tint;
    tailMaskRef.current = tailMask;
    strokeRef.current = mkCanvas();
    limitedRef.current = mkCanvas();
    headMaskDataRef.current = headFlags;
    tailInkRef.current = tailInk;
    headInkRef.current = headInk;

    solvedRef.current = false;
    setSolved(false);
    setProgress(0);
    setReady(tailInk > 200); // anlamlı bir kuyruk çıkmadıysa oyunu gösterme
    compose();
  }, [rule.iso, rule.zone.dir, rule.zone.at, compose]);

  const reset = useCallback(() => {
    const s = strokeRef.current;
    if (s) s.getContext("2d")!.clearRect(0, 0, CW, CH);
    solvedRef.current = false;
    setSolved(false);
    setProgress(0);
    compose();
  }, [compose]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        await document.fonts.load(FONT, rule.iso + rule.init);
        await document.fonts.ready;
      } catch { /* ignore */ }
      if (alive) build();
    };
    run();
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [build, rule.iso, rule.init]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * CW,
      y: ((e.clientY - r.top) / r.height) * CH,
    };
  };

  /** O noktada BAŞ (kalacak kısım) mı var? — uyarı için. Fırça yarıçapı kadar
   *  bir alan taranır ki çocuk başa değdiğinde hemen uyarılsın. */
  const overHead = (x: number, y: number) => {
    const m = headMaskDataRef.current;
    if (!m) return false;
    const cx = Math.round(x), cy = Math.round(y), r = Math.round(BRUSH * 0.7);
    for (let dy = -r; dy <= r; dy += 3) {
      for (let dx = -r; dx <= r; dx += 3) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
        if (m[ny * CW + nx]) return true;
      }
    }
    return false;
  };

  const paintStroke = (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
    const s = strokeRef.current;
    if (!s) return;
    const g = s.getContext("2d")!;
    g.strokeStyle = "#000";
    g.fillStyle = "#000";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = BRUSH * 2;
    g.beginPath();
    g.moveTo(from?.x ?? to.x, from?.y ?? to.y);
    g.lineTo(to.x, to.y);
    g.stroke();
    g.beginPath();
    g.arc(to.x, to.y, BRUSH, 0, Math.PI * 2);
    g.fill();
  };

  const schedule = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      compose();
      measure();
    });
  };

  const flagHint = () => {
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1600);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (solved || !ready) return;
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    lastRef.current = p;
    if (overHead(p.x, p.y)) flagHint();
    paintStroke(null, p);
    schedule();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || solved) return;
    const p = pos(e);
    if (overHead(p.x, p.y)) flagHint();
    paintStroke(lastRef.current, p);
    lastRef.current = p;
    schedule();
  };
  const onUp = () => { drawingRef.current = false; lastRef.current = null; };

  return (
    <div className="rounded-2xl border-2 border-primary/25 bg-card p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-foreground">{rule.name}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
          solved ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
        )}>
          {solved ? "✓ başardın!" : `✋ kırmızıyı sil`}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[260px]">
        {/* Başarınca beliren hedef (başta hâli) */}
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-success/10 transition-opacity duration-500",
          solved ? "opacity-100" : "pointer-events-none opacity-0",
        )}>
          <span className="font-arabic text-6xl leading-none text-primary" dir="rtl">{rule.init}</span>
          <span className="mt-3 text-[11px] font-extrabold text-success">
            İşte {rule.name}&apos;in başta hâli! 🎉
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ width: "100%", height: H, touchAction: "none" }}
          className={cn(
            "relative rounded-xl bg-emerald-50/60 transition-opacity duration-500",
            solved ? "pointer-events-none opacity-0" : "cursor-grab active:cursor-grabbing",
          )}
          aria-label={`${rule.name} harfinin ${rule.tailName}ını parmağınla sil`}
        />

        {/* Başa dokununca uyarı — DOĞRU şeyi öğretir: baş kalacak */}
        {hint && !solved && (
          <span className="pointer-events-none absolute inset-x-2 top-2 rounded-lg bg-foreground/85 px-2 py-1 text-center text-[11px] font-extrabold text-background animate-fade-in">
            🚫 Orası kalacak! Sadece kırmızı kısmı sil
          </span>
        )}
      </div>

      {/* İlerleme + tekrar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", solved ? "bg-success" : "bg-warning")}
            style={{ width: `${Math.round(Math.min(1, progress / SUCCESS_AT) * 100)}%` }}
          />
        </div>
        <button
          onClick={reset}
          className="shrink-0 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground active:scale-95"
        >
          ↺ tekrar
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] font-bold leading-snug text-foreground">
        {solved
          ? rule.say
          : `KIRMIZI olan ${rule.tailName} — parmağınla ovala ve sil. Yeşil kısım (${rule.keepName}) kalacak!`}
      </p>
    </div>
  );
}
