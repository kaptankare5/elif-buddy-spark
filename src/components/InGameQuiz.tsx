import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { gamePool, pickN, shuffle } from "@/pages/games/_shared";
import { playItem, playFeedback } from "@/lib/audio";
import { recordInGameTest } from "@/lib/gameProgress";
import { EmojiView } from "@/components/EmojiView";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/data/types";

// Oyun-içi gerçek mini test — normal modda oyunların arasında çıkar.
// Sesi dinle, doğru harfi seç. Cevap ilerlemeye (SRS) yazılır.
// Tam ekran overlay: yüksek z-index + olay durdurma → altındaki oyuna
// tıklama sızmaz (test sorusu her zaman güvenle tıklanır).
export function InGameQuiz({ onDone }: { onDone: (correct: boolean) => void }) {
  const quiz = useMemo(() => {
    const pool = gamePool();
    if (pool.length < 2) return null;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const wrongs = pickN(
      pool.filter((p) => p.id !== target.id && p.emoji !== target.emoji),
      Math.min(3, pool.length - 1),
    );
    return { target, options: shuffle([target, ...wrongs]) };
  }, []);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (quiz) { const t = setTimeout(() => playItem(quiz.target), 150); return () => clearTimeout(t); }
    onDone(false); // havuz yetersizse sessizce kapan
  }, [quiz, onDone]);

  if (!quiz) return null;

  const choose = async (opt: ContentItem) => {
    if (picked) return;
    setPicked(opt.id);
    const correct = opt.id === quiz.target.id;
    recordInGameTest(quiz.target, correct);
    await playFeedback(correct);
    setTimeout(() => onDone(correct), correct ? 800 : 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 select-none touch-none"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-3xl bg-card border-4 border-info/40 shadow-elegant p-5 animate-bounce-in">
        <div className="text-center text-xs font-extrabold text-info mb-1">📝 Mini Test</div>
        <p className="text-center text-sm font-bold text-muted-foreground mb-3">Sesi dinle, doğru harfi seç</p>
        <div className="flex justify-center mb-4">
          <button
            onClick={() => playItem(quiz.target)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105"
          >
            <Volume2 className="h-6 w-6" />
            <span className="text-lg">{quiz.target.translit || quiz.target.label}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quiz.options.map((opt) => {
            const isCorrect = !!picked && opt.id === quiz.target.id;
            const isWrong = picked === opt.id && opt.id !== quiz.target.id;
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt)}
                disabled={!!picked}
                className={cn(
                  "aspect-[4/3] rounded-2xl flex items-center justify-center shadow-card border-4 transition-bouncy bg-card border-primary/20 active:scale-95",
                  isCorrect && "bg-success border-success animate-pop",
                  isWrong && "bg-destructive border-destructive animate-shake",
                )}
              >
                <span className={cn(
                  "font-arabic text-5xl leading-[1.5]",
                  (isCorrect || isWrong) ? "text-white" : "text-emerald-800",
                )}>
                  <EmojiView value={opt.emoji} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
