// ✋ SİL-ÇIKAR OYUNU — çocuk kuyruğu KENDİ PARMAĞIYLA siler.
//
// Pasif animasyon izlemek yerine çocuk eylemi kendisi yapar: yalın harfin
// kuyruğunu ovalayarak siler, silince başta hâli ortaya çıkar. Öğrenme bilimi:
// üretim etkisi (generation effect) + bedenlenmiş öğrenme — el hareketiyle
// öğrenilen kural, okunarak öğrenilenden belirgin daha kalıcıdır.
//
// Teknik: canvas'a yalın glif çizilir; parmak/fare hareketi
// globalCompositeOperation="destination-out" ile mürekkebi siler (kazı-kazan).
// KUYRUK BÖLGESİNDEKİ mürekkebin ne kadarı silindi ölçülür; eşik aşılınca
// başarı. Bölge, harfin gerçek mürekkedinden türetilir (sabit oran değil):
// glif çizildikten sonra alt-yarıdaki dolu pikseller taranır.
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TailRule } from "@/data/writingMnemonics";
import { playFeedback } from "@/lib/audio";

const W = 260;
const H = 150;
const BRUSH = 17;          // silgi yarıçapı (px) — çocuk parmağı için bol
const SUCCESS_AT = 0.72;   // kuyruk mürekkebinin bu oranı silinince başarı

export function EraseGame({ rule, onSolved }: { rule: TailRule; onSolved?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  // Kuyruk bölgesi (glifin alt yarısı) başlangıç mürekkep sayısı
  const baseInkRef = useRef(0);
  const zoneRef = useRef({ x: 0, y: 0, w: W, h: H });
  const solvedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [solved, setSolved] = useState(false);
  const [ready, setReady] = useState(false);

  // Yalın glifi canvas'a çiz + kuyruk bölgesini ölç
  const paint = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#134e3a";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `88px "Amiri Quran", "Amiri", "Scheherazade New", serif`;
    g.fillText(rule.iso, W / 2, H / 2 - 6);

    // Kuyruk bölgesi = glifin ALT YARISI (kuyruk/çanak aşağı sarkar).
    // Gerçek mürekkebe göre ölçülür → her harfte doğru çalışır.
    const zoneY = Math.round(H * 0.46);
    zoneRef.current = { x: 0, y: zoneY, w: W, h: H - zoneY };
    const z = zoneRef.current;
    const data = g.getImageData(z.x * dpr, z.y * dpr, z.w * dpr, z.h * dpr).data;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) ink++;
    baseInkRef.current = ink;
    solvedRef.current = false;
    setProgress(0);
    setSolved(false);
    setReady(true);
  }, [rule.iso]);

  // Arapça font geç yüklenebilir → yüklenince yeniden çiz (yoksa fallback serif çizilir)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try { await document.fonts.load('88px "Amiri Quran"', rule.iso); } catch { /* ignore */ }
      if (alive) paint();
    };
    run();
    return () => { alive = false; };
  }, [paint, rule.iso]);

  const measure = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || baseInkRef.current === 0) return;
    const g = cv.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const z = zoneRef.current;
    const data = g.getImageData(z.x * dpr, z.y * dpr, z.w * dpr, z.h * dpr).data;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) ink++;
    const p = Math.max(0, Math.min(1, 1 - ink / baseInkRef.current));
    setProgress(p);
    if (p >= SUCCESS_AT && !solvedRef.current) {
      solvedRef.current = true;
      setSolved(true);
      playFeedback(true);
      onSolved?.();
    }
  }, [onSolved]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const erase = (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
    const cv = canvasRef.current;
    const g = cv?.getContext("2d");
    if (!g) return;
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = BRUSH * 2;
    g.strokeStyle = "rgba(0,0,0,1)";
    g.beginPath();
    g.moveTo(from?.x ?? to.x, from?.y ?? to.y);
    g.lineTo(to.x, to.y);
    g.stroke();
    g.beginPath();
    g.arc(to.x, to.y, BRUSH, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (solved) return;
    drawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    lastRef.current = p;
    erase(null, p);
    measure();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || solved) return;
    const p = pos(e);
    erase(lastRef.current, p);
    lastRef.current = p;
    measure();
  };
  const onUp = () => { drawingRef.current = false; lastRef.current = null; };

  return (
    <div className="rounded-2xl border-2 border-primary/25 bg-card p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-foreground">{rule.name}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
          solved ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}>
          {solved ? "✓ başardın!" : `✋ ${rule.tailName}ı sil`}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[260px]">
        {/* Başarınca beliren hedef (başta hâli) — canvas'ın ALTINDA durur */}
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-success/10 transition-opacity duration-500",
          solved ? "opacity-100" : "opacity-0",
        )}>
          <span className="font-arabic text-6xl leading-none text-primary" dir="rtl">{rule.init}</span>
          <span className="mt-2 text-[11px] font-extrabold text-success">
            İşte {rule.name}&apos;in başta hâli! 🎉
          </span>
        </div>

        {/* Kazınacak katman */}
        <canvas
          ref={canvasRef}
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

        {/* Nereyi sileceğini gösteren kılavuz */}
        {!solved && ready && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 bottom-2 h-[46%] rounded-lg border-2 border-dashed border-destructive/50"
          />
        )}
      </div>

      {/* İlerleme çubuğu — ne kadar sildiğini görsün */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", solved ? "bg-success" : "bg-warning")}
            style={{ width: `${Math.round(Math.min(1, progress / SUCCESS_AT) * 100)}%` }}
          />
        </div>
        <button
          onClick={paint}
          className="shrink-0 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground active:scale-95"
        >
          ↺ tekrar
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] font-bold leading-snug text-foreground">
        {solved ? rule.say : `Aşağıdaki kesikli alanı parmağınla ovala — ${rule.name}'in ${rule.tailName}ını sil!`}
      </p>
    </div>
  );
}
