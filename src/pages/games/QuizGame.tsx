import { useEffect, useRef, useState } from "react";
import { useSecenekTuslari, usePcMi } from "@/lib/klavye";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback, tone } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Volume2, Eye, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import { gardenTease } from "@/lib/sessionEnd";
import { gamePool } from "./_shared";
import { useAskLayer } from "./_askUI";
import { sureIcin } from "@/lib/zorluk";
import { useOyunSonu } from "@/lib/oyunSonucu";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";
import { sfx, titre } from "@/lib/juice";

interface Q { target: ContentItem; options: ContentItem[]; }

type Secici = (pool: ContentItem[], target: ContentItem, k: number) => ContentItem[];

function makeQ(secenekler: Secici): Q {
  const pool = gamePool();
  const target = pool[Math.floor(Math.random() * pool.length)];
  return { target, options: secenekler(pool, target, 4) };
}

const QuizGame = () => {
  const ask = useAskLayer();
  // Arka arkaya doğru — juice sesi her seferinde tizleşir (Mario para kuralı).
  const seri = useRef(0);
  const [seriGoster, setSeriGoster] = useState(0);
  const carpan = Math.min(3, 1 + Math.floor(seriGoster / 3));
  const [q, setQ] = useState<Q>(() => makeQ(ask.secenekler));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  // Süre zorluğa bağlı: Kolay 90 sn, Orta 60, Zor 45. Okumayı yeni öğrenen
  // çocuk 60 sn'de ancak 6-7 soruya yetişiyordu.
  const sureRef = useRef(sureIcin(60));
  const [time, setTime] = useState(sureRef.current);
  const questionStartRef = useRef<number>(Date.now());
  const teaseRef = useRef(gardenTease()); // yüksek notada bitiş — sabit tek cümle

  /**
   * ⚠️ SON SANİYELERDE TIK SESİ. Bu türün (Kahoot ve akrabaları) gerilimi
   * büyük ölçüde geri sayım MÜZİĞİNDEN geliyor — bu uygulamada müzik YOK
   * (audio.ts kuralı). Karşılığı tek atımlık bir bildirim tonu: son 5
   * saniyede saniyede bir "tık", her saniye biraz daha tiz. Melodi değil,
   * saat sesi. ⚠️ Ses AÇILIŞTA çalmaz (time === sure) ve süre bitince
   * susar — "bitti" sesiyle çakışmasın.
   */
  useEffect(() => {
    const t = setInterval(() => setTime((s) => {
      const yeni = Math.max(0, s - 1);
      if (yeni > 0 && yeni <= 5) tone(680 + (5 - yeni) * 90, 0.06, "sine", 0, 0.10);
      return yeni;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void ask.sor(q.target);
    questionStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.target.id]);

  useEffect(() => {
    const h = () => { sureRef.current = sureIcin(60); setScore(0); setTime(sureRef.current); setQ(makeQ(ask.secenekler)); setPicked(null); };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  }, [ask.secenekler]);

  // PC: 1-2-3-4 tuşlarıyla şık seçilebilsin (fare zorunlu olmasın).
  const pc = usePcMi();
  useSecenekTuslari(q?.options.length ?? 0, (i) => { const o = q?.options[i]; if (o) void choose(o); }, !!q);
  const choose = async (item: ContentItem) => {
    // ⚠️ SES ŞIKLARI: ilk dokunuş yalnız DİNLETİR, ikincisi seçer. Şık
    // görünmez (hoparlör) olduğu için dinlemeden seçmek kör atış olurdu.
    // Öteki modlarda `onayla` hep true döner.
    if (!ask.onayla(item)) return;
    if (picked || time <= 0) return;
    setPicked(item.id);
    const correct = item.id === q.target.id;
    // ⚠️ Q-1 SERİ ÇARPANI (Kahoot'un "ardışık doğru bonusu"): 12. doğru cevap
    // 1. doğru cevapla aynı puanı verince ivme hissi oluşmuyordu. Çarpan 1→3
    // arasında; yanlışta sıfırlanır. Tavan 3, yoksa puan anlamsızlaşıyor.
    if (correct) { setScore((sc) => sc + carpan); setSeriGoster(seri.current + 1); }
    else setSeriGoster(0);
    const responseMs = Date.now() - questionStartRef.current;
    recordGameAnswer(q.target, correct, {
      responseMs, gameId: "quiz",
      chosenId: item.id, shownIds: q.options.map((o) => o.id),
    });
    if (correct) { sfx("topla", { seri: seri.current++ }); titre("basari"); }
    else { seri.current = 0; sfx("carp"); titre("hata"); }
    await playFeedback(correct);
    // Yazılı modda doğru cevaptan sonra harfin GERÇEK OKUNUŞU çalar; kayıt
    // BİTMEDEN yeni soru gelmez (klasikte söz hemen çözülür).
    await ask.cevapSesi(q.target, correct);
    setTimeout(() => { setQ(makeQ(ask.secenekler)); setPicked(null); }, correct ? 700 : 1800);
  };

  const ended = time <= 0;
  const rapor = useOyunSonu("quiz", ended, score, { birim: "puan" });
  // Süre dolunca bekleyen telafi açılır
  useRemedyOnGameOver(ended);
  const reset = () => { sureRef.current = sureIcin(60); seri.current = 0; setSeriGoster(0); setScore(0); setTime(sureRef.current); setQ(makeQ(ask.secenekler)); setPicked(null); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="⚡ Hızlı Quiz" backTo="/oyunlar" centered onReset={reset} />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-warning/30">
            <div className="text-xs text-muted-foreground font-bold">Puan</div>
            <div className="text-2xl font-extrabold text-success">⭐ {score}</div>
            {carpan > 1 && (
              <div className="mt-0.5 text-[11px] font-extrabold text-warning animate-juice-pop" key={carpan}>
                ×{carpan} seri!
              </div>
            )}
          </div>
          {/* ⚠️ SÜRE BASKISI GÖRÜNMÜYORDU: 60 sn de 5 sn de aynı sakin mavi
              sayıydı, oyunun tek gerilim kaynağı hiç hissedilmiyordu. Son
              10 saniyede sayaç kızarır ve HER SANİYE bir kez atar (`key`
              değiştiği için animasyon yeniden başlar). */}
          <div className={cn(
            "rounded-2xl bg-card p-3 text-center shadow-card border-2 transition-bouncy",
            time <= 10 ? "border-destructive/70 scale-105" : "border-info/30",
          )}>
            <div className="text-xs text-muted-foreground font-bold">Süre</div>
            <div
              key={time <= 10 ? time : "sakin"}
              className={cn(
                "text-2xl font-extrabold tabular-nums",
                time <= 10 ? "text-destructive animate-juice-pop" : "text-info",
              )}
            >
              ⏱ {time}s
            </div>
          </div>
        </div>

        {ended ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-card border-4 border-success/40 animate-bounce-in">
            <div className="text-7xl mb-3">🏆</div>
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Tebrikler!</h2>
            {rapor?.rekor && (
              <div className="mb-2 inline-block rounded-full bg-warning/20 px-3 py-1 text-xs font-extrabold text-warning">🏆 YENİ REKOR</div>
            )}
            <p className="text-lg text-muted-foreground mb-1">Skorun: <span className="text-success font-extrabold">{score}</span></p>
            {rapor?.oncekiEnIyi != null && (
              <p className="mb-3 text-sm font-bold text-muted-foreground">
                {rapor.rekor ? <>eskisi {rapor.oncekiEnIyi}</> : <>rekorun {rapor.oncekiEnIyi}{rapor.kalan != null && <> · <span className="text-primary">{rapor.kalan} kaldı!</span></>}</>}
              </p>
            )}
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
              {/* Glifin ASILI durduğu modlarda (Tabela / Ses Şıkları / Şekil
                  Eşleme) tekrar düğmesi anlamsız: ses çalmak adı söylemek =
                  cevabı vermek olurdu. Mod adı yerine `tekrarVar` okunur ki
                  yeni mod eklendiğinde burası unutulmasın. */}
              {ask.tekrarVar && (
                <button onClick={() => ask.tekrar(q.target)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105">
                  {ask.mode === "flash" ? <Eye className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  {ask.tekrarEtiketi}
                </button>
              )}
            </div>
            {ask.tabela(q.target)}
            <div className={cn("grid gap-3", q.options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {q.options.map((opt, i) => {
                const isCorrect = !!picked && opt.id === q.target.id;
                const isWrong = picked === opt.id && opt.id !== q.target.id;
                return (
                  <button key={opt.id} onClick={() => choose(opt)}
                    className={cn(
                    // basılma tepkisi: dokunma anında, JS beklemeden
                    "transition-transform active:scale-95",
                      "relative aspect-square rounded-3xl flex items-center justify-center shadow-card border-4 transition-bouncy bg-card border-primary/20 hover:-translate-y-1",
                      isCorrect && "bg-success border-success animate-pop",
                      isWrong && "bg-destructive border-destructive animate-shake",
                    )}>
                    {/* PC'de tuş rozeti: fare zorunlu olmasın, 1-4 ile de seçilsin */}
                    {pc && (
                      <span className="absolute left-2 top-2 rounded-md bg-muted px-1.5 text-xs font-extrabold text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
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
