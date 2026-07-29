// Ezber çalışma ekranı — "Devamını Getir" (hafızlık anticipation yöntemi).
//
// Döngü: sistem hedef parçadan önceki parçaları ipucu olarak gösterir
// (seviye yükseldikçe ipucu AZALIR — bağlam soldurma), hedef parça gizlidir;
// çocuk içinden okur, "Göster"e basar, ✅/❌ ile kendini işaretler.
// Yanlış: -2 seviye + tekrar kuyruğu (hemen yeniden gelir). Yeni parçalar
// sıralı açılır (hafızlık zinciri). Mantık: src/lib/ezberSrs.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback } from "@/lib/audio";
import { getSura } from "@/data/ezber";
import {
  contextCountFor, enqueueEzberRetry, getSuraProgress, markSeen,
  pickEzberQuestion, recordEzberAnswer, resetSura, suraMastered,
  type EzberQuestion,
} from "@/lib/ezberSrs";
import { cn } from "@/lib/utils";
import { Eye, Check, X, BookOpen, RotateCcw } from "lucide-react";

const AR_FONT = { fontFamily: '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif' };

const LEVEL_CHIP = [
  "bg-muted text-muted-foreground",
  "bg-destructive/70 text-white",
  "bg-warning/80 text-white",
  "bg-yellow-400/90 text-yellow-950",
  "bg-success text-white",
];

