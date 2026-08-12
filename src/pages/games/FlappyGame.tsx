import { useEffect, useRef, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { gamePool, shuffle, pickWrongs } from "./_shared";
import { useAskLayer } from "./_askUI";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { recordLetterMastery } from "@/data/srs";
import { enqueueRetryItem, getGameItemLevel, pickNextGameItem, recordGameAnswer, showHintFor } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Volume2, Eye, Heart } from "lucide-react";

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
/** Yazılı modda kutu bu oranda GENİŞ olur; çarpışma da yatayda o kadar esner. */
const HIT_X_ESNEK = 2.1;
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
  // ⚠️ Burada harfin kendisi ÇARPIŞMA ALANI. Yazılı modda kutu genişlemek
  // zorunda (bir ada 14% yetmiyor); o yüzden çarpışma testi yatayda
  // ESNETİLİR (`HIT_X_ESNEK`) — kutu ne kadar genişse çarpışma da o kadar
  // geniş. Yoksa çocuk yazının ortasına nişan almak zorunda kalır ve
  // kenarından geçtiğinde "vurmadım" der.
  // (Kullanıcı şartı: "uçtuğu şeyler yazı olur, harflerden kaçmaz.")
  const ask = useAskLayer({ flashBoy: "min(4.2rem, 17vw)" });
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
  // Oyun bitince (öldü) bekleyen telafi açılır — oyunun ortasında asla.
  useRemedyOnGameOver(gameOver);
  const [paused, setPaused] = useState(true);

  const tickRef = useRef(0);
  const velRef = useRef(0); velRef.current = vel;
  const yRef = useRef(40); yRef.current = birdY;
  const targetRef = useRef<ContentItem | null>(null); targetRef.current = target;
  const askRef = useRef(ask); askRef.current = ask;
  const yaziliRef = useRef(ask.yazili); yaziliRef.current = ask.yazili;

  const pausedRef = useRef(true); pausedRef.current = paused;

  const pickTarget = useCallback((silent = false) => {
    const pool = gamePool();
    const item = pickNextGameItem(pool) || pool[0];
    setTarget(item);
    if (!silent && !pausedRef.current) void askRef.current.sor(item);
  }, []);

  // İlk hedef — sessiz seç, oyun başlayınca seslendir
  useEffect(() => { pickTarget(true); }, [pickTarget]);

  const flap = useCallback(() => {
    if (gameOver) return;
    if (paused) {
      setPaused(false);
      // ilk uçuşta hedefi seslendir
      if (target) void askRef.current.sor(target);
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
          const a = askRef.current;
          // ⚠️ Yazılı modda çeldirici ADA göre seçilir (yoksa çocuk kelimeyi
          // okumadan seçer) VE aynı adı taşıyan öğe ELENİR: ثَ ile سَ ikisi de
          // "se" okunur; ikisi birden uçarsa sorunun iki doğru cevabı olur.
          const wrongs = a.ayriAdlar(
            a.celdiriciler(pool, targetRef.current, chosenSlots.length - 1),
            chosenSlots.length - 1,
          );
          const items = shuffle([targetRef.current!, ...wrongs]).slice(0, chosenSlots.length);
          if (chosenSlots.length === 1 && Math.random() < 0.5 && wrongs.length === 0) {
            const w = a.ayriAdlar(a.celdiriciler(pool, targetRef.current, 1), 1);
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
          // Yazılı modda kutu yatayda HIT_X_ESNEK kat geniş: dx'i o oranda
          // küçülterek çarpışma elipsini kutuyla aynı yapıyoruz.
          const dx = (l.x - BIRD_X) / (yaziliRef.current ? HIT_X_ESNEK : 1);
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
          playFeedback(true);
          setScore((s) => s + 1);
          next = next.filter((l) => {
            if (l.missed) return true;
            const dx = l.x - BIRD_X, dy = l.y - by;
            return dx * dx + dy * dy > NEAR_PLUS_SQ;
          });
          setEaten((e) => e + 1);
          // ⚠️ Kayıt bitmeden yeni hedef seçilmemeli (yazılı modda).
          void askRef.current.cevapSesi(collidedTarget.item, true)
            .then(() => setTimeout(pickTarget, 250));
          return next;
        }
        if (collidedWrong) {
          recordLetterMastery(targetRef.current!.id, false);
          recordGameAnswer(targetRef.current!, false, { chosenId: collidedWrong.item.id });
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
            onClick={() => ask.tekrar(target)}
            disabled={!target || ask.mode === "ustte"}
            className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            {ask.mode === "flash" ? <><Eye className="h-4 w-4" /> Göster</> : <><Volume2 className="h-4 w-4" /> Dinle</>}
          </button>
        </div>

        <div className="rounded-2xl p-3 mb-3 border-2 bg-warning/15 border-warning/50 text-center min-h-[64px]">
          <p className="text-xs font-bold text-muted-foreground">
            {ask.yazili ? "🎯 Gördüğün harfin ADINI yut!" : "🎯 Sesi dinle ve doğru harfi yut!"}
          </p>
          {/* ⚠️ Yazılı modda `subLabel` YAZILMAZ — orada harfin okunuşu var,
              yani cevabın ta kendisi. Onun yerine GLİF asılır. */}
          {ask.mode === "ustte"
            ? ask.tabela(target, { className: "mb-0 mt-1", boy: "text-5xl" })
            : <p className="text-2xl font-extrabold text-foreground mt-1">{ask.yazili ? "" : (target?.subLabel ?? "—")}</p>}
        </div>

        <div
          onPointerDown={(e) => { e.preventDefault(); flap(); }}
          className="relative w-full overflow-hidden rounded-3xl shadow-elegant border-[6px] border-sky-300/70 select-none touch-none"
          style={{
            aspectRatio: "5 / 6", maxHeight: "60vh", margin: "0 auto", contain: "layout paint size",
            // Gerçek bir gökyüzü: üstte doygun mavi, ufka doğru açılır.
            background: "linear-gradient(180deg, hsl(203 92% 72%) 0%, hsl(199 95% 84%) 45%, hsl(48 96% 88%) 78%, hsl(96 55% 72%) 100%)",
          }}
        >
          {/* ⚠️ DEKOR TAMAMEN CSS — ek dosya/doku yok, oyun döngüsüne
              dokunmaz (hepsi `pointer-events-none` ve sabit katman).
              Kullanıcı "çok sade" dedi: gökyüzü, güneş, kayan bulutlar,
              tepeler ve akan çim şeridi eklendi. */}
          <div className="pointer-events-none absolute inset-0">
            {/* güneş + halesi */}
            <div className="absolute right-[12%] top-[8%] h-14 w-14 rounded-full bg-yellow-300 shadow-[0_0_40px_18px_rgba(253,224,71,0.55)]" />
            {/* kayan bulutlar (üç katman, farklı hız = derinlik) */}
            {[
              { t: "14%", s: 1.0, d: "26s", o: 0.95 },
              { t: "32%", s: 0.7, d: "38s", o: 0.75 },
              { t: "52%", s: 1.25, d: "48s", o: 0.6 },
            ].map((c, i) => (
              <div key={i} className="absolute left-full" style={{
                top: c.t, opacity: c.o, transform: `scale(${c.s})`,
                animation: `kus-bulut ${c.d} linear infinite`, animationDelay: `${-i * 9}s`,
              }}>
                <div className="relative h-8 w-24">
                  <div className="absolute inset-x-0 bottom-0 h-5 rounded-full bg-white" />
                  <div className="absolute left-3 bottom-2 h-8 w-8 rounded-full bg-white" />
                  <div className="absolute left-10 bottom-3 h-10 w-10 rounded-full bg-white" />
                </div>
              </div>
            ))}
            {/* uzak tepeler */}
            <div className="absolute inset-x-0 bottom-[9%] h-[22%]">
              <div className="absolute -left-6 bottom-0 h-full w-2/3 rounded-t-[100%] bg-emerald-300/60" />
              <div className="absolute right-[-10%] bottom-0 h-[80%] w-2/3 rounded-t-[100%] bg-emerald-400/55" />
            </div>
            {/* zemin + akan çim */}
            <div className="absolute inset-x-0 bottom-0 h-[9%] bg-gradient-to-b from-emerald-500 to-emerald-700" />
            <div className="absolute inset-x-0 bottom-[9%] h-2 bg-emerald-400" style={{
              backgroundImage: "repeating-linear-gradient(90deg, hsl(140 60% 45%) 0 10px, hsl(140 55% 52%) 10px 20px)",
              animation: "kus-zemin 1.6s linear infinite",
            }} />
          </div>
          <style>{`
            @keyframes kus-bulut { from { transform: translateX(0); } to { transform: translateX(calc(-100vw - 140px)); } }
            @keyframes kus-zemin { from { background-position-x: 0; } to { background-position-x: -20px; } }
          `}</style>

          {/* Bird */}
          <div
            className="absolute flex items-center justify-center text-4xl drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]"
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
            const showRing = l.isTarget && showHintFor(l.item);
            return (
              <div
                key={l.uid}
                className={cn(
                  "absolute flex items-center justify-center font-extrabold border-2 shadow-soft transition-colors",
                  ask.yazili ? "rounded-2xl px-1 leading-tight" : "rounded-full",
                  l.missed
                    ? "bg-destructive text-white border-white ring-4 ring-destructive/40 animate-pulse scale-110 z-20"
                    : showRing
                    ? "bg-warning/30 border-warning text-foreground"
                    : "bg-card border-border text-foreground",
                )}
                style={{
                  left: `${l.x}%`,
                  top: `${l.y}%`,
                  width: `${HIT_R * 2 * (ask.yazili ? HIT_X_ESNEK : 1)}%`,
                  height: `${HIT_R * 2 * (ask.yazili ? 0.72 : 1)}%`,
                  transform: "translate3d(-50%, -50%, 0)",
                  fontSize: ask.yazili ? "min(3.6vw, 15px)" : "min(6vw, 28px)",
                  willChange: "left",
                }}
              >
                {ask.sik(l.item)}
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
      {ask.katman}
    </div>
  );
};

export default FlappyGame;
