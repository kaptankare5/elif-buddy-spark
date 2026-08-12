import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Volume2, Eye } from "lucide-react";
import { gamePool } from "./_shared";
import { useAskLayer } from "./_askUI";
import { recordLetterMastery } from "@/data/srs";
import { pickNextGameItem, recordGameAnswer, showHintFor } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
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
  const ask = useAskLayer();
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState(false); // doğru cevapta ışık parlaması (normal mod kolaylık)
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const newRound = () => {
    const pool = gamePool();
    const tgt = pickNextGameItem(pool) || pool[0];
    setTarget(tgt);
    // Klasikte 5 balon; şimşek/tabela modunda şık sayısı azalır (yazı okumak
    // glif taramaktan yavaştır, balonlar da yukarı kaçıyor).
    const all = ask.secenekler(pool, tgt, 5);
    // Yatay yerleşim şık SAYISINA göre — 2 balonu sola yığmasın.
    const aralik = 100 / (all.length + 1);
    setBalloons(all.map((it, i) => ({
      uid: `${it.id}-${Date.now()}-${i}`,
      item: it,
      x: aralik * (i + 1) + (Math.random() * 6 - 3),
      y: 100 + i * 15,
      speed: 0.18 + Math.random() * 0.12,
      popped: false,
    })));
    void ask.sor(tgt);
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
    // Karışıklık ölçümü: hangi balonu patlattı + ekranda hangileri vardı
    recordGameAnswer(target, correct, {
      chosenId: b.item.id, shownIds: balloons.map((x) => x.item.id),
    });
    if (correct) {
      setScore((s) => s + 1);
      setFlash(true); setTimeout(() => setFlash(false), 450); // ışık parlaması
      await playFeedback(true);
      ask.cevapSesi(target, true);   // yazılı modda harfin gerçek okunuşu
      setTimeout(newRound, 900);
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

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Doğru</div>
            <div className="text-xl font-extrabold text-success">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-destructive/30">
            <div className="text-[10px] font-bold text-muted-foreground">Yanlış</div>
            <div className="text-xl font-extrabold text-destructive">{misses}</div>
          </div>
          <button
            onClick={() => ask.tekrar(target)}
            disabled={ask.mode === "ustte"}
            className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            {ask.mode === "flash" ? <Eye className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {ask.mode === "flash" ? "Göster" : "Dinle"}
          </button>
        </div>

        <div className="bg-card rounded-2xl p-3 mb-3 shadow-card border-2 border-primary/20 text-center">
          <p className="text-xs font-bold text-muted-foreground">
            {ask.yazili ? "Gördüğün harfin adını patlat:" : "Sesi dinle, doğru balonu patlat:"}
          </p>
          {ask.mode === "ustte" ? (
            // Ortak tabela: glif kırpılmasın diye leading/pay orada ayarlı.
            ask.tabela(target, { className: "mb-0 mt-1", boy: "text-5xl" })
          ) : (
            <button onClick={() => ask.tekrar(target)} className="text-5xl mt-1" aria-label="Tekrar">
              {ask.mode === "flash" ? "👁️" : "🔊"}
            </button>
          )}
        </div>

        <div className="relative bg-gradient-to-b from-info/10 to-info/30 rounded-3xl shadow-card border-4 border-info/30 overflow-hidden" style={{ height: "60vh" }}>
          {/* Doğru cevap ışık parlaması (normal modda kolaylık hissi) */}
          {flash && (
            <div className="pointer-events-none absolute inset-0 z-10 animate-fade-in"
                 style={{ background: "radial-gradient(circle at 50% 60%, hsl(var(--warning)/0.55), transparent 60%)" }} />
          )}
          {balloons.map((b, i) => {
            const isCorrect = !!target && b.item.id === target.id;
            // İpucu halkası: L1 + daha önce görülmüş harf (showHintFor).
            const hint = isCorrect && !b.popped && showHintFor(b.item);
            return (
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
                  "flex items-center justify-center shadow-card",
                  // Yazılı modda balon yerine GENİŞ TABELA: "Be (başta)" gibi bir ad
                  // 64 piksellik baloncuğa sığmıyor, taşıp okunmaz oluyordu.
                  ask.yazili ? "w-28 h-16 rounded-2xl px-1" : "w-16 h-20 rounded-[50%]",
                  COLORS[i % COLORS.length],
                  hint && "ring-4 ring-warning ring-offset-2 ring-offset-transparent animate-pulse",
                )}>
                  <span className={cn(ask.yazili ? "text-base text-white" : "text-3xl")}>
                    {ask.sik(b.item)}
                  </span>
                </div>
                <div className="w-px h-4 bg-foreground/40 mx-auto" />
              </button>
            );
          })}
        </div>
      </main>
      {ask.katman}
    </div>
  );
};

export default BalloonGame;
