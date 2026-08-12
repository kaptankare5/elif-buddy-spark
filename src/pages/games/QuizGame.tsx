import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Volume2, Eye, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { gardenTease } from "@/lib/sessionEnd";
import { gamePool } from "./_shared";
import { useAskLayer } from "./_askUI";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";

interface Q { target: ContentItem; options: ContentItem[]; }

type Secici = (pool: ContentItem[], target: ContentItem, k: number) => ContentItem[];

function makeQ(secenekler: Secici): Q {
  const pool = gamePool();
  const target = pool[Math.floor(Math.random() * pool.length)];
  return { target, options: secenekler(pool, target, 4) };
}

const QuizGame = () => {
  const ask = useAskLayer();
  const [q, setQ] = useState<Q>(() => makeQ(ask.secenekler));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(60);
  const questionStartRef = useRef<number>(Date.now());
  const teaseRef = useRef(gardenTease()); // yüksek notada bitiş — sabit tek cümle

  useEffect(() => {
    const t = setInterval(() => setTime((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void ask.sor(q.target);
    questionStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.target.id]);

  useEffect(() => {
    const h = () => { setScore(0); setTime(60); setQ(makeQ(ask.secenekler)); setPicked(null); };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  }, [ask.secenekler]);

  const choose = async (item: ContentItem) => {
    if (picked || time <= 0) return;
    setPicked(item.id);
    const correct = item.id === q.target.id;
    if (correct) setScore((s) => s + 1);
    const responseMs = Date.now() - questionStartRef.current;
    recordGameAnswer(q.target, correct, {
      responseMs, gameId: "quiz",
      chosenId: item.id, shownIds: q.options.map((o) => o.id),
    });
    await playFeedback(correct);
    // Yazılı modda doğru cevaptan sonra harfin GERÇEK OKUNUŞU çalar; kayıt
    // BİTMEDEN yeni soru gelmez (klasikte söz hemen çözülür).
    await ask.cevapSesi(q.target, correct);
    setTimeout(() => { setQ(makeQ(ask.secenekler)); setPicked(null); }, correct ? 700 : 1800);
  };

  const ended = time <= 0;
  // Süre dolunca bekleyen telafi açılır
  useRemedyOnGameOver(ended);
  const reset = () => { setScore(0); setTime(60); setQ(makeQ(ask.secenekler)); setPicked(null); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="⚡ Hızlı Quiz" backTo="/oyunlar" centered onReset={reset} />

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
            <p className="text-lg text-muted-foreground mb-3">Skorun: <span className="text-success font-extrabold">{score}</span></p>
            {/* Yüksek notada bitiş — Zeigarnik + bahçe teşviki (yarın geri getirir) */}
            <div className="mb-4 rounded-2xl bg-success/10 border-2 border-success/30 px-4 py-2.5 text-sm font-extrabold text-success">
              {teaseRef.current}
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={reset} className="rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground shadow-card transition-bouncy hover:scale-105">Tekrar Oyna</button>
              <Link to="/bahce" className="inline-flex items-center gap-1.5 rounded-full bg-success px-5 py-3 font-bold text-success-foreground shadow-card transition-bouncy hover:scale-105">
                <Sprout className="h-5 w-5" /> Bahçem
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-3xl p-6 shadow-card border-4 border-primary/20 mb-4 text-center animate-bounce-in" key={q.target.id}>
              <p className="text-sm font-bold text-muted-foreground mb-2">
                {ask.yazili ? "Gördüğün harfin adı hangisi?" : "Hangisi?"}
              </p>
              {/* "Tabela" modunda glif zaten ekranda asılı — tekrar düğmesi anlamsız
                  (ses çalmak adı söylemek = cevabı vermek olurdu). */}
              {ask.mode !== "ustte" && (
                <button onClick={() => ask.tekrar(q.target)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105">
                  {ask.mode === "flash" ? <Eye className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  {ask.tekrarEtiketi}
                </button>
              )}
            </div>
            {ask.tabela(q.target)}
            <div className={cn("grid gap-3", q.options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
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
                    <span className={cn(ask.yazili ? "text-2xl" : "text-7xl")}>
                      {ask.sik(opt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
      {ask.katman}
    </div>
  );
};

export default QuizGame;
