import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { getTopic } from "@/data/subjects";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { Volume2, Check, X, Eye, SkipForward } from "lucide-react";
import {
  pickNextLetterFromTopic,
  recordSrsAnswer,
  getTopicSrs,
  useSrsTick,
  type Level,
} from "@/data/srs";
import { isTopicUnlocked, getUnlockedItemsOf } from "@/lib/unlock";
import { cn } from "@/lib/utils";
import type { ContentItem, SubjectId } from "@/data/types";

const NS = "quiz" as const;

const Flashcard = () => {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const topic = getTopic((subjectId as SubjectId) || "elifba", topicId || "");
  useSrsTick(NS);

  // Flashcard, test gibi yalnızca AÇILAN bölüm harflerini sorar (kilitli
  // bölümler hem testte hem flashcardta gizli kalır — tutarlı müfredat).
  const tick = useSrsTick(NS);
  const items = useMemo(
    () => (topic ? getUnlockedItemsOf(topic) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, tick],
  );
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState(0);
  const [done, setDone] = useState(0);
  const startRef = useRef<number>(0);
  const dragStartRef = useRef<number | null>(null);
  const lastDragRef = useRef(0);
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

  // Kartı çevir; cevap görünürken sesi otomatik çal (bir dokunuş azalır)
  const flip = () => {
    if (busy) return;
    if (!flipped && current) playItem(current);
    setFlipped(!flipped);
  };

  const answer = async (correct: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    const responseMs = Date.now() - startRef.current;
    await recordSrsAnswer(NS, topic!.id, current.id, correct, { responseMs });
    await playFeedback(correct);
    setDone((d) => d + 1);
    setDrag(correct ? 600 : -600);
    setTimeout(() => {
      pickNext();
      setBusy(false);
    }, 350);
  };

  // Klavye kısayolları
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
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
    lastDragRef.current = Math.abs(d);
    if (Math.abs(d) > 100) answer(d > 0);
    else setDrag(0);
  };

  // Kaydırma sonrası gelen click kartı yanlışlıkla çevirmesin
  const onCardClick = () => {
    if (lastDragRef.current > 15) { lastDragRef.current = 0; return; }
    flip();
  };

  const level = current ? (getTopicSrs(NS, topic!.id)[current.id]?.level || 1) as Level : 1;
  const dragOpacity = Math.min(Math.abs(drag) / 120, 1);

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

        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold">
          <span className={cn(
            "rounded-full px-2.5 py-0.5 border",
            level === 1 && "bg-info/10 border-info/40 text-info",
            level === 2 && "bg-warning/10 border-warning/40 text-warning",
            level === 3 && "bg-secondary border-secondary text-secondary-foreground",
            level === 4 && "bg-success/10 border-success/40 text-success",
          )}>
            Seviye {level} {"⭐".repeat(level)}
          </span>
          <span className="rounded-full px-2.5 py-0.5 border border-border bg-card text-muted-foreground">
            Bu oturum: {done} kart
          </span>
        </div>

        {current && (
          <>
            <div
              className="perspective-1000 relative h-[min(420px,58svh)] mb-4 select-none"
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
                onClick={onCardClick}
                onKeyDown={(e) => { if (e.key === "Enter") flip(); }}
                className={cn(
                  "relative w-full h-full transform-3d transition-transform duration-500 cursor-pointer",
                  flipped && "rotate-y-180",
                )}
                aria-label="Kartı çevir"
              >
                {/* Ön yüz */}
                <div className="absolute inset-0 backface-hidden rounded-3xl bg-card border-4 border-primary/25 shadow-elegant flex flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 flex items-center justify-center px-4">
                    <span className="font-arabic text-emerald-800 leading-[1.6] text-[clamp(5rem,24vw,8rem)]">
                      {current.emoji}
                    </span>
                  </div>
                  <div className="shrink-0 pb-5 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-xs font-extrabold text-muted-foreground">
                      👆 Karta dokun — cevabı gör
                    </span>
                  </div>
                </div>
                {/* Arka yüz */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-50 border-4 border-emerald-300 shadow-elegant flex flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-4">
                    <span className="font-arabic text-emerald-800 leading-[1.6] text-6xl">{current.emoji}</span>
                    <span className="text-4xl font-extrabold text-emerald-950">{current.translit || current.label}</span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); playItem(current); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); playItem(current); } }}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white font-extrabold shadow-soft hover:scale-105 transition-bouncy cursor-pointer"
                    >
                      <Volume2 className="h-5 w-5" /> Tekrar Dinle
                    </div>
                  </div>
                  <div className="shrink-0 pb-4 text-center text-[11px] font-bold text-emerald-700/70">
                    ← sola kaydır: Bilmiyorum • sağa kaydır: Biliyorum →
                  </div>
                </div>
              </div>

              {/* Kaydırma geri bildirimi */}
              {flipped && drag > 12 && (
                <div
                  className="pointer-events-none absolute top-4 right-4 z-20 rotate-6 rounded-2xl bg-success px-4 py-2 text-success-foreground font-extrabold shadow-card"
                  style={{ opacity: dragOpacity }}
                >
                  ✓ Biliyorum
                </div>
              )}
              {flipped && drag < -12 && (
                <div
                  className="pointer-events-none absolute top-4 left-4 z-20 -rotate-6 rounded-2xl bg-destructive px-4 py-2 text-destructive-foreground font-extrabold shadow-card"
                  style={{ opacity: dragOpacity }}
                >
                  ✗ Bilmiyorum
                </div>
              )}
            </div>

            {/* Sabit yükseklikte aksiyon alanı — kart çevrilince ekran zıplamaz */}
            <div className="h-20">
              {!flipped ? (
                <button
                  onClick={flip}
                  className="flex h-full w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground shadow-card transition-bouncy hover:-translate-y-0.5 active:scale-95"
                >
                  <Eye className="h-6 w-6" /> Cevabı Gör
                </button>
              ) : (
                <div className="grid h-full grid-cols-2 gap-3 animate-fade-in">
                  <button
                    onClick={() => answer(false)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-destructive text-lg font-extrabold text-destructive-foreground shadow-card transition-bouncy hover:-translate-y-1 disabled:opacity-50"
                  >
                    <X className="h-7 w-7" /> Bilmiyorum
                  </button>
                  <button
                    onClick={() => answer(true)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-success text-lg font-extrabold text-success-foreground shadow-card transition-bouncy hover:-translate-y-1 disabled:opacity-50"
                  >
                    <Check className="h-7 w-7" /> Biliyorum
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-center">
              <button
                onClick={pickNext}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-card border-2 border-border px-4 py-2 text-xs font-extrabold text-muted-foreground shadow-soft disabled:opacity-50"
              >
                <SkipForward className="h-3.5 w-3.5" /> Pas geç
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
