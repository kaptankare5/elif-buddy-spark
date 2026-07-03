import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { getSubject, getTopic } from "@/data/subjects";
import { PageHeader } from "@/components/PageHeader";
import { EmojiView } from "@/components/EmojiView";
import { playItem, playFeedback, playSpeech } from "@/lib/audio";
import { Volume2, ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentItem, SubjectId } from "@/data/types";
import { MathPractice } from "@/components/MathPractice";
import NeckGame from "@/pages/kavram/NeckGame";
import SizeGame from "@/pages/kavram/SizeGame";
import {
  pickNextLetter,
  pickNextLetterFromTopic,
  recordSrsAnswer,
  getTopicSrs,
  getCloudSrsState,
  resetTopicSrs,
  useSrsTick,
  type Level,
  type SrsState,
} from "@/data/srs";
import { cn } from "@/lib/utils";
import { useAge, itemsForAge } from "@/lib/age";
import { useSubscription } from "@/hooks/useSubscription";
import { isTopicFree } from "@/lib/premium";
import { useAuth } from "@/hooks/useAuth";

type Mode = "pratik" | "kart";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function buildQuestion(items: ContentItem[], targetId: string) {
  const target = items.find((it) => it.id === targetId) || items[0];
  const wrongs = shuffle(items.filter((it) => it.id !== target.id)).slice(0, 3);
  return { target, options: shuffle([target, ...wrongs]) };
}

const NS = "quiz" as const;