const EzberCalis = () => {
  const { suraId } = useParams<{ suraId: string }>();
  const sura = getSura(suraId ?? "");
  const navigate = useNavigate();

  const [q, setQ] = useState<EzberQuestion | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState<null | boolean>(null);
  const [session, setSession] = useState({ ok: 0, no: 0 });
  const [showFull, setShowFull] = useState(false);
  const [mastered, setMastered] = useState(false);
  const [, setTick] = useState(0); // parça haritası tazeleme
  const lastIndexRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = useCallback(() => {
    if (!sura) return;
    if (suraMastered(sura)) { setMastered(true); return; }
    const nq = pickEzberQuestion(sura, lastIndexRef.current);
    setQ(nq);
    if (nq) lastIndexRef.current = nq.index;
    setRevealed(false);
    setGraded(null);
  }, [sura]);

  useEffect(() => {
    next();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [next]);

  if (!sura) return <Navigate to="/ezber" replace />;

  const prog = getSuraProgress(sura.id);
  const lvlOf = (i: number) => prog[sura.segments[i].id]?.lvl ?? 0;

  const grade = (correct: boolean) => {
    if (!q || graded !== null) return;
    const seg = sura.segments[q.index];
    recordEzberAnswer(sura.id, seg.id, correct);
    if (!correct) enqueueEzberRetry(sura.id, q.index);
    playFeedback(correct);
    setGraded(correct);
    setSession((s) => correct ? { ...s, ok: s.ok + 1 } : { ...s, no: s.no + 1 });
    setTick((t) => t + 1);
    timerRef.current = setTimeout(next, 700);
  };

  const learned = () => {
    if (!q) return;
    markSeen(sura.id, sura.segments[q.index].id);
    playFeedback(true);
    setTick((t) => t + 1);
    next();
  };

  const restart = () => {
    resetSura(sura.id);
    setMastered(false);
    setSession({ ok: 0, no: 0 });
    lastIndexRef.current = null;
    setTick((t) => t + 1);
    next();
  };

  const target = q ? sura.segments[q.index] : null;
  const ctxCount = q?.kind === "quiz" ? contextCountFor(lvlOf(q.index)) : 2;
  const ctxStart = q ? Math.max(0, q.index - ctxCount) : 0;
  const ctxSegs = q ? sura.segments.slice(ctxStart, q.index) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-success/10 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title={`${sura.emoji} ${sura.title}`} backTo="/ezber" centered />

        {/* parça haritası — renk = seviye, halka = şu anki soru */}
        <div className="mb-3 flex flex-wrap gap-1.5 justify-center">
          {sura.segments.map((seg, i) => (
            <span
              key={seg.id}
              className={cn(
                "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[11px] font-extrabold transition-all",
                LEVEL_CHIP[Math.min(4, lvlOf(i))],
                q?.index === i && "ring-4 ring-primary/50 scale-110",
              )}
            >
              {i + 1}
            </span>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-center gap-3 text-xs font-extrabold">
          <span className="text-success">✅ {session.ok}</span>
          <span className="text-destructive">❌ {session.no}</span>
          <button
            onClick={() => setShowFull((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-card border-2 border-border px-3 py-1 shadow-soft active:scale-95"
          >
            <BookOpen className="h-3.5 w-3.5" /> {showFull ? "Çalışmaya Dön" : "Baştan Oku"}
          </button>
        </div>

        {showFull ? (
          /* BAŞTAN OKU: tüm sure, seviye renkleriyle — çocuk komple okur */
          <div className="rounded-2xl bg-card p-5 shadow-card border-2 border-success/30 space-y-3">
            {sura.segments.map((seg, i) => (
              <div key={seg.id} className="flex items-center gap-3">
                <span className={cn("h-6 w-6 shrink-0 rounded-full text-[10px] font-extrabold flex items-center justify-center", LEVEL_CHIP[Math.min(4, lvlOf(i))])}>
                  {i + 1}
                </span>
                <div className="flex-1 text-right" dir="rtl">
                  <div className="text-2xl leading-[1.9] text-foreground" style={AR_FONT}>{seg.ar}</div>
                  <div className="text-[11px] font-bold text-muted-foreground text-left" dir="ltr">{seg.tr}</div>
                </div>
              </div>
            ))}
          </div>
        ) : mastered ? (
          <div className="rounded-2xl bg-card p-8 shadow-card border-2 border-warning/50 text-center">
            <div className="text-5xl mb-2">🏆</div>
            <div className="text-xl font-extrabold text-success mb-1">Mâşâallah! Ezber tamam</div>
            <p className="text-xs font-bold text-muted-foreground mb-4">
              {sura.title} — tüm parçalar en üst seviyede. Ara ara "Baştan Oku" ile tazele!
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted border-2 border-border px-4 py-2.5 font-extrabold text-sm shadow-soft active:scale-95"
              >
                <RotateCcw className="h-4 w-4" /> Sıfırla
              </button>
              <button
                onClick={() => navigate("/ezber")}
                className="rounded-full bg-success text-success-foreground px-5 py-2.5 font-extrabold text-sm shadow-soft active:scale-95"
              >
                Diğer Sureler
              </button>
            </div>
          </div>
        ) : q && target ? (
          <div
            className={cn(
              "rounded-2xl bg-card p-5 shadow-card border-4 transition-colors",
              graded === true && "border-success",
              graded === false && "border-destructive",
              graded === null && "border-primary/30",
            )}
          >
            {/* ipucu: önceki parçalar (seviye arttıkça azalır) */}
            {ctxSegs.length > 0 && (
              <div className="mb-4 space-y-1 opacity-80">
                {ctxStart > 0 && <div className="text-center text-muted-foreground font-extrabold">⋯</div>}
                {ctxSegs.map((seg) => (
                  <div key={seg.id} className="text-right" dir="rtl">
                    <span className="text-xl leading-[1.8] text-muted-foreground" style={AR_FONT}>{seg.ar}</span>
                    <span className="block text-[10px] font-bold text-muted-foreground/70 text-left" dir="ltr">{seg.tr}</span>
                  </div>
                ))}
              </div>
            )}
            {q.kind === "quiz" && ctxSegs.length === 0 && (
              <div className="mb-3 text-center text-[11px] font-extrabold text-muted-foreground">
                {q.index + 1}. parça — ipucu yok, hepsi sende! 💪
              </div>
            )}

            {q.kind === "learn" ? (
              <>
                <div className="mb-1 text-center text-[11px] font-extrabold text-info">🆕 YENİ PARÇA — içinden 3 kez oku</div>
                <div className="text-center" dir="rtl">
                  <div className="text-4xl leading-[1.9] text-foreground" style={AR_FONT}>{target.ar}</div>
                </div>
                <div className="mt-1 text-center text-sm font-extrabold text-primary">{target.tr}</div>
                <button
                  onClick={learned}
                  className="mt-4 w-full rounded-2xl bg-info text-info-foreground py-3.5 font-extrabold shadow-soft active:scale-95"
                >
                  Okudum, devam ✓
                </button>
              </>
            ) : !revealed ? (
              <>
                <div className="mb-2 text-center text-[11px] font-extrabold text-muted-foreground">🤔 SIRADAKİ PARÇA NE? İçinden söyle...</div>
                <div className="flex items-center justify-center rounded-2xl bg-muted/50 border-2 border-dashed border-border py-8 text-5xl">
                  ❓
                </div>
                <button
                  onClick={() => setRevealed(true)}
                  className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-extrabold shadow-soft active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  <Eye className="h-5 w-5" /> Göster
                </button>
              </>
            ) : (
              <>
                <div className="text-center" dir="rtl">
                  <div className="text-4xl leading-[1.9] text-foreground" style={AR_FONT}>{target.ar}</div>
                </div>
                <div className="mt-1 text-center text-sm font-extrabold text-primary">{target.tr}</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => grade(false)}
                    className="rounded-2xl bg-destructive text-destructive-foreground py-3.5 font-extrabold shadow-soft active:scale-95 inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="h-5 w-5" /> Bilemedim
                  </button>
                  <button
                    onClick={() => grade(true)}
                    className="rounded-2xl bg-success text-success-foreground py-3.5 font-extrabold shadow-soft active:scale-95 inline-flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-5 w-5" /> Bildim
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground leading-relaxed">
          Dürüst işaretle — "Bilemedim" demek kaybettirmez, o parçayı daha sık
          getirir ve ezberini sağlamlaştırır. 🌱
        </p>
      </main>
    </div>
  );
};

export default EzberCalis;
