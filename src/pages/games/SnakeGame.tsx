import { useEffect, useRef, useState, useCallback } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback, playSpeech } from "@/lib/audio";
import { gamePool, shuffle, pickN } from "./_shared";
import { recordLetterMastery } from "@/data/srs";
import { enqueueRetryItem, getGameItemLevel, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";

const COLS = 14;
const ROWS = 18;
const TICK_MS = 260;
const SWIPE_MIN = 24; // px — bu kadar kaydırınca yön değişir

type Cell = { x: number; y: number };
type Dir = { x: number; y: number };

interface FoodLetter {
  pos: Cell;
  item: ContentItem;
}

interface QuizState {
  target: ContentItem;
  options: [FoodLetter, FoodLetter];
}

function randCell(taken: Cell[], avoid: Cell[] = [], minDist = 0): Cell {
  for (let tries = 0; tries < 200; tries++) {
    const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (taken.some((t) => t.x === c.x && t.y === c.y)) continue;
    if (avoid.some((a) => Math.abs(a.x - c.x) + Math.abs(a.y - c.y) < minDist)) continue;
    return c;
  }
  // fallback: any free cell
  while (true) {
    const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!taken.some((t) => t.x === c.x && t.y === c.y)) return c;
  }
}

const SnakeGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";

  const [snake, setSnake] = useState<Cell[]>([{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }]);
  const [dir, setDir] = useState<Dir>({ x: 1, y: 0 });
  const dirRef = useRef(dir);
  dirRef.current = dir;
  const [food, setFood] = useState<FoodLetter | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [eaten, setEaten] = useState(0);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(true);

  // Süper modda hedef harfin SRS seviyesi — sadece L1'de halka göster
  const targetLevel = getGameItemLevel(quiz?.target);
  const showHint = !isSuper || targetLevel === 1;

  const newFood = useCallback((occupied: Cell[]) => {
    const pool = gamePool();
    const item = pickNextGameItem(pool) || pool[0];
    const head = occupied[0];
    const avoid = head ? [head] : [];
    setFood({ pos: randCell(occupied, avoid, 2), item });
  }, []);

  const startQuiz = useCallback((occupied: Cell[]) => {
    const pool = gamePool();
    const target = pickNextGameItem(pool) || pool[0];
    const wrong = pickN(pool.filter((p) => p.id !== target.id), 1)[0];
    const taken = [...occupied];
    // Yılan kafasının etrafında geniş bir alanı boş tut — istemeden cevap üstüne gitmesin
    const head = occupied[0];
    const d = dirRef.current;
    const avoid: Cell[] = [];
    if (head) {
      avoid.push(head);
      // Önümüzdeki 5 kareyi tamamen yasak böl
      for (let i = 1; i <= 5; i++) {
        avoid.push({ x: head.x + d.x * i, y: head.y + d.y * i });
      }
      // Kafanın etrafında 2 kare yarıçaplı bölge
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          avoid.push({ x: head.x + dx, y: head.y + dy });
        }
      }
    }
    // Seçenekler kafadan en az 4 kare uzakta olsun ki tepki süresi yeterli olsun
    const a = randCell(taken, avoid, 4); taken.push(a);
    const b = randCell(taken, [...avoid, a], 4);
    const items = shuffle([target, wrong]);
    setQuiz({
      target,
      options: [
        { pos: a, item: items[0] },
        { pos: b, item: items[1] },
      ],
    });
    setFood(null);
    playItem(target);
  }, []);

  // Init — süper modda direkt quiz başlasın
  useEffect(() => {
    const initial = [{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }];
    if (isSuper) startQuiz(initial); else newFood(initial);
  }, [isSuper, newFood, startQuiz]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = dirRef.current;
      if (e.key === "ArrowUp" && d.y === 0) setDir({ x: 0, y: -1 });
      else if (e.key === "ArrowDown" && d.y === 0) setDir({ x: 0, y: 1 });
      else if (e.key === "ArrowLeft" && d.x === 0) setDir({ x: -1, y: 0 });
      else if (e.key === "ArrowRight" && d.x === 0) setDir({ x: 1, y: 0 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Game tick
  useEffect(() => {
    if (gameOver || paused) return;
    const id = setInterval(() => {
      setSnake((prev) => {
        const head = prev[0];
        const d = dirRef.current;
        const next: Cell = { x: head.x + d.x, y: head.y + d.y };
        if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
          setGameOver(true);
          playFeedback(false);
          return prev;
        }
        if (prev.some((c) => c.x === next.x && c.y === next.y)) {
          setGameOver(true);
          playFeedback(false);
          return prev;
        }

        const newSnake = [next, ...prev];
        let grew = false;

        if (quiz) {
          const hitIdx = quiz.options.findIndex((o) => o.pos.x === next.x && o.pos.y === next.y);
          if (hitIdx >= 0) {
            const opt = quiz.options[hitIdx];
            const correct = opt.item.id === quiz.target.id;
            recordLetterMastery(quiz.target.id, correct);
            recordGameAnswer(quiz.target, correct);
            if (correct) {
              grew = true;
              setScore((s) => s + 5);
              playFeedback(true);
              setQuiz(null);
              setEaten(0);
              // Süper modda her zaman quiz; normalde yiyeceğe dön
              if (isSuper) setTimeout(() => startQuiz(newSnake), 0);
              else setTimeout(() => newFood(newSnake), 0);
            } else {
              playFeedback(false);
              // Süper modda: aynı soruyu tekrar sor, oyunu bitirme
              if (isSuper) {
                enqueueRetryItem(quiz.target);
                setQuiz(null);
                setTimeout(() => startQuiz(newSnake), 200);
              } else {
                setGameOver(true);
                return prev;
              }
            }
          }
        } else if (food && food.pos.x === next.x && food.pos.y === next.y) {
          grew = true;
          setScore((s) => s + 1);
          playSpeech(food.item.speech);
          const newEaten = eaten + 1;
          setEaten(newEaten);
          if (newEaten >= 4) {
            setPaused(true);
            setTimeout(() => { setPaused(false); startQuiz(newSnake); }, 1600);
          } else {
            setTimeout(() => newFood(newSnake), 0);
          }
        }

        if (!grew) newSnake.pop();
        return newSnake;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [gameOver, paused, food, quiz, eaten, newFood, startQuiz, isSuper]);

  const reset = () => {
    const initial = [{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }];
    setSnake(initial);
    setDir({ x: 1, y: 0 });
    setEaten(0);
    setScore(0);
    setGameOver(false);
    setPaused(true);
    setQuiz(null);
    setFood(null);
    if (isSuper) startQuiz(initial); else newFood(initial);
  };

  const turn = useCallback((nd: Dir) => {
    if (gameOver) return;
    if (paused) setPaused(false);
    const d = dirRef.current;
    if ((nd.x !== 0 && d.x === 0) || (nd.y !== 0 && d.y === 0)) setDir(nd);
  }, [gameOver, paused]);

  // Swipe (touch + pointer) — board üzerinde kaydırma ile yön değiştir
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]; touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStartRef.current; if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    const ax = Math.abs(dx); const ay = Math.abs(dy);
    if (Math.max(ax, ay) < SWIPE_MIN) {
      // basit dokunuş → başlat / duraklat
      if (paused && !gameOver) setPaused(false);
      touchStartRef.current = null;
      return;
    }
    if (ax > ay) turn({ x: dx > 0 ? 1 : -1, y: 0 });
    else turn({ x: 0, y: dy > 0 ? 1 : -1 });
    touchStartRef.current = null;
  };

  const cellSize = (axis: "w" | "h") => `${100 / (axis === "w" ? COLS : ROWS)}%`;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative bg-gradient-to-b from-sky-200 via-emerald-100 to-emerald-200">
      {/* Cute background bubbles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-white/40 blur-2xl" />
        <div className="absolute top-20 -right-16 h-56 w-56 rounded-full bg-warning/30 blur-3xl" />
        <div className="absolute bottom-10 -left-20 h-64 w-64 rounded-full bg-success/30 blur-3xl" />
      </div>

      <main className="container mx-auto max-w-xl px-3 flex-1 flex flex-col min-h-0 relative z-10">
        <PageHeader title="🐍 Yılan" backTo="/oyunlar" centered onReset={reset} />

        <div className="mb-2 grid grid-cols-3 gap-2 text-center shrink-0">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-2 shadow-card border-2 border-success/40">
            <div className="text-[10px] font-extrabold text-success/80 uppercase tracking-wider">⭐ Puan</div>
            <div className="text-xl font-black text-success leading-tight">{score}</div>
          </div>
          <div className="rounded-2xl bg-white/90 backdrop-blur p-2 shadow-card border-2 border-info/40">
            <div className="text-[10px] font-extrabold text-info/80 uppercase tracking-wider">{isSuper ? "Mod" : "🍎 Yenen"}</div>
            <div className="text-xl font-black text-info leading-tight">{isSuper ? "⚡" : eaten}</div>
          </div>
          <button
            onClick={() => quiz && playItem(quiz.target)}
            disabled={!quiz}
            className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-2 shadow-card border-2 border-primary-foreground/40 font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition-bouncy"
          >
            <Volume2 className="h-5 w-5" /> Dinle
          </button>
        </div>

        <div className={cn(
          "rounded-2xl p-2.5 mb-2 border-2 text-center shrink-0 transition-colors shadow-soft",
          quiz
            ? "bg-gradient-to-r from-warning/30 to-warning/20 border-warning"
            : "bg-white/80 backdrop-blur border-success/40",
        )}>
          {quiz ? (
            <p className="text-xs font-extrabold text-foreground">🎯 Sesi dinle, doğru harfi ye!</p>
          ) : (
            <p className="text-xs font-extrabold text-foreground">🐍 Harfleri ye — 4 harfte bir sınav</p>
          )}
        </div>

        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative rounded-3xl shadow-elegant border-[6px] border-success/60 overflow-hidden mx-auto select-none touch-none"
          style={{
            aspectRatio: `${COLS} / ${ROWS}`,
            width: "100%",
            maxWidth: "min(100%, 55vh)",
            maxHeight: "55vh",
            backgroundImage:
              "linear-gradient(180deg, hsl(140 70% 92%) 0%, hsl(140 60% 82%) 100%), repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 8px, transparent 8px 16px)",
            backgroundBlendMode: "overlay",
          }}
        >
          {/* checker pattern overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-30"
               style={{
                 backgroundImage:
                   `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
                 backgroundSize: `${100 / COLS}% ${100 / ROWS}%`,
               }}
          />

          {snake.map((c, i) => {
            const isHead = i === 0;
            const d = dirRef.current;
            const rotate = d.x === 1 ? 0 : d.x === -1 ? 180 : d.y === -1 ? -90 : 90;
            return (
              <div
                key={i}
                className={cn(
                  "absolute flex items-center justify-center",
                  isHead
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[35%] shadow-lg ring-2 ring-emerald-700/30 z-10"
                    : "bg-gradient-to-br from-emerald-300 to-emerald-500 rounded-[40%] shadow-sm"
                )}
                style={{
                  left: `${(c.x / COLS) * 100}%`, top: `${(c.y / ROWS) * 100}%`,
                  width: cellSize("w"), height: cellSize("h"),
                  transform: isHead ? `rotate(${rotate}deg)` : undefined,
                }}
              >
                {isHead && (
                  <div className="flex items-center gap-[15%] text-[8px] leading-none">
                    <span className="h-[28%] w-[28%] rounded-full bg-white relative">
                      <span className="absolute inset-[20%] rounded-full bg-black" />
                    </span>
                    <span className="h-[28%] w-[28%] rounded-full bg-white relative">
                      <span className="absolute inset-[20%] rounded-full bg-black" />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {food && (
            <div
              className="absolute flex items-center justify-center animate-bounce-in"
              style={{
                left: `${(food.pos.x / COLS) * 100}%`, top: `${(food.pos.y / ROWS) * 100}%`,
                width: cellSize("w"), height: cellSize("h"),
              }}
            >
              <div className="h-[90%] w-[90%] rounded-full bg-gradient-to-br from-warning to-orange-500 shadow-lg ring-2 ring-white/60 flex items-center justify-center animate-pulse">
                <span className="text-base font-black text-white drop-shadow"><EmojiView value={food.item.emoji} /></span>
              </div>
            </div>
          )}
          {quiz && quiz.options.map((opt, i) => {
            const isCorrect = opt.item.id === quiz.target.id;
            return (
              <div
                key={i}
                className="absolute flex items-center justify-center animate-bounce-in"
                style={{
                  left: `${(opt.pos.x / COLS) * 100}%`, top: `${(opt.pos.y / ROWS) * 100}%`,
                  width: cellSize("w"), height: cellSize("h"),
                }}
              >
                <div className={cn(
                  "h-[92%] w-[92%] rounded-full flex items-center justify-center shadow-lg ring-2",
                  isCorrect && showHint
                    ? "bg-gradient-to-br from-yellow-300 to-warning ring-yellow-200 animate-pulse"
                    : "bg-gradient-to-br from-sky-300 to-info ring-white/60"
                )}>
                  <span className="text-base font-black text-white drop-shadow"><EmojiView value={opt.item.emoji} /></span>
                </div>
              </div>
            );
          })}
          {!gameOver && paused && (
            <button
              onClick={() => setPaused(false)}
              className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/70 to-emerald-100/80 backdrop-blur-sm"
            >
              <div className="text-7xl mb-3 animate-bounce">🐍</div>
              <div className="text-2xl font-black text-success mb-2 drop-shadow-sm">Hazır mısın?</div>
              <div className="text-xs font-extrabold text-foreground/80 px-6 text-center max-w-[80%]">
                Ekrana parmağını sürükle ↑↓←→
              </div>
              <div className="mt-4 px-6 py-2.5 rounded-full bg-gradient-to-r from-success to-emerald-600 text-white font-black text-sm shadow-elegant">
                ▶ Başla!
              </div>
            </button>
          )}
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/80 to-rose-100/90 backdrop-blur-sm">
              <div className="text-7xl mb-2 animate-bounce-in">😵</div>
              <div className="text-3xl font-black text-destructive mb-1 drop-shadow-sm">Oyun Bitti!</div>
              <div className="text-sm font-extrabold text-foreground/70 mb-4">⭐ Puan: {score}</div>
              <button onClick={reset} className="rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-7 py-3 font-black shadow-elegant border-2 border-white/40 active:scale-95">
                🔄 Tekrar Oyna
              </button>
            </div>
          )}
        </div>

        {/* Sadece duraklat/devam et — yön kontrolü kaydırarak yapılır */}
        <div className="mt-2 flex justify-center select-none shrink-0">
          <button
            onClick={() => setPaused((p) => !p)}
            className="px-6 h-11 rounded-full bg-white/90 backdrop-blur shadow-card border-2 border-success/40 text-sm font-black text-success active:scale-90 transition-bouncy"
          >
            {paused ? "▶ Başlat" : "❚❚ Duraklat"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default SnakeGame;