const Topic = () => {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const subject = getSubject(subjectId as SubjectId);
  const topic = getTopic(subjectId as SubjectId, topicId || "");
  const [mode, setMode] = useState<Mode>("pratik");
  const [idx, setIdx] = useState(0);
  const tick = useSrsTick(NS);

  const [q, setQ] = useState<{ target: ContentItem; options: ContentItem[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const questionStartRef = useRef<number>(0);
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [cloudSrs, setCloudSrs] = useState<SrsState | null>(null);
  const [cloudLoading, setCloudLoading] = useState<boolean>(!!uid);

  const [age] = useAge();
  const items = useMemo(() => itemsForAge(topic?.items || [], age), [topic, age]);
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  useEffect(() => {
    setIdx(0);
    setQ(null);
    setPicked(null);
    setScore(0);
  }, [topicId, mode]);

  useEffect(() => {
    if (mode !== "pratik" || !topic || itemIds.length === 0 || q) return;
    if (topic.interactiveGame) return;
    // Local-first: ilerleme her zaman cihazdan okunur
    const tid = pickNextLetter(NS, topic.id, itemIds);
    setQ(buildQuestion(items, tid));
    setPicked(null);
    questionStartRef.current = Date.now();
  }, [mode, topic, itemIds, q, items]);

  // Cloud okuma kaldırıldı (local-first). Yazma srs.ts içinde devam ediyor.
  useEffect(() => {
    setCloudSrs(null);
    setCloudLoading(false);
  }, [uid]);

  useEffect(() => {
    if (mode === "pratik" && q?.target) playItem(q.target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.target?.id, mode]);

  const { isPremium } = useSubscription();

  if (!subject || !topic) return <Navigate to="/" replace />;

  // Premium konuya kilitli erişim
  if (!isTopicFree(subject.id, topic.id) && !isPremium) {
    return <Navigate to="/abonelik" replace />;
  }

  // İnteraktif anasınıfı oyunları
  if (topic.interactiveGame === "neck") return <NeckGame />;
  if (topic.interactiveGame === "size") return <SizeGame />;

  // Matematik özel pratiği
  if (topic.practiceMode === "math") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-accent/30 to-background">
        <main className="container mx-auto max-w-xl px-4 pb-16">
          <PageHeader title={topic.title} backTo={`/konu/${subject.id}`} centered />
          <MathPractice topic={topic} />
        </main>
      </div>
    );
  }

  const srs = getTopicSrs(NS, topic.id);
  const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const id of itemIds) {
    const lvl = (srs[id]?.level || 1) as Level;
    levelCount[lvl] += 1;
  }
  void tick;

  // === KART MODU (yazısız) ===
  if (mode === "kart") {
    const item = items[idx];
    const total = items.length;
    const next = () => setIdx((i) => (i + 1) % total);
    const prev = () => setIdx((i) => (i - 1 + total) % total);
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
        <main className="container mx-auto max-w-xl px-4 pb-16">
          <PageHeader title={topic.title} backTo={`/konu/${subject.id}`} centered />
          <ModeSwitch mode={mode} onChange={setMode} />

          <div className="mb-3 flex items-center justify-center gap-1 text-sm font-bold text-muted-foreground">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={cn("h-2 w-2 rounded-full", i === idx ? "bg-primary" : "bg-muted")} />
            ))}
          </div>

          <button
            onClick={() => playItem(item)}
            className="w-full bg-card rounded-3xl p-8 shadow-card border-4 border-primary/20 transition-bouncy hover:scale-[1.02] active:scale-95 animate-bounce-in min-h-[55vh] flex flex-col items-center justify-center gap-6"
            key={item.id}
            aria-label="Dinle"
          >
            {item.emoji && <div className="text-[140px] leading-none"><EmojiView value={item.emoji} /></div>}
            <div className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground font-bold shadow-soft text-xl">
              <Volume2 className="h-6 w-6" />
            </div>
          </button>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={prev} className="flex items-center justify-center gap-2 rounded-2xl bg-card border-2 border-border/60 p-5 shadow-soft transition-bouncy hover:scale-105 active:scale-95" aria-label="Önceki">
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button onClick={next} className="flex items-center justify-center gap-2 rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft transition-bouncy hover:scale-105 active:scale-95" aria-label="Sonraki">
              <ChevronRight className="h-8 w-8" />
            </button>
          </div>
        </main>
      </div>
    );
  }

  // === PRATİK (yazısız) ===
  const choose = async (opt: ContentItem) => {
    if (!q || picked) return;
    setPicked(opt.id);
    const correct = opt.id === q.target.id;
    if (correct) setScore((s) => s + 1);
    const responseMs = questionStartRef.current ? Date.now() - questionStartRef.current : undefined;
    await recordSrsAnswer(NS, topic.id, q.target.id, correct, { responseMs });
    await playFeedback(correct);
    setTimeout(() => setQ(null), correct ? 700 : 2200);
  };

  const askAgain = () => {
    if (!q) return;
    // "Hangisi ___?" şeklinde sesli sor
    playSpeech(`Hangisi ${q.target.speech}?`, q.target.lang);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader
          title={topic.title}
          backTo={`/konu/${subject.id}`}
          centered
          onReset={() => {
            resetTopicSrs(NS, topic.id);
            setScore(0);
            setQ(null);
          }}
        />

        <ModeSwitch mode={mode} onChange={setMode} />

        {/* Seviye barı — küçük göstergeler */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((l) => (
            <div
              key={l}
              className={cn(
                "rounded-lg p-1.5 text-center shadow-soft border",
                l === 1 && "bg-info/10 border-info/40",
                l === 2 && "bg-warning/10 border-warning/40",
                l === 3 && "bg-secondary/40 border-secondary",
                l === 4 && "bg-success/10 border-success/40",
              )}
            >
              <div className="text-[10px] leading-none">{"⭐".repeat(l)}</div>
              <div className="text-xs font-extrabold text-foreground mt-0.5">{levelCount[l as Level]}</div>
            </div>
          ))}
        </div>


        {q && (
          <>
            <div className="bg-card rounded-3xl p-6 shadow-card border-4 border-primary/20 mb-4 text-center animate-bounce-in" key={q.target.id}>
              <button
                onClick={askAgain}
                className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105 animate-pulse"
                aria-label="Tekrar dinle"
              >
                <Volume2 className="h-8 w-8" />
                <span className="text-2xl">🎧</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt) => {
                const isCorrect = !!picked && opt.id === q.target.id;
                const isWrong = picked === opt.id && opt.id !== q.target.id;
                const showLabel = opt.lang === "en";
                return (
                  <button
                    key={opt.id}
                    onClick={() => choose(opt)}
                    className={cn(
                      "aspect-square rounded-3xl flex flex-col items-center justify-center gap-1 shadow-card border-4 transition-bouncy bg-card border-primary/20 hover:-translate-y-1",
                      isCorrect && "bg-success border-success animate-pop",
                      isWrong && "bg-destructive border-destructive animate-shake",
                    )}
                    aria-label={opt.label}
                  >
                    {opt.emoji && <span className={cn("leading-none", showLabel ? "text-5xl" : "text-7xl")}><EmojiView value={opt.emoji} /></span>}
                    {showLabel && (
                      <span className={cn("text-lg font-extrabold", (isCorrect || isWrong) ? "text-white" : "text-foreground")}>
                        {opt.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

          </>
        )}
      </main>
    </div>
  );
};

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="mb-5 flex gap-3 rounded-3xl bg-primary/10 p-2 shadow-soft border-2 border-primary/30">
      <button
        onClick={() => onChange("pratik")}
        className={cn(
          "flex-1 rounded-2xl py-4 text-3xl flex items-center justify-center gap-2 font-extrabold transition-bouncy",
          mode === "pratik"
            ? "bg-primary text-primary-foreground shadow-elegant scale-105"
            : "bg-card text-muted-foreground hover:scale-[1.02]"
        )}
        aria-label="Pratik"
      >
        🎯
      </button>
      <button
        onClick={() => onChange("kart")}
        className={cn(
          "flex-1 rounded-2xl py-4 text-3xl flex items-center justify-center gap-2 font-extrabold transition-bouncy",
          mode === "kart"
            ? "bg-primary text-primary-foreground shadow-elegant scale-105"
            : "bg-card text-muted-foreground hover:scale-[1.02]"
        )}
        aria-label="Kartlar"
      >
        🃏
      </button>

    </div>
  );
}

export default Topic;
