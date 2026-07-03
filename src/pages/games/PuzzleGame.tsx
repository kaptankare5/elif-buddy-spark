import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback, playSpeech } from "@/lib/audio";
import { gamePool, shuffle } from "./_shared";
import { useAge } from "@/lib/age";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";

/**
 * Yapboz — yaşa göre:
 *   3-4 yaş → 2x2  (4 parça)
 *   5-6 yaş → 3x3  (9 parça)
 * Tap-to-swap. Bittiğinde nesnenin adı seslendirilir.
 */
function gridForAge(age: number | null): number {
  if (!age || age <= 4) return 2; // 4 parça
  return 3; // 9 parça
}

const PuzzleGame = () => {
  const [age] = useAge();
  const N = gridForAge(age);

  // Yapboz için uygun olmayan tek-renk / düz şekil görsellerini ayıkla.
  // Tek ton emojiler (turuncu/mavi/sarı kareler vs.) yapbozda hep aynı parça gibi görünüyor.
  const BLOCKED_EMOJIS = new Set([
    "⬛","⬜","🟥","🟧","🟨","🟩","🟦","🟪","🟫",
    "⭕","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤",
    "🔺","🔻","🔶","🔷","🔸","🔹","▪️","▫️","◼️","◻️","◾","◽","▬","⬡",
  ]);
  const pool = useMemo(
    () => gamePool().filter((p) => p.emoji && [...p.emoji].length <= 2 && !BLOCKED_EMOJIS.has(p.emoji)),
    [],
  );
  const [item, setItem] = useState<ContentItem | null>(null);
  const [tiles, setTiles] = useState<number[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [score, setScore] = useState(0);

  const sizeRef = useRef<HTMLDivElement>(null);

  const startNew = () => {
    if (pool.length === 0) return;
    const it = pool[Math.floor(Math.random() * pool.length)];
    setItem(it);
    const total = N * N;
    let arr = Array.from({ length: total }, (_, i) => i);
    do { arr = shuffle(arr); } while (arr.every((v, i) => v === i));
    setTiles(arr);
    setFirst(null);
    setSolved(false);
  };

  useEffect(() => { startNew(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [N]);

  const tap = (i: number) => {
    if (solved) return;
    if (first === null) { setFirst(i); return; }
    if (first === i) { setFirst(null); return; }
    const next = [...tiles];
    [next[first], next[i]] = [next[i], next[first]];
    setTiles(next);
    setFirst(null);

    if (next.every((v, idx) => v === idx)) {
      setSolved(true);
      setScore((s) => s + 1);
      if (item) {
        // Olumlu ses → "Tebrikler!" → nesnenin adı
        playFeedback(true);
        setTimeout(async () => {
          await playSpeech("Tebrikler!", "tr");
          void playItem(item);
        }, 300);
      }
    }
  };

  const sayItem = () => { if (item) void playItem(item); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-warning/15 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🧩 Yapboz" backTo="/oyunlar" centered onReset={startNew} />

        <div className="mb-3 flex items-center justify-between text-sm font-bold">
          <span>⭐ {score}</span>
          <button
            onClick={sayItem}
            disabled={!item}
            className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 shadow-soft border-2 border-primary font-bold flex items-center gap-1 disabled:opacity-40"
            aria-label="Nesnenin adını dinle"
          >
            <Volume2 className="h-4 w-4" /> Dinle
          </button>
          <span className="text-muted-foreground">{N}×{N} • {age ? `${age} yaş` : ""}</span>
        </div>

        <div
          ref={sizeRef}
          className="relative mx-auto aspect-square w-full max-w-sm rounded-3xl bg-card border-4 border-warning/40 shadow-card p-2 overflow-hidden"
          style={{ ["--tile" as string]: `calc((min(100vw - 2rem, 24rem) - 1rem) / ${N})` }}
        >
          <div
            className="grid gap-1 h-full w-full"
            style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}
          >
            {tiles.map((val, idx) => {
              const row = Math.floor(val / N);
              const col = val % N;
              const correct = val === idx;
              return (
                <button
                  key={idx}
                  onClick={() => tap(idx)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border-2 transition-bouncy",
                    first === idx
                      ? "border-primary scale-95 ring-4 ring-primary/40"
                      : solved && correct
                      ? "border-success"
                      : "border-border/40",
                    "bg-gradient-to-br from-card to-muted/50",
                  )}
                  aria-label={`Parça ${idx + 1}`}
                >
                  {item?.emoji && (
                    <span
                      aria-hidden
                      className="absolute inset-0 leading-none select-none flex items-center justify-center"
                      style={{
                        width: `${N * 100}%`,
                        height: `${N * 100}%`,
                        top: `-${row * 100}%`,
                        left: `-${col * 100}%`,
                        fontSize: `calc(var(--tile) * ${N * 0.95})`,
                      }}
                    >
                      {item.emoji}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {solved && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-success/85 backdrop-blur-sm animate-bounce-in">
              <div className="text-7xl mb-2">{item?.emoji}</div>
              <div className="text-2xl font-extrabold text-white mb-1">{item?.label}</div>
              <div className="text-3xl font-extrabold text-white text-shadow-soft mb-4">
                🎉 Aferin!
              </div>
              <button
                onClick={startNew}
                className="rounded-full bg-white text-success px-6 py-3 font-extrabold shadow-soft active:scale-95"
              >
                Yeni Yapboz
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm font-bold text-muted-foreground">
          İki parçaya dokun → yerleri değişir
        </p>
      </main>
    </div>
  );
};

export default PuzzleGame;
