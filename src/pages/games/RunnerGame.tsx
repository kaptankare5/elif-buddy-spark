import { memo, useCallback, useEffect, useRef, useState } from "react";
import { EmojiView } from "@/components/EmojiView";

const ShipSvg = memo(() => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <defs>
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7dd3fc" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M38 78 Q50 100 62 78 Z" fill="url(#flame)">
      <animate attributeName="d" dur="0.18s" repeatCount="indefinite"
        values="M38 78 Q50 100 62 78 Z; M40 78 Q50 95 60 78 Z; M38 78 Q50 100 62 78 Z" />
    </path>
    <path d="M50 10 Q72 40 70 72 Q60 80 50 80 Q40 80 30 72 Q28 40 50 10 Z"
      fill="url(#body)" stroke="#1e3a8a" strokeWidth="2" />
    <path d="M30 60 L14 78 L30 72 Z" fill="#6366f1" stroke="#1e3a8a" strokeWidth="2" />
    <path d="M70 60 L86 78 L70 72 Z" fill="#6366f1" stroke="#1e3a8a" strokeWidth="2" />
    <circle cx="50" cy="40" r="10" fill="#fef3c7" stroke="#1e3a8a" strokeWidth="2" />
    <circle cx="47" cy="37" r="3" fill="white" opacity="0.9" />
  </svg>
));
ShipSvg.displayName = "ShipSvg";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback, playSpeech } from "@/lib/audio";
import { gamePool, pickN, shuffle } from "./_shared";
import { enqueueRetryItem, getGameItemLevel, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Heart, Volume2, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 🚀 Uzay Savaşı — eğitici nişancı.
 * Her el rastgele 4 nesne seçilir, biri hedef. Düşmanlar bu 4 nesneden gelir.
 * Hedefi yalnızca sesle söyler. Yanlış vurursa veya gemiye çarparsa: can − ve yeni soru.
 */
const TICK_MS = 32;
const SHIP_W = 14;
const SHIP_H = 12;
const ENEMY_SIZE = 10;
const ENEMY_FALL = 0.35;
const BULLET_SPEED = 2.2;
const SHIP_SPEED = 1.8;
const MAX_ENEMIES = 5;
const SHIP_TOP = 86;
const ROUND_SIZE = 4; // her elde 4 nesne

interface Enemy { uid: number; x: number; y: number; item: ContentItem; isTarget: boolean }
interface Bullet { uid: number; x: number; y: number }
interface Pop { id: number; x: number; y: number; text: string; good: boolean }

let UID = 1;
let POP_UID = 1;

function askTarget(item: ContentItem): Promise<void> {
  // Önce nesnenin adını seslendir (MP3 varsa onu kullanır)
  return playSpeech(item.speech, item.lang);
}

const RunnerGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const [shipX, setShipX] = useState(50);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [roundItems, setRoundItems] = useState<ContentItem[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(true);
  const [pops, setPops] = useState<Pop[]>([]);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);

  const shipXRef = useRef(50); shipXRef.current = shipX;
  const targetRef = useRef<ContentItem | null>(null); targetRef.current = target;
  const roundItemsRef = useRef<ContentItem[]>([]); roundItemsRef.current = roundItems;
  const pausedRef = useRef(true); pausedRef.current = paused;
  const enemiesRef = useRef<Enemy[]>([]); enemiesRef.current = enemies;
  const roundLockRef = useRef(false); // aynı el içinde çift tetiklemeyi önler
  const tickRef = useRef(0);
  const moveDirRef = useRef<-1 | 0 | 1>(0);
  const lastShotRef = useRef(0);

  const nextRound = useCallback(async (silent = false) => {
    const pool = gamePool();
    if (pool.length === 0) return;
    // Hedefi SRS ile seç
    const tgt = pickNextGameItem(pool) || pool[0];
    // El nesneleri: hedef + 3 rastgele yanlış (toplam 4)
    const others = pickN(pool.filter((p) => p.id !== tgt.id), Math.max(0, ROUND_SIZE - 1));
    const items = shuffle([tgt, ...others]);
    setTarget(tgt);
    setRoundItems(items);
    targetRef.current = tgt;
    roundItemsRef.current = items;
    // Uçan Kuş mantığı: ekrandaki nesneleri silme, sadece isTarget bayraklarını
    // yeni hedefe göre güncelle. Yeni hedef bu eldeki nesneler arasında yoksa
    // mevcutlar decoy olarak kalır; doğal akışla aşağı düşerler.
    setEnemies((arr) => arr.map((e) => ({ ...e, isTarget: e.item.id === tgt.id })));
    roundLockRef.current = false;
    if (!silent) {
      await askTarget(tgt);
    }
  }, []);

  const addPop = (x: number, y: number, text: string, good: boolean) => {
    const p: Pop = { id: POP_UID++, x, y, text, good };
    setPops((prev) => [...prev, p]);
    setTimeout(() => setPops((prev) => prev.filter((q) => q.id !== p.id)), 800);
  };
  const flashFx = (k: "good" | "bad") => { setFlash(k); setTimeout(() => setFlash(null), 200); };

  const loseLifeAndRenew = useCallback(() => {
    if (roundLockRef.current) return;
    roundLockRef.current = true;
    playFeedback(false);
    setCombo(0);
    flashFx("bad");
    // Süper modda yanlış cevaplanan hedefi tekrar sor
    if (isSuper && targetRef.current) enqueueRetryItem(targetRef.current);
    setLives((l) => {
      const nl = l - 1;
      if (nl <= 0) { setGameOver(true); return nl; }
      // yeni soruya geç
      setTimeout(() => { void nextRound(); }, 400);
      return nl;
    });
  }, [nextRound, isSuper]);

  const startGame = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    void nextRound();
  }, [nextRound]);

  const fire = useCallback(() => {
    if (gameOver) return;
    if (pausedRef.current) { startGame(); return; }
    const now = Date.now();
    if (now - lastShotRef.current < 220) return;
    lastShotRef.current = now;
    setBullets((b) => [...b, { uid: UID++, x: shipXRef.current, y: SHIP_TOP - SHIP_H / 2 }]);
  }, [gameOver, startGame]);

  const startMove = (dir: -1 | 1) => {
    moveDirRef.current = dir;
    if (pausedRef.current) startGame();
  };
  const stopMove = () => { moveDirRef.current = 0; };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); fire(); }
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); startMove(-1); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); startMove(1); }
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) moveDirRef.current = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire]);

  // Ana döngü — requestAnimationFrame + sabit adım
  useEffect(() => {
    if (gameOver || paused) return;
    let rafId = 0;
    let last = performance.now();
    let acc = 0;

    const step = () => {
      tickRef.current += 1;

      if (moveDirRef.current !== 0) {
        setShipX((x) => Math.max(SHIP_W / 2, Math.min(100 - SHIP_W / 2, x + moveDirRef.current * SHIP_SPEED)));
      }

      const spawnEvery = Math.max(35, 70 - Math.floor(score * 0.5));
      if (tickRef.current % spawnEvery === 0 && enemiesRef.current.length < MAX_ENEMIES) {
        const t = targetRef.current;
        const ri = roundItemsRef.current;
        if (t && ri.length > 0) {
          const hasTarget = enemiesRef.current.some((e) => e.isTarget);
          const putTarget = !hasTarget && Math.random() < 0.55;
          const others = ri.filter((p) => p.id !== t.id);
          const item = putTarget
            ? t
            : (others.length > 0 ? others[Math.floor(Math.random() * others.length)] : t);
          // Üst kısımda mevcut düşmanlarla dikey çakışmayı engelle
          // (doğru harfin önüne yanlış resim gelmesin)
          const MIN_DX = ENEMY_SIZE + 2;
          const topEnemies = enemiesRef.current.filter((e) => e.y < 25);
          let x = 10 + Math.random() * 80;
          let tries = 0;
          while (tries < 8 && topEnemies.some((e) => Math.abs(e.x - x) < MIN_DX)) {
            x = 10 + Math.random() * 80;
            tries++;
          }
          if (topEnemies.some((e) => Math.abs(e.x - x) < MIN_DX)) {
            // çakışıyorsa bu turu atla
          } else {
            setEnemies((arr) => [...arr, {
              uid: UID++,
              x,
              y: -5,
              item,
              isTarget: item.id === t.id,
            }]);
          }
        }
      }

      // Düşmanları indir
      setEnemies((arr) => {
        let collided = false;
        const survivors: Enemy[] = [];
        const sx = shipXRef.current;
        for (const e of arr) {
          const ny = e.y + ENEMY_FALL;
          const hitsShip =
            Math.abs(e.x - sx) < (SHIP_W / 2 + ENEMY_SIZE / 2 - 2) &&
            Math.abs(ny - SHIP_TOP) < (SHIP_H / 2 + ENEMY_SIZE / 2 - 2);
          if (hitsShip) {
            collided = true;
            if (e.isTarget && targetRef.current) { recordGameAnswer(targetRef.current, false); }
            continue;
          }
          if (ny > 100) continue;
          survivors.push({ ...e, y: ny });
        }
        if (collided) loseLifeAndRenew();
        return survivors;
      });

      // Mermiler + çarpışma
      setBullets((bs) => {
        const moved: Bullet[] = [];
        const removeUids = new Set<number>();
        let hitTarget = false;
        let hitWrong = false;
        const cur = enemiesRef.current;
        for (const b of bs) {
          const ny = b.y - BULLET_SPEED;
          if (ny < -3) continue;
          let consumed = false;
          // Hedefe öncelik ver — doğru harf yanlışların arkasında kalmasın
          const ordered = [...cur].sort((a, z) => (z.isTarget ? 1 : 0) - (a.isTarget ? 1 : 0));
          for (const e of ordered) {
            if (removeUids.has(e.uid)) continue;
            if (Math.abs(e.x - b.x) < ENEMY_SIZE / 2 + 2 && Math.abs(e.y - ny) < ENEMY_SIZE / 2 + 2) {
              removeUids.add(e.uid);
              if (e.isTarget) hitTarget = true; else hitWrong = true;
              addPop(e.x, e.y, e.isTarget ? "+3" : "✗", e.isTarget);
              consumed = true;
              break;
            }
          }
          if (!consumed) moved.push({ ...b, y: ny });
        }
        if (removeUids.size > 0) setEnemies((arr) => arr.filter((e) => !removeUids.has(e.uid)));

        if (hitTarget && targetRef.current && !roundLockRef.current) {
          roundLockRef.current = true;
          const t = targetRef.current;
          recordGameAnswer(t, true);
          setScore((s) => s + 3);
          setCombo((c) => c + 1);
          flashFx("good");
          playFeedback(true);
          // Doğru cevapta soruyu tekrar seslendirme — sadece olumlu geri bildirim sesi
          setTimeout(() => { void nextRound(); }, 600);
        } else if (hitWrong && !hitTarget) {
          if (targetRef.current) { recordGameAnswer(targetRef.current, false); }
          loseLifeAndRenew();
        }
        return moved;
      });
    };

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      let guard = 0;
      while (acc >= TICK_MS && guard < 5) {
        step();
        acc -= TICK_MS;
        guard++;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gameOver, paused, score, nextRound, loseLifeAndRenew]);

  const reset = () => {
    setShipX(50); setEnemies([]); setBullets([]); setTarget(null); setRoundItems([]);
    setScore(0); setCombo(0); setLives(3); setGameOver(false); setPaused(true);
    pausedRef.current = true;
    setPops([]); UID = 1; POP_UID = 1; tickRef.current = 0; moveDirRef.current = 0;
    roundLockRef.current = false;
  };

  const replayQuestion = () => {
    if (target) void askTarget(target);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🚀 Uzay Savaşı" backTo="/oyunlar" centered onReset={reset} />

        <div className="mb-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Puan</div>
            <div className="text-xl font-extrabold text-success">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-warning/40">
            <div className="text-[10px] font-bold text-muted-foreground">Seri</div>
            <div className="text-xl font-extrabold text-warning">x{combo}</div>
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
            onClick={replayQuestion}
            disabled={!target}
            className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center disabled:opacity-40"
            aria-label="Soruyu tekrar dinle"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>

        <div
          className="relative w-full overflow-hidden rounded-2xl shadow-card border-4 border-indigo-500/60 select-none touch-none"
          style={{ aspectRatio: "5 / 6", maxHeight: "60vh", margin: "0 auto",
            background: "radial-gradient(ellipse at top, hsl(250 60% 25%), hsl(240 70% 8%) 75%)",
            contain: "layout paint size" }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-80"
            style={{ backgroundImage: `radial-gradient(white 1px, transparent 1px), radial-gradient(white 1px, transparent 1px)`,
              backgroundSize: `40px 40px, 60px 60px`, backgroundPosition: `0 0, 20px 30px` }} />

          {enemies.map((e) => (
            <div key={e.uid} className="absolute leading-none flex items-center justify-center rounded-full bg-white/95 border-2 border-white shadow-[0_0_14px_rgba(255,255,255,0.5)]"
              style={{ left: `${e.x}%`, top: `${e.y}%`, transform: "translate3d(-50%, -50%, 0)",
                width: "56px", height: "56px",
                fontSize: "34px", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                willChange: "top", zIndex: e.isTarget ? 20 : 5 }}>
              {e.isTarget && (!isSuper || getGameItemLevel(e.item) === 1) && (<div className="absolute -inset-1 rounded-full border-4 border-warning animate-pulse" />)}
              <span className="animate-float"><EmojiView value={e.item.emoji} /></span>
            </div>
          ))}

          {bullets.map((b) => (
            <div key={b.uid} className="absolute rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(255,230,80,0.9)]"
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: "8px", height: "16px",
                transform: "translate3d(-50%, -50%, 0)", willChange: "top" }} />
          ))}

          <div className="absolute"
            style={{ left: `${shipX}%`, top: `${SHIP_TOP}%`, transform: "translate3d(-50%, -50%, 0)",
              width: `${SHIP_W}%`, aspectRatio: "1 / 1", zIndex: 50,
              filter: "drop-shadow(0 6px 14px rgba(80,200,255,0.65))",
              willChange: "left" }}>
            <ShipSvg />
          </div>

          {pops.map((p) => (
            <div key={p.id}
              className={cn("absolute text-2xl font-extrabold pointer-events-none animate-bounce-in",
                p.good ? "text-success" : "text-destructive")}
              style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)",
                textShadow: "0 2px 4px rgba(0,0,0,0.6)", zIndex: 100 }}>
              {p.text}
            </div>
          ))}

          {flash && (
            <div className={cn("absolute inset-0 pointer-events-none animate-fade-in",
              flash === "good" ? "bg-success/20" : "bg-destructive/30")} />
          )}

          {paused && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm">
              <div className="text-6xl mb-3 animate-bounce">🚀</div>
              <div className="text-2xl font-extrabold text-info mb-1">Hazır?</div>
              <div className="text-xs font-bold text-muted-foreground mb-1">◀ ▶ hareket • Space ateş</div>
              <button onClick={() => startGame()} className="rounded-full bg-primary text-primary-foreground px-8 py-3 font-extrabold shadow-elegant animate-pulse mt-3">
                ▶ Başla
              </button>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
              <div className="text-5xl mb-2">💥</div>
              <div className="text-2xl font-extrabold text-destructive mb-1">Oyun Bitti</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">Puan: {score}</div>
              <button onClick={reset} className="rounded-full bg-primary text-primary-foreground px-8 py-3 font-extrabold shadow-elegant">
                🔁 Tekrar Oyna
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startMove(-1); }}
            onPointerUp={(e) => { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ } stopMove(); }}
            onPointerCancel={stopMove}
            onContextMenu={(e) => e.preventDefault()}
            className="rounded-2xl bg-secondary text-secondary-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center touch-none select-none">
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); fire(); }}
            className="rounded-2xl bg-primary text-primary-foreground py-5 font-extrabold shadow-soft active:scale-95 text-xl touch-none select-none">
            🔥 ATEŞ
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startMove(1); }}
            onPointerUp={(e) => { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ } stopMove(); }}
            onPointerCancel={stopMove}
            onContextMenu={(e) => e.preventDefault()}
            className="rounded-2xl bg-secondary text-secondary-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center touch-none select-none">
            <ChevronRight className="h-7 w-7" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default RunnerGame;
