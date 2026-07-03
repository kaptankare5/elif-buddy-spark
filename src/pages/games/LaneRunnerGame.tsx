import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback, playSpeech } from "@/lib/audio";
import { gamePool, pickN } from "./_shared";
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Heart, Volume2, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 🛤️ İki Yol Koşusu — pseudo-3D perspektifli koşu oyunu.
 */
const BASE_SPEED = 1.5;
const TICK_MS = 33;
const SPAWN_EVERY = 28;

interface Obj {
  uid: number;
  lane: 0 | 1;
  z: number;
  item: ContentItem;
  isTarget: boolean;
}
interface Pop { id: number; lane: 0 | 1; text: string; good: boolean }

let UID = 1;
let POP_UID = 1;

const LaneRunnerGame = () => {
  const [lane, setLane] = useState<0 | 1>(0);
  const [lastSwitchDir, setLastSwitchDir] = useState<-1 | 0 | 1>(0);
  const [objs, setObjs] = useState<Obj[]>([]);
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(true);
  const [pops, setPops] = useState<Pop[]>([]);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);

  const laneRef = useRef<0 | 1>(0); laneRef.current = lane;
  const targetRef = useRef<ContentItem | null>(null); targetRef.current = target;
  const pausedRef = useRef(true); pausedRef.current = paused;
  const scoreRef = useRef(0); scoreRef.current = score;
  const tickRef = useRef(0);

  const speed = BASE_SPEED + Math.min(1.1, scoreRef.current * 0.04);

  const pickTarget = useCallback((silent = false) => {
    const pool = gamePool();
    if (pool.length === 0) return;
    const item = pickNextGameItem(pool) || pool[0];
    setTarget(item);
    if (!silent && !pausedRef.current) {
      setTimeout(() => playSpeech(`Hangisi ${item.speech}?`, item.lang), 80);
    }
  }, []);

  useEffect(() => { pickTarget(true); }, [pickTarget]);

  const switchLane = useCallback((dir: -1 | 1) => {
    if (gameOver) return;
    if (paused) {
      setPaused(false);
      if (target) setTimeout(() => playSpeech(`Hangisi ${target.speech}?`, target.lang), 120);
      return;
    }
    setLane((l) => {
      const n = l + dir;
      if (n < 0 || n > 1) return l;
      setLastSwitchDir(dir);
      setTimeout(() => setLastSwitchDir(0), 220);
      return n as 0 | 1;
    });
  }, [gameOver, paused, target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); switchLane(-1); }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); switchLane(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switchLane]);

  const addPop = (lane: 0 | 1, text: string, good: boolean) => {
    const p: Pop = { id: POP_UID++, lane, text, good };
    setPops((prev) => [...prev, p]);
    setTimeout(() => setPops((prev) => prev.filter((q) => q.id !== p.id)), 900);
  };
  const flashFx = (k: "good" | "bad") => {
    setFlash(k); setTimeout(() => setFlash(null), 220);
  };

  useEffect(() => {
    if (gameOver || paused) return;
    const id = setInterval(() => {
      tickRef.current += 1;

      const spawnEvery = Math.max(18, SPAWN_EVERY - Math.floor(scoreRef.current / 2));
      if (tickRef.current % spawnEvery === 0 && targetRef.current) {
        setObjs((prev) => {
          const pool = gamePool();
          const useTarget = Math.random() < 0.5;
          let item: ContentItem;
          if (useTarget) item = targetRef.current!;
          else {
            const wrongs = pickN(pool.filter((p) => p.id !== targetRef.current!.id), 1);
            item = wrongs[0] || targetRef.current!;
          }
          const newLane = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
          if (prev.some((o) => o.lane === newLane && o.z < 30)) return prev;
          return [...prev, {
            uid: UID++, lane: newLane, z: 0, item,
            isTarget: item.id === targetRef.current!.id,
          }];
        });
      }

      setObjs((prev) => {
        const curTarget = targetRef.current?.id;
        const next: Obj[] = [];
        let hitTarget: Obj | null = null;
        let hitWrong: Obj | null = null;
        let missedTarget = false;
        for (const o of prev) {
          const nz = o.z + speed;
          if (nz >= 100) {
            if (o.lane === laneRef.current) {
              if (o.item.id === curTarget) hitTarget = o;
              else hitWrong = o;
            } else if (o.item.id === curTarget) {
              missedTarget = true;
            }
            continue;
          }
          next.push({ ...o, z: nz, isTarget: o.item.id === curTarget });
        }

        if (hitTarget) {
          recordGameAnswer(hitTarget.item, true);
          playSpeech(hitTarget.item.speech, hitTarget.item.lang);
          setScore((s) => s + 1); setCombo((c) => c + 1);
          addPop(hitTarget.lane, "+1", true);
          flashFx("good");
          setTimeout(pickTarget, 350);
        }
        if (hitWrong) {
          recordGameAnswer(targetRef.current!, false);
          playFeedback(false); setCombo(0);
          addPop(hitWrong.lane, "✗", false);
          flashFx("bad");
          setLives((l) => { const nl = l - 1; if (nl <= 0) setGameOver(true); return nl; });
        }
        if (missedTarget && !hitTarget) {
          recordGameAnswer(targetRef.current!, false);
          setCombo(0);
          setLives((l) => { const nl = l - 1; if (nl <= 0) setGameOver(true); return nl; });
          setTimeout(pickTarget, 350);
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [gameOver, paused, pickTarget, speed]);

  const reset = () => {
    setLane(0); setObjs([]); setScore(0); setCombo(0);
    setLives(3); setGameOver(false); setPaused(true); setPops([]);
    UID = 1; POP_UID = 1; tickRef.current = 0;
    setTimeout(() => pickTarget(true), 0);
  };

  // Perspektif yardımcıları: yatay 0..100 ekran, dikey z 0(uzak,top%20)..100(ön,top%88)
  const zToTop = (z: number) => 22 + (z / 100) * 66;
  const zToScale = (z: number) => 0.22 + Math.pow(z / 100, 1.4) * 1.2;
  // Yolun her z için sol/sağ x koordinatları (trapez kenarları)
  const laneX = (l: 0 | 1, z: number) => {
    // Uzakta: sol 42, sağ 58. Önde: sol 18, sağ 82.
    const t = z / 100;
    const left = 42 - t * 24;   // 42→18
    const right = 58 + t * 24;  // 58→82
    const mid = (left + right) / 2;
    return l === 0 ? (left + mid) / 2 : (right + mid) / 2;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-200/30 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🛤️ İki Yol Koşusu" backTo="/oyunlar" centered onReset={reset} />

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
            onClick={() => target && playSpeech(`Hangisi ${target.speech}?`, target.lang)}
            disabled={!target}
            className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl p-3 mb-3 border-2 bg-warning/15 border-warning/50 text-center min-h-[64px]">
          <p className="text-xs font-bold text-muted-foreground">🎯 Doğru yola geç, topla!</p>
          <p className="text-3xl mt-1"><EmojiView value={target?.emoji ?? "—"} /> <span className="text-base font-bold text-foreground/70">{target?.label ?? ""}</span></p>
        </div>

        <div
          className="relative w-full overflow-hidden rounded-2xl shadow-card border-4 border-indigo-400/50 select-none touch-none"
          style={{ aspectRatio: "4 / 5", maxHeight: "62vh", margin: "0 auto", perspective: "700px", perspectiveOrigin: "50% 30%" }}
        >
          {/* Gökyüzü */}
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(210_85%_72%)] via-[hsl(200_90%_84%)] to-[hsl(95_55%_72%)]" />
          <div className="absolute top-[6%] right-[12%] w-14 h-14 rounded-full bg-yellow-200 shadow-[0_0_35px_rgba(255,230,100,0.7)]" />

          {/* Uzak dağlar */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <polygon points="0,22 18,8 32,18 50,5 68,16 85,8 100,20 100,25 0,25"
              fill="hsl(220 30% 55%)" opacity="0.6" />
          </svg>

          {/* Bulutlar */}
          <div className="absolute top-[4%] left-0 w-[200%] animate-cloud text-3xl opacity-80 pointer-events-none">
            <span className="mr-[40%]">☁️</span><span className="mr-[40%]">☁️</span><span>☁️</span>
          </div>

          {/* Çim alanı */}
          <div className="absolute left-0 right-0 bottom-0 top-[22%] bg-gradient-to-b from-[hsl(110_55%_55%)] to-[hsl(115_60%_42%)]" />

          {/* 3D Yol zemini — rotateX ile gerçek perspektif */}
          <div
            className="absolute left-1/2 -translate-x-1/2 overflow-hidden"
            style={{
              top: "22%",
              width: "180%",
              height: "120%",
              transform: "rotateX(62deg)",
              transformOrigin: "50% 0%",
              backgroundImage: `
                linear-gradient(to bottom, hsl(30 35% 50%), hsl(28 40% 38%)),
                repeating-linear-gradient(to bottom, transparent 0 60px, hsl(0 0% 100% / 0.85) 60px 80px),
                linear-gradient(to right, transparent 0 49.4%, hsl(0 0% 100% / 0.6) 49.4% 50.6%, transparent 50.6% 100%)
              `,
              backgroundBlendMode: "normal, screen, normal",
              backgroundSize: "100% 100%, 100% 140px, 100% 100%",
              animation: paused ? undefined : "ground-scroll 0.6s linear infinite",
              boxShadow: "inset 0 30px 60px rgba(0,0,0,0.35)",
            }}
          />

          {/* (3D yol artık üstte CSS perspective ile çiziliyor) */}

          {/* Yan ağaçlar — perspektifte 4-5 tane */}
          {[
            { z: 25, side: -1 }, { z: 25, side: 1 },
            { z: 55, side: -1 }, { z: 55, side: 1 },
            { z: 85, side: -1 }, { z: 85, side: 1 },
          ].map((t, i) => {
            const s = zToScale(t.z);
            const offset = t.side === -1 ? 8 - t.z * 0.18 : 92 + t.z * 0.18;
            return (
              <div key={i} className="absolute leading-none"
                style={{
                  left: `${offset}%`,
                  top: `${zToTop(t.z)}%`,
                  transform: `translate(-50%, -90%) scale(${s})`,
                  fontSize: "42px",
                  filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.2))",
                  zIndex: Math.floor(t.z),
                }}>
                🌳
              </div>
            );
          })}

          {/* Nesneler */}
          {objs.map((o) => {
            const s = zToScale(o.z);
            return (
              <div key={o.uid} className="absolute leading-none"
                style={{
                  left: `${laneX(o.lane, o.z)}%`,
                  top: `${zToTop(o.z)}%`,
                  transform: `translate(-50%, -50%) scale(${s})`,
                  fontSize: "48px",
                  zIndex: Math.floor(o.z) + 50,
                  filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.35))",
                }}>
                {o.isTarget && (
                  <div className="absolute inset-0 -m-2 rounded-full border-4 border-warning/90 animate-pulse" />
                )}
                <span className={cn(o.isTarget && "animate-float")}><EmojiView value={o.item.emoji} /></span>
              </div>
            );
          })}

          {/* Karakter — önde */}
          <div
            className={cn("absolute leading-none transition-all duration-150", !paused && "animate-run-bob")}
            style={{
              left: `${laneX(lane, 100)}%`,
              top: "92%",
              transform: `translate(-50%, -100%) rotate(${lastSwitchDir * 12}deg)`,
              fontSize: "64px",
              zIndex: 250,
              filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.4))",
            }}
          >
            🏃
          </div>
          {/* Karakter gölgesi */}
          <div
            className="absolute rounded-full bg-black/40 blur-sm transition-all duration-150"
            style={{
              left: `${laneX(lane, 100)}%`,
              top: "91%",
              width: "12%",
              height: "2.5%",
              transform: "translate(-50%, 0)",
              zIndex: 240,
            }}
          />

          {/* Pop skor */}
          {pops.map((p) => (
            <div key={p.id}
              className={cn("absolute text-2xl font-extrabold pointer-events-none animate-bounce-in",
                p.good ? "text-success" : "text-destructive")}
              style={{
                left: `${laneX(p.lane, 100)}%`, top: "75%",
                transform: "translate(-50%, -100%)",
                textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                zIndex: 300,
              }}>
              {p.text}
            </div>
          ))}

          {/* Hız çizgileri */}
          {!paused && !gameOver && combo >= 3 && (
            <div className="absolute inset-0 pointer-events-none">
              {[30, 50, 70].map((t, i) => (
                <div key={i} className="absolute h-0.5 bg-white/60 rounded-full animate-speed-line"
                  style={{ top: `${t}%`, width: "25%", left: "65%", animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          )}

          {flash && (
            <div className={cn("absolute inset-0 pointer-events-none animate-fade-in",
              flash === "good" ? "bg-success/20" : "bg-destructive/30")} />
          )}

          {paused && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm">
              <div className="text-6xl mb-3 animate-bounce">🛤️</div>
              <div className="text-2xl font-extrabold text-info mb-1">Hazır?</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">◀ ▶ tuşları ile yol değiştir</div>
              <button onClick={() => switchLane(1)} className="rounded-full bg-primary text-primary-foreground px-8 py-3 font-extrabold shadow-elegant animate-pulse">
                ▶ Başla
              </button>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
              <div className="text-5xl mb-2">🏁</div>
              <div className="text-2xl font-extrabold text-destructive mb-1">Oyun Bitti</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">Puan: {score}</div>
              <button onClick={reset} className="rounded-full bg-primary text-primary-foreground px-8 py-3 font-extrabold shadow-elegant">
                🔁 Tekrar Oyna
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => switchLane(-1)} className="rounded-2xl bg-primary text-primary-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center gap-1 text-xl">
            <ChevronLeft className="h-8 w-8" /> SOL
          </button>
          <button onClick={() => switchLane(1)} className="rounded-2xl bg-primary text-primary-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center gap-1 text-xl">
            SAĞ <ChevronRight className="h-8 w-8" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default LaneRunnerGame;
