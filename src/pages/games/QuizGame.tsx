import { useEffect, useRef, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { LangToggle } from "@/components/LangToggle";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { gamePool, shuffle } from "./_shared";
import { recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";

interface Q { target: ContentItem; options: ContentItem[]; }

function makeQ(): Q {
  const pool = gamePool();
  const target = pool[Math.floor(Math.random() * pool.length)];
  const wrongs = shuffle(pool.filter((p) => p.id !== target.id)).slice(0, 3);
  return { target, options: shuffle([target, ...wrongs]) };
}

const QuizGame = () => {
  const [q, setQ] = useState<Q>(() => makeQ());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(60);
  const questionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setTime((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    playItem(q.target);
    questionStartRef.current = Date.now();
  }, [q.target.id]);

  useEffect(() => {
    const h = () => { setScore(0); setTime(60); setQ(makeQ()); setPicked(null); };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  }, []);

  const choose = async (item: ContentItem) => {
    if (picked || time <= 0) return;
    setPicked(item.id);
    const correct = item.id === q.target.id;
    if (correct) setScore((s) => s + 1);
    const responseMs = Date.now() - questionStartRef.current;
    recordGameAnswer(q.target, correct, { responseMs, gameId: "quiz" });
    await playFeedback(correct);
    setTimeout(() => { setQ(makeQ()); setPicked(null); }, correct ? 700 : 1800);
  };

  const ended = time <= 0;
  const reset = () => { setScore(0); setTime(60); setQ(makeQ()); setPicked(null); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="⚡ Hızlı Quiz" backTo="/oyunlar" centered onReset={reset} />
        <div className="flex justify-center mb-3"><LangToggle /></div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-warning/30">
            <div className="text-xs text-muted-foreground font-bold">Puan</div>
            <div className="text-2xl font-extrabold text-success">⭐ {score}</div>
          </div>
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-info/30">
            <div className="text-xs text-muted-foreground font-bold">Süre</div>
            <div className="text-2xl font-extrabold text-info">⏱ {time}s</div>
          </div>
        </div>

        {ended ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-card border-4 border-success/40 animate-bounce-in">
            <div className="text-7xl mb-3">🏆</div>
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Tebrikler!</h2>
            <p className="text-lg text-muted-foreground mb-4">Skorun: <span className="text-success font-extrabold">{score}</span></p>
            <button onClick={reset} className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-card transition-bouncy hover:scale-105">Tekrar Oyna</button>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-3xl p-6 shadow-card border-4 border-primary/20 mb-4 text-center animate-bounce-in" key={q.target.id}>
              <p className="text-sm font-bold text-muted-foreground mb-2">Hangisi?</p>
              <button onClick={() => playItem(q.target)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105">
                <Volume2 className="h-5 w-5" /> Tekrar Dinle
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt) => {
                const isCorrect = !!picked && opt.id === q.target.id;
                const isWrong = picked === opt.id && opt.id !== q.target.id;
                return (
                  <button key={opt.id} onClick={() => choose(opt)}
                    className={cn(
                      "aspect-square rounded-3xl flex items-center justify-center shadow-card border-4 transition-bouncy bg-card border-primary/20 hover:-translate-y-1",
                      isCorrect && "bg-success border-success animate-pop",
                      isWrong && "bg-destructive border-destructive animate-shake",
                    )}>
                    <span className="text-7xl"><EmojiView value={opt.emoji} /></span>
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

export default QuizGame;
