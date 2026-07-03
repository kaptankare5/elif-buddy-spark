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
import { Volume2, Heart } from "lucide-react";

// Oyun alanı normalize edilmiş 0..100 koordinat sisteminde tutulur,
// ekrana % cinsinden basılır → her cihazda akıcı kalır.
const W = 100;
const H = 100;
const GRAVITY = 0.13;
const FLAP = -2.6;
const BIRD_X = 18;
const LETTER_SPEED = 0.38;     // daha yavaş
const SPAWN_EVERY = 130;       // tick (daha seyrek dalga, üst üste binmesin)
const TICK_MS = 33;
const HIT_R = 7;               // görsel yarıçap
const HIT_THRESH = 11;         // çarpışma için cömert eşik
const MAX_LETTERS = 6;         // ekranda aynı anda en fazla
const MIN_DY = 22;             // harfler arası minimum dikey mesafe (aynı x'te)
const NEAR_DX = 18;            // yatayca "yakın" sayma eşiği
// quiz kaldırıldı

interface Letter {
  uid: number;
  x: number;
  y: number;
  item: ContentItem;
  isTarget: boolean;
  hit?: boolean;
  missed?: boolean;
}

// Quiz kaldırıldı

let UID = 1;

const FlappyGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const [birdY, setBirdY] = useState(40);
  const [vel, setVel] = useState(0);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [score, setScore] = useState(0);
  const [eaten, setEaten] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(true);

  const tickRef = useRef(0);
  const velRef = useRef(0); velRef.current = vel;
  const yRef = useRef(40); yRef.current = birdY;
  const targetRef = useRef<ContentItem | null>(null); targetRef.current = target;

  const pausedRef = useRef(true); pausedRef.current = paused;

  const pickTarget = useCallback((silent = false) => {
    const pool = gamePool();
    const item = pickNextGameItem(pool) || pool[0];
    setTarget(item);
    if (!silent && !pausedRef.current) playItem(item);
  }, []);

  // İlk hedef — sessiz seç, oyun başlayınca seslendir
  useEffect(() => { pickTarget(true); }, [pickTarget]);

  const flap = useCallback(() => {
    if (gameOver) return;
    if (paused) {
      setPaused(false);
      // ilk uçuşta hedefi seslendir
      if (target) playItem(target);
    }
    setVel(FLAP);
  }, [gameOver, paused, target]);

  // Klavye / boşluk
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  // Quiz kaldırıldı — artık sadece harf yutma var

  // Ana döngü — requestAnimationFrame + delta-bazlı (mobilde daha akıcı)
  useEffect(() => {
    if (gameOver || paused) return;
    let rafId = 0;
    let last = performance.now();
    let acc = 0;
    const HIT_SQ = HIT_THRESH * HIT_THRESH;
    const TARGET_SQ = (HIT_THRESH + 2) * (HIT_THRESH + 2);
    const NEAR_PLUS_SQ = (HIT_THRESH + 4) * (HIT_THRESH + 4);

    const step = () => {
      tickRef.current += 1;

      // Bird fizik
      const nv = velRef.current + GRAVITY;
      const ny = yRef.current + nv;
      if (ny > H - 4) {
        setGameOver(true); playFeedback(false); return true;
      }
      if (ny < 0) { setBirdY(0); setVel(0); }
      else { setBirdY(ny); setVel(nv); }

      // Spawn
      if (tickRef.current % SPAWN_EVERY === 0 && targetRef.current) {
        setLetters((prev) => {
          if (prev.length >= MAX_LETTERS) return prev;
          const nearXs = prev.filter((p) => p.x > 100 - NEAR_DX * 2).map((p) => p.y);
          const allSlots = [15, 35, 55, 75];
          const freeSlots = shuffle(allSlots).filter(
            (s) => nearXs.every((ny2) => Math.abs(ny2 - s) >= MIN_DY),
          );
          if (freeSlots.length === 0) return prev;
          const desired = Math.random() < 0.5 ? 1 : 2;
          const count = Math.min(desired, freeSlots.length, MAX_LETTERS - prev.length);
          const chosenSlots: number[] = [];
          for (const s of freeSlots) {
            if (chosenSlots.every((c) => Math.abs(c - s) >= MIN_DY)) chosenSlots.push(s);
            if (chosenSlots.length === count) break;
          }
          if (chosenSlots.length === 0) return prev;
          const pool = gamePool();
          const wrongs = pickN(pool.filter((p) => p.id !== targetRef.current!.id), chosenSlots.length - 1);
          const items = shuffle([targetRef.current!, ...wrongs]).slice(0, chosenSlots.length);
          if (chosenSlots.length === 1 && Math.random() < 0.5 && wrongs.length === 0) {
            const w = pickN(pool.filter((p) => p.id !== targetRef.current!.id), 1);
            if (w.length) items[0] = w[0];
          }
          return [
            ...prev,
            ...items.map((it, i) => ({
              uid: UID++,
              x: 110 + i * 28,
              y: chosenSlots[i],
              item: it,
              isTarget: it.id === targetRef.current!.id,
            })),
          ];
        });
      }

      // Hareket + çarpışma (squared distance)
      setLetters((prev) => {
        const curTargetId = targetRef.current?.id;
        const moved: Letter[] = [];
        let missedTarget: Letter | null = null;
        for (const l of prev) {
          if (l.hit) continue;
          // "missed" işaretli harfler ekranda dururlar (sol kenarda gözüksünler)
          if (l.missed) { moved.push(l); continue; }
          const nx = l.x - LETTER_SPEED;
          if (nx < -8) {
            if (l.item.id === curTargetId) {
              // Hedef harfi kaçırdı — sol kenarda kırmızı parlasın, sonra kaybolsun
              missedTarget = { ...l, x: 4, missed: true };
              moved.push(missedTarget);
            }
            continue;
          }
          moved.push({ ...l, x: nx, isTarget: l.item.id === curTargetId });
        }

        let collidedTarget: Letter | null = null;
        let collidedWrong: Letter | null = null;
        let bestTargetD = Infinity;
        let bestWrongD = Infinity;
        const by = yRef.current;
        for (const l of moved) {
          if (l.missed) continue;
          const dx = l.x - BIRD_X;
          const dy = l.y - by;
          const d2 = dx * dx + dy * dy;
          if (l.isTarget) {
            if (d2 < TARGET_SQ && d2 < bestTargetD) { bestTargetD = d2; collidedTarget = l; }
          } else {
            if (d2 < HIT_SQ && d2 < bestWrongD) { bestWrongD = d2; collidedWrong = l; }
          }
        }
        if (collidedTarget) collidedWrong = null;
        if (!collidedTarget && collidedWrong) {
          const nearTarget = moved.find(
            (l) => l.isTarget && !l.missed && Math.abs(l.x - BIRD_X) < 14,
          );
          if (nearTarget) collidedWrong = null;
        }

        let next = moved.filter((l) => l !== collidedTarget && l !== collidedWrong);

        if (collidedTarget) {
          recordLetterMastery(collidedTarget.item.id, true);
          recordGameAnswer(collidedTarget.item, true);
          playSpeech(collidedTarget.item.speech);
          setScore((s) => s + 1);
          next = next.filter((l) => {
            if (l.missed) return true;
            const dx = l.x - BIRD_X, dy = l.y - by;
            return dx * dx + dy * dy > NEAR_PLUS_SQ;
          });
          setEaten((e) => e + 1);
          setTimeout(pickTarget, 250);
          return next;
        }
        if (collidedWrong) {
          recordLetterMastery(targetRef.current!.id, false);
          recordGameAnswer(targetRef.current!, false);
          if (isSuper) enqueueRetryItem(targetRef.current!);
          playFeedback(false);
          // Yanlış harfi sol kenarda kısa süre parlat ki oyuncu görsün
          const flashed: Letter = { ...collidedWrong, x: 10, missed: true };
          next = [...next, flashed];
          const flashedUid = flashed.uid;
          setTimeout(() => {
            setLetters((cur) => cur.filter((l) => l.uid !== flashedUid));
          }, 900);
          setLives((l) => {
            const nl = l - 1;
            if (nl <= 0) setGameOver(true);
            return nl;
          });
          if (isSuper) setTimeout(pickTarget, 300);
        }
        if (missedTarget) {
          recordLetterMastery(targetRef.current!.id, false);
          recordGameAnswer(targetRef.current!, false);
          if (isSuper) enqueueRetryItem(targetRef.current!);
          playFeedback(false);
          const missedUid = missedTarget.uid;
          setTimeout(() => {
            setLetters((cur) => cur.filter((l) => l.uid !== missedUid));
          }, 1000);
          setLives((l) => {
            const nl = l - 1;
            if (nl <= 0) setGameOver(true);
            return nl;
          });
          setTimeout(pickTarget, 300);
        }
        return next;
      });
      return false;
    };

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      // Sabit adımlı simülasyon — düşük FPS'te bile tutarlı
      let guard = 0;
      while (acc >= TICK_MS && guard < 5) {
        const stop = step();
        acc -= TICK_MS;
        guard++;
        if (stop) return;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gameOver, paused, pickTarget]);

  const reset = () => {
    setBirdY(40); setVel(0); setLetters([]); setScore(0);
    setEaten(0); setLives(3); setGameOver(false); setPaused(true);
    UID = 1; tickRef.current = 0;
    setTimeout(pickTarget, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-info/15 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🐤 Uçan Kuş" backTo="/oyunlar" centered onReset={reset} />

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Puan</div>
            <div className="text-xl font-extrabold text-success">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-destructive/30 flex flex-col items-center">
            <div className="text-[10px] font-bold text-muted-foreground">Can</div>
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart key={i} className={cn("h-4 w-4", i < lives ? "fill-destructive text-destructive" : "text-muted")} />
              ))}
            </div>
          </div>
          <button
            onClick={() => target && playItem(target)}
            disabled={!target}
            className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <Volume2 className="h-4 w-4" /> Dinle
          </button>
        </div>

        <div className="rounded-2xl p-3 mb-3 border-2 bg-warning/15 border-warning/50 text-center min-h-[64px]">
          <p className="text-xs font-bold text-muted-foreground">🎯 Sesi dinle ve doğru harfi yut!</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">{target?.subLabel ?? "—"}</p>
        </div>

        <div
          onPointerDown={(e) => { e.preventDefault(); flap(); }}
          className="relative w-full overflow-hidden rounded-2xl shadow-card border-4 border-info/40 bg-gradient-to-b from-info/10 via-background to-success/10 select-none touch-none"
          style={{ aspectRatio: "5 / 6", maxHeight: "60vh", margin: "0 auto", contain: "layout paint size" }}
        >
          {/* Bird */}
          <div
            className="absolute flex items-center justify-center text-3xl"
            style={{
              left: `${BIRD_X}%`,
              top: `${birdY}%`,
              width: `${HIT_R * 2}%`,
              height: `${HIT_R * 2}%`,
              transform: `translate3d(-50%, -50%, 0) scaleX(-1) rotate(${Math.max(-30, Math.min(60, -vel * 8))}deg)`,
              willChange: "transform, top",
            }}
          >
            🐤
          </div>

          {/* Letters */}
          {letters.map((l) => {
            const lvl = getGameItemLevel(l.item);
            const showRing = l.isTarget && (!isSuper || lvl === 1);
            return (
              <div
                key={l.uid}
                className={cn(
                  "absolute flex items-center justify-center rounded-full font-extrabold border-2 shadow-soft transition-colors",
                  l.missed
                    ? "bg-destructive text-white border-white ring-4 ring-destructive/40 animate-pulse scale-110 z-20"
                    : showRing
                    ? "bg-warning/30 border-warning text-foreground"
                    : "bg-card border-border text-foreground",
                )}
                style={{
                  left: `${l.x}%`,
                  top: `${l.y}%`,
                  width: `${HIT_R * 2}%`,
                  height: `${HIT_R * 2}%`,
                  transform: "translate3d(-50%, -50%, 0)",
                  fontSize: "min(6vw, 28px)",
                  willChange: "left",
                }}
              >
                <EmojiView value={l.item.emoji} />
              </div>
            );
          })}

          {/* Quiz kaldırıldı */}

          {/* Game over */}
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95">
              <div className="text-4xl mb-2">😢</div>
              <div className="text-2xl font-extrabold text-destructive mb-2">Oyun Bitti</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">Puan: {score}</div>
              <button onClick={reset} className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-extrabold shadow-soft">
                Tekrar Oyna
              </button>
            </div>
          )}

          {paused && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
              <div className="text-5xl mb-2">🐤</div>
              <div className="text-xl font-extrabold text-info mb-1">Hazır?</div>
              <div className="text-sm font-bold text-muted-foreground">Zıplamak için ekrana dokun</div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <button onClick={flap} className="flex-1 max-w-[200px] rounded-2xl bg-primary text-primary-foreground px-6 py-4 font-extrabold shadow-soft active:scale-95">
            🚀 Zıpla
          </button>
          <button onClick={() => setPaused((p) => !p)} className="rounded-2xl bg-muted px-6 py-4 font-extrabold shadow-soft active:scale-95">
            {paused ? "▶" : "II"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default FlappyGame;
