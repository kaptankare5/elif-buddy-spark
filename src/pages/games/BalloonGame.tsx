import { useEffect, useRef, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { LangToggle } from "@/components/LangToggle";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { gamePool, shuffle, pickN } from "./_shared";
import { recordLetterMastery } from "@/data/srs";
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";

interface Balloon {
  uid: string;
  item: ContentItem;
  x: number; // 0-100 (yüzde)
  y: number; // 0-100 başlangıç y
  speed: number;
  popped: boolean;
}

const COLORS = ["bg-topic-pink", "bg-topic-blue", "bg-topic-orange", "bg-topic-purple", "bg-success", "bg-warning"];

const BalloonGame = () => {
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const newRound = () => {
    const pool = gamePool();
    const tgt = pickNextGameItem(pool) || pool[0];
    setTarget(tgt);
    const distractors = pickN(pool.filter((p) => p.id !== tgt.id), 4);
    const all = shuffle([tgt, ...distractors]);
    setBalloons(all.map((it, i) => ({
      uid: `${it.id}-${Date.now()}-${i}`,
      item: it,
      x: 10 + (i * 18) + (Math.random() * 6 - 3),
      y: 100 + i * 15,
      speed: 0.18 + Math.random() * 0.12,
      popped: false,
    })));
    playItem(tgt);
  };

  // Animasyon
  useEffect(() => {
    const tick = (ts: number) => {
      if (!lastTickRef.current) lastTickRef.current = ts;
      const dt = Math.min(50, ts - lastTickRef.current);
      lastTickRef.current = ts;
      setBalloons((bs) => bs.map((b) => b.popped ? b : { ...b, y: b.y - b.speed * dt * 0.06 }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Roundu kontrol: tüm balonlar geçti mi?
  useEffect(() => {
    if (!balloons.length) return;
    if (balloons.every((b) => b.popped || b.y < -20)) {
      // round bitti
      setTimeout(newRound, 400);
    }
  }, [balloons]);

  useEffect(() => { newRound(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const h = () => { setScore(0); setMisses(0); newRound(); };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pop = async (b: Balloon) => {
    if (b.popped || !target) return;
    setBalloons((bs) => bs.map((x) => x.uid === b.uid ? { ...x, popped: true } : x));
    const correct = b.item.id === target.id;
    recordLetterMastery(target.id, correct);
    recordGameAnswer(target, correct);
    if (correct) {
      setScore((s) => s + 1);
      await playFeedback(true);
      setTimeout(newRound, 350);
    } else {
      setMisses((m) => m + 1);
      await playFeedback(false);
    }
  };

  const reset = () => { setScore(0); setMisses(0); newRound(); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-info/20 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🎈 Balon Patlatma" backTo="/oyunlar" centered onReset={reset} />
        <div className="flex justify-center mb-3"><LangToggle /></div>

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Doğru</div>
            <div className="text-xl font-extrabold text-success">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-destructive/30">
            <div className="text-[10px] font-bold text-muted-foreground">Yanlış</div>
            <div className="text-xl font-extrabold text-destructive">{misses}</div>
          </div>
          <button onClick={() => target && playItem(target)} className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center gap-1">
            <Volume2 className="h-4 w-4" /> Dinle
          </button>
        </div>

        <div className="bg-card rounded-2xl p-3 mb-3 shadow-card border-2 border-primary/20 text-center">
          <p className="text-xs font-bold text-muted-foreground">Sesi dinle, doğru balonu patlat:</p>
          <button onClick={() => target && playItem(target)} className="text-5xl mt-1" aria-label="Tekrar dinle">🔊</button>
        </div>

        <div className="relative bg-gradient-to-b from-info/10 to-info/30 rounded-3xl shadow-card border-4 border-info/30 overflow-hidden" style={{ height: "60vh" }}>
          {balloons.map((b, i) => (
            <button
              key={b.uid}
              onClick={() => pop(b)}
              disabled={b.popped}
              className={cn(
                "absolute -translate-x-1/2 transition-opacity",
                b.popped && "opacity-0 pointer-events-none",
              )}
              style={{ left: `${b.x}%`, bottom: `${b.y}%` }}
            >
              <div className={cn(
                "w-16 h-20 rounded-[50%] flex items-center justify-center shadow-card",
                COLORS[i % COLORS.length],
              )}>
                <span className="text-3xl"><EmojiView value={b.item.emoji} /></span>
              </div>
              <div className="w-px h-4 bg-foreground/40 mx-auto" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default BalloonGame;
