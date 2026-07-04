import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { getTopic } from "@/data/subjects";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { Volume2, Check, X, RotateCcw } from "lucide-react";
import {
  pickNextLetterFromTopic,
  recordSrsAnswer,
  getTopicSrs,
  useSrsTick,
  type Level,
} from "@/data/srs";
import { isTopicUnlocked } from "@/lib/unlock";
import { cn } from "@/lib/utils";
import type { ContentItem, SubjectId } from "@/data/types";

const NS = "quiz" as const;

const Flashcard = () => {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const topic = getTopic((subjectId as SubjectId) || "elifba", topicId || "");
  useSrsTick(NS);

  const items = topic?.items || [];
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState(0);
  const startRef = useRef<number>(0);
  const dragStartRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);

  const pickNext = () => {
    if (itemIds.length === 0) return;
    const srs = getTopicSrs(NS, topic!.id);
    const id = pickNextLetterFromTopic(srs, itemIds);
    setCurrentId(id);
    setFlipped(false);
    setDrag(0);
    startRef.current = Date.now();
  };

  useEffect(() => {
    if (!topic) return;
    pickNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const current: ContentItem | undefined = items.find((i) => i.id === currentId);

  const answer = async (correct: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    const responseMs = Date.now() - startRef.current;
    await recordSrsAnswer(NS, topic!.id, current.id, correct, { responseMs });
    await playFeedback(correct);
    setDrag(correct ? 600 : -600);
    setTimeout(() => {
      pickNext();
      setBusy(false);
    }, 350);
  };

  // Klavye kısayolları
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowRight") answer(true);
      else if (e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, busy, flipped]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!flipped) return;
    dragStartRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartRef.current === null) return;
    setDrag(e.clientX - dragStartRef.current);
  };
  const onPointerUp = () => {
    if (dragStartRef.current === null) return;
    const d = drag;
    dragStartRef.current = null;
    if (Math.abs(d) > 100) answer(d > 0);
    else setDrag(0);
  };

  const level = current ? (getTopicSrs(NS, topic!.id)[current.id]?.level || 1) as Level : 1;

  if (!topic) return <Navigate to="/" replace />;
  if (!isTopicUnlocked(topic.id)) return <Navigate to="/" replace />;
  if (topic.noPractice) return <Navigate to={`/konu/elifba/${topic.id}`} replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background">
      <main className="container mx-auto max-w-lg px-4 pb-24">
        <PageHeader
          title={`${topic.title} • Flashcard`}
          backTo={`/konu/elifba/${topic.id}`}
          centered
        />

        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
          <span className={cn(
            "rounded-full px-2 py-0.5 border",
            level === 1 && "bg-info/10 border-info/40 text-info",
            level === 2 && "bg-warning/10 border-warning/40 text-warning",
            level === 3 && "bg-secondary border-secondary text-secondary-foreground",
            level === 4 && "bg-success/10 border-success/40 text-success",
          )}>
            Seviye {level} {"⭐".repeat(level)}
          </span>
        </div>

        {current && (
          <>
            <div
              className="perspective-1000 h-[420px] mb-4 select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                transform: `translateX(${drag}px) rotate(${drag * 0.05}deg)`,
                transition: dragStartRef.current === null ? "transform 0.35s ease" : "none",
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setFlipped((f) => !f)}
                onKeyDown={(e) => { if (e.key === "Enter") setFlipped((f) => !f); }}
                className={cn(
                  "relative w-full h-full transform-3d transition-transform duration-500 cursor-pointer",
                  flipped && "rotate-y-180",
                )}
                aria-label="Kartı çevir"
              >
                {/* Ön yüz */}
                <div className="absolute inset-0 backface-hidden rounded-3xl bg-card border-4 border-primary/30 shadow-elegant flex flex-col items-center justify-center p-6">
                  <div className="text-[10rem] font-arabic text-emerald-800 leading-none">
                    {current.emoji}
                  </div>
                  <p className="mt-6 text-xs font-bold text-muted-foreground">Karta dokun • cevabı gör</p>
                </div>
                {/* Arka yüz */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-50 border-4 border-emerald-300 shadow-elegant flex flex-col items-center justify-center p-6">
                  <div className="text-6xl font-arabic text-emerald-800 mb-4">{current.emoji}</div>
                  <div className="text-3xl font-extrabold text-foreground mb-2">{current.translit || current.label}</div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); playItem(current); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); playItem(current); } }}
                    className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white font-extrabold shadow-soft hover:scale-105 transition-bouncy cursor-pointer"
                  >
                    <Volume2 className="h-5 w-5" /> Dinle
                  </div>
                  <p className="mt-6 text-[10px] font-bold text-muted-foreground">← Bilmiyorum • Biliyorum →</p>
                </div>
              </div>
            </div>

            {flipped && (
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                <button
                  onClick={() => answer(false)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-destructive p-4 text-destructive-foreground font-extrabold shadow-card transition-bouncy hover:-translate-y-1 disabled:opacity-50"
                >
                  <X className="h-6 w-6" /> Bilmiyorum
                </button>
                <button
                  onClick={() => answer(true)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-success p-4 text-success-foreground font-extrabold shadow-card transition-bouncy hover:-translate-y-1 disabled:opacity-50"
                >
                  <Check className="h-6 w-6" /> Biliyorum
                </button>
              </div>
            )}

            {!flipped && (
              <div className="rounded-2xl bg-muted/50 p-3 text-center text-xs font-bold text-muted-foreground">
                💡 Karta dokun • Cevabı gör • Sağa (biliyorum) / sola (bilmiyorum) kaydır
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <button
                onClick={pickNext}
                className="inline-flex items-center gap-1.5 rounded-full bg-card border-2 border-primary/30 px-4 py-2 text-xs font-extrabold text-primary shadow-soft"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Sonraki kart
              </button>
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <Link to={`/konu/elifba/${topic.id}`} className="text-xs font-bold text-primary underline">
            ← Konuya dön
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Flashcard;
