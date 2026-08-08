import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteHead } from "@/components/RouteHead";
import { playFeedback } from "@/lib/audio";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ARM_REPS,
  WORDS,
  buildReport,
  clearState,
  createState,
  emojiOf,
  loadState,
  optionsFor,
  repsDone,
  saveState,
  prepareVoices,
  speakEs,
  speakTwice,
  totalReps,
  wordsOfArm,
  type DeneyState,
  type TestPhase,
} from "@/lib/deney";

const BIG = "text-[72px] leading-[1.1]";
const TAP = "min-h-[56px]";

const Deney = () => {
  const [st, setSt] = useState<DeneyState | null>(() => loadState());
  const [hasVoice, setHasVoice] = useState<boolean | null>(null);
  const [voiceProg, setVoiceProg] = useState({ done: 0, total: WORDS.length });
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [feedback, setFeedback] = useState<null | { ok: boolean; correct: string }>(null);
  const [heard, setHeard] = useState(false);
  const [marked, setMarked] = useState<number | null>(null);
  const startRef = useRef(performance.now());

  // Yapay zekâ sesleri arka planda hazırlanır (bir kez üretilir, sonra saklanır).
  useEffect(() => {
    let alive = true;
    void prepareVoices((done, total) => { if (alive) setVoiceProg({ done, total }); }).then((ok) => {
      if (alive) setHasVoice(ok > 0);
    });
    return () => { alive = false; };
  }, []);

  const update = (fn: (s: DeneyState) => DeneyState) => {
    setSt((prev) => {
      if (!prev) return prev;
      const next = fn(structuredClone(prev));
      saveState(next);
      return next;
    });
  };

  const step = st && st.phase === "train" ? st.steps[st.idx] : null;
  const phase = st?.phase;

  // Adım/soru değişince zamanlayıcı ve yerel durum sıfırlanır
  useEffect(() => {
    startRef.current = performance.now();
    setFeedback(null);
    setHeard(false);
    setMarked(null);
  }, [st?.idx, st?.testIdx, phase]);

  // Otomatik ses
  useEffect(() => {
    if (!st || hasVoice === false) return;
    if (st.phase === "train") {
      const s = st.steps[st.idx];
      if (!s) return;
      if (s.kind === "teach") speakTwice(s.es);
      else if (s.arm !== "B") speakEs(s.es);
    } else if (st.phase === "imm-rec" || st.phase === "del-rec") {
      const order = st.phase === "imm-rec" ? st.immRecOrder : st.delRecOrder;
      const w = order[st.testIdx];
      if (w) speakEs(w);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.idx, st?.testIdx, st?.phase, hasVoice]);

  const advanceTrain = () => {
    update((s) => {
      const idx = s.idx + 1;
      if (idx >= s.steps.length) {
        return {
          ...s,
          idx,
          trainEndedAt: Date.now(),
          phase: "imm-prod",
          testIdx: 0,
          immediate: { startedAt: Date.now(), endedAt: null, prod: {}, rec: {} },
        };
      }
      return { ...s, idx };
    });
  };

  const recordRep = (es: string, score: number) => {
    const ms = Math.round(performance.now() - startRef.current);
    update((s) => {
      s.train[es] = [...(s.train[es] ?? []), { score, ms, at: Date.now() }];
      return s;
    });
    playFeedback(score >= 1);
    setFeedback({ ok: score >= 1, correct: es });
    setTimeout(advanceTrain, score >= 1 ? 700 : 1500);
  };

  /* ── Testler ── */
  const testPhase: TestPhase | null =
    st && (phase === "imm-prod" || phase === "imm-rec")
      ? st.immediate
      : st && (phase === "del-prod" || phase === "del-rec")
        ? st.delayed
        : null;

  const isDelayed = phase === "del-prod" || phase === "del-rec";

  const advanceTest = (kind: "prod" | "rec") => {
    update((s) => {
      const order =
        kind === "prod"
          ? isDelayed ? s.delProdOrder : s.immProdOrder
          : isDelayed ? s.delRecOrder : s.immRecOrder;
      const next = s.testIdx + 1;
      if (next < order.length) return { ...s, testIdx: next };
      if (kind === "prod") return { ...s, testIdx: 0, phase: isDelayed ? "del-rec" : "imm-rec" };
      const done = Date.now();
      if (isDelayed && s.delayed) s.delayed.endedAt = done;
      else if (s.immediate) s.immediate.endedAt = done;
      return { ...s, testIdx: 0, phase: isDelayed ? "del-done" : "imm-done" };
    });
  };

  const recordTest = (kind: "prod" | "rec", es: string, score: number) => {
    const ms = Math.round(performance.now() - startRef.current);
    update((s) => {
      const t = isDelayed ? s.delayed : s.immediate;
      if (t) t[kind][es] = { score, ms };
      return s;
    });
  };

  const startDelayed = () => {
    update((s) => {
      const base = s.immediate?.endedAt ?? s.trainEndedAt ?? s.startedAt;
      return {
        ...s,
        phase: "del-prod",
        testIdx: 0,
        delayed: {
          startedAt: Date.now(),
          endedAt: null,
          prod: {},
          rec: {},
          hours: Math.round((Date.now() - base) / 3600000),
        },
      };
    });
  };

  const copyReport = async () => {
    if (!st) return;
    try {
      await navigator.clipboard.writeText(buildReport(st));
      toast.success("Rapor panoya kopyalandı.");
    } catch {
      toast.error("Kopyalanamadı — metni elle seçebilirsin.");
    }
  };

  const reset = () => {
    if (!window.confirm("Deney sıfırlansın mı? Tüm ölçüm verisi silinir.")) return;
    clearState();
    setSt(null);
  };

  /* ── Şıklar ── */
  const recTarget =
    st && (phase === "imm-rec" || phase === "del-rec")
      ? (phase === "imm-rec" ? st.immRecOrder : st.delRecOrder)[st.testIdx]
      : null;
  const prodTarget =
    st && (phase === "imm-prod" || phase === "del-prod")
      ? (phase === "imm-prod" ? st.immProdOrder : st.delProdOrder)[st.testIdx]
      : null;

  const trainOptions = useMemo(() => {
    if (!st || !step || step.kind !== "rep" || step.arm === "B") return [];
    return optionsFor(step.es, wordsOfArm(st, step.arm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.idx]);

  const testOptions = useMemo(() => {
    if (!recTarget) return [];
    return optionsFor(recTarget, WORDS.map((w) => w.es));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recTarget]);

  /* ── Render ── */
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      <RouteHead
        title="Aktarım Deneyi — araştırma modülü"
        description="Tanıma ve üretim pratiğinin aktarımını ölçen araştırma modülü."
        path="/deney"
        noindex
      />
      <main className="container mx-auto max-w-xl px-4 pb-20">
        <PageHeader title="🧪 Aktarım Deneyi" backTo="/ayarlar" centered />
        {children}
      </main>
    </div>
  );

  if (hasVoice === false) {
    return shell(
      <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-5">
        <h2 className="text-lg font-extrabold text-destructive mb-2">
          İspanyolca ses hazırlanamadı
        </h2>
        <p className="text-sm font-semibold text-foreground">
          Deney sesle çalışıyor. Kelime seslendirmeleri sunucudan alınamadı; internet
          bağlantısını kontrol edip sayfayı yenile.
        </p>
      </div>,
    );
  }

  // GİRİŞ
  if (!st) {
    return shell(
      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Bu bir araştırma aracıdır; uygulamadaki öğrenme ilerlemesine hiç dokunmaz.
          </p>
          <p className="text-sm text-muted-foreground">
            18 İspanyolca kelime rastgele üç kola bölünür: <b>tanıma</b> (5 tekrar),
            <b> üretim</b> (5 tekrar) ve <b>yoğun tanıma</b> (15 tekrar).
          </p>
          <p className="text-sm text-muted-foreground">
            Eğitim bitince herkese aynı iki test yapılır (önce söyleme, sonra sesten
            seçme); böylece bir formatın diğerine ne kadar aktarıldığı ölçülür.
          </p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Katılımcı adı / rumuzu"
          className={cn("w-full rounded-xl border-2 border-border bg-background px-3 text-base", TAP)}
        />
        <input
          value={age}
          onChange={(e) => setAge(e.target.value)}
          inputMode="numeric"
          placeholder="Yaş"
          className={cn("w-full rounded-xl border-2 border-border bg-background px-3 text-base", TAP)}
        />
        <button
          disabled={!name.trim() || !age.trim() || hasVoice !== true}
          onClick={() => {
            const s = createState(name.trim(), age.trim());
            saveState(s);
            setSt(s);
          }}
          className={cn(
            "w-full rounded-2xl bg-primary text-primary-foreground font-extrabold text-base disabled:opacity-50",
            TAP,
          )}
        >
          Başlat
        </button>
      </div>,
    );
  }

  // EĞİTİM
  if (phase === "train" && step) {
    return shell(
      <div className="space-y-4">
        <div className="text-center text-sm font-extrabold text-muted-foreground">
          {repsDone(st)} / {totalReps()}
        </div>

        {step.kind === "teach" ? (
          <div className="rounded-2xl bg-card p-6 shadow-card border-2 border-border/40 text-center space-y-4">
            <div className="text-xs font-extrabold text-muted-foreground">Yeni kelime — dinle</div>
            <div className={BIG}>{emojiOf(step.es)}</div>
            <button
              onClick={() => speakTwice(step.es)}
              className={cn("w-full rounded-xl bg-muted/50 border-2 border-border font-extrabold", TAP)}
            >
              🔊 Tekrar dinle
            </button>
            <button
              onClick={advanceTrain}
              className={cn("w-full rounded-2xl bg-primary text-primary-foreground font-extrabold", TAP)}
            >
              Devam
            </button>
          </div>
        ) : step.arm === "B" ? (
          <div className="rounded-2xl bg-card p-6 shadow-card border-2 border-border/40 text-center space-y-4">
            <div className="text-xs font-extrabold text-muted-foreground">
              Resme bak, kelimeyi sesli söyle
            </div>
            <div className={BIG}>{emojiOf(step.es)}</div>
            <button
              onClick={() => { speakEs(step.es); setHeard(true); }}
              className={cn("w-full rounded-xl bg-muted/50 border-2 border-border font-extrabold", TAP)}
            >
              🔊 Cevabı duy
            </button>
            <div className="grid grid-cols-3 gap-2">
              {([["Bildi", 1], ["Kısmen", 0.5], ["Bilmedi", 0]] as const).map(([label, sc]) => (
                <button
                  key={label}
                  disabled={!heard || !!feedback}
                  onClick={() => recordRep(step.es, sc)}
                  className={cn(
                    "rounded-xl border-2 border-border bg-muted/40 font-extrabold text-sm disabled:opacity-40",
                    TAP,
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-6 shadow-card border-2 border-border/40 text-center space-y-4">
            <div className="text-xs font-extrabold text-muted-foreground">Dinle, doğru resmi seç</div>
            <button
              onClick={() => speakEs(step.es)}
              className={cn("w-full rounded-xl bg-muted/50 border-2 border-border font-extrabold", TAP)}
            >
              🔊 Tekrar dinle
            </button>
            <div className="grid grid-cols-2 gap-3">
              {trainOptions.map((opt) => (
                <button
                  key={opt}
                  disabled={!!feedback}
                  onClick={() => recordRep(step.es, opt === step.es ? 1 : 0)}
                  className={cn(
                    "rounded-2xl border-2 py-4 text-[64px] leading-none",
                    feedback && opt === step.es
                      ? "border-success bg-success/15"
                      : "border-border bg-muted/30",
                  )}
                >
                  {emojiOf(opt)}
                </button>
              ))}
            </div>
            {feedback && (
              <div
                className={cn(
                  "text-sm font-extrabold",
                  feedback.ok ? "text-success" : "text-destructive",
                )}
              >
                {feedback.ok ? "✓ Doğru" : `✗ Doğrusu: ${emojiOf(feedback.correct)}`}
              </div>
            )}
          </div>
        )}

        <button onClick={reset} className="w-full text-xs font-extrabold text-destructive underline">
          Deneyi sıfırla
        </button>
      </div>,
    );
  }

  // ÜRETİM TESTİ
  if (prodTarget && testPhase) {
    const order = isDelayed ? st.delProdOrder : st.immProdOrder;
    return shell(
      <div className="space-y-4">
        <div className="text-center text-sm font-extrabold text-muted-foreground">
          {isDelayed ? "Gecikmeli " : ""}Üretim testi · {st.testIdx + 1} / {order.length}
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-card border-2 border-border/40 text-center space-y-4">
          <div className="text-xs font-extrabold text-muted-foreground">
            Resme bak, kelimeyi sesli söyle
          </div>
          <div className={BIG}>{emojiOf(prodTarget)}</div>
          <div className="grid grid-cols-3 gap-2">
            {([["Bildi", 1], ["Kısmen", 0.5], ["Bilmedi", 0]] as const).map(([label, sc]) => (
              <button
                key={label}
                onClick={() => {
                  recordTest("prod", prodTarget, sc);
                  setMarked(sc);
                  speakEs(prodTarget);
                }}
                className={cn(
                  "rounded-xl border-2 font-extrabold text-sm",
                  marked === sc ? "border-primary bg-primary/15" : "border-border bg-muted/40",
                  TAP,
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {marked !== null && (
            <>
              <button
                onClick={() => speakEs(prodTarget)}
                className={cn("w-full rounded-xl bg-muted/50 border-2 border-border font-extrabold", TAP)}
              >
                🔊 Doğru telaffuzu tekrar duy
              </button>
              <p className="text-[11px] font-semibold text-muted-foreground">
                Gerekirse işareti değiştirebilirsin.
              </p>
              <button
                onClick={() => advanceTest("prod")}
                className={cn("w-full rounded-2xl bg-primary text-primary-foreground font-extrabold", TAP)}
              >
                Sonraki
              </button>
            </>
          )}
        </div>
      </div>,
    );
  }

  // TANIMA TESTİ
  if (recTarget && testPhase) {
    const order = isDelayed ? st.delRecOrder : st.immRecOrder;
    return shell(
      <div className="space-y-4">
        <div className="text-center text-sm font-extrabold text-muted-foreground">
          {isDelayed ? "Gecikmeli " : ""}Tanıma testi · {st.testIdx + 1} / {order.length}
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-card border-2 border-border/40 text-center space-y-4">
          <button
            onClick={() => speakEs(recTarget)}
            className={cn("w-full rounded-xl bg-muted/50 border-2 border-border font-extrabold", TAP)}
          >
            🔊 Tekrar dinle
          </button>
          <div className="grid grid-cols-2 gap-3">
            {testOptions.map((opt) => (
              <button
                key={opt}
                disabled={!!feedback}
                onClick={() => {
                  const ok = opt === recTarget;
                  recordTest("rec", recTarget, ok ? 1 : 0);
                  playFeedback(ok);
                  setFeedback({ ok, correct: recTarget });
                  setTimeout(() => advanceTest("rec"), ok ? 600 : 1300);
                }}
                className={cn(
                  "rounded-2xl border-2 py-4 text-[64px] leading-none",
                  feedback && opt === recTarget
                    ? "border-success bg-success/15"
                    : "border-border bg-muted/30",
                )}
              >
                {emojiOf(opt)}
              </button>
            ))}
          </div>
          {feedback && (
            <div className={cn("text-sm font-extrabold", feedback.ok ? "text-success" : "text-destructive")}>
              {feedback.ok ? "✓ Doğru" : `✗ Doğrusu: ${emojiOf(feedback.correct)}`}
            </div>
          )}
        </div>
      </div>,
    );
  }

  // RAPOR
  const report = buildReport(st);
  return shell(
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40 overflow-x-auto">
        <pre className="text-[11px] leading-relaxed font-mono whitespace-pre text-foreground">
          {report}
        </pre>
      </div>
      <button
        onClick={copyReport}
        className={cn("w-full rounded-2xl bg-primary text-primary-foreground font-extrabold", TAP)}
      >
        📋 Raporu kopyala
      </button>
      {phase === "imm-done" && (
        <button
          onClick={startDelayed}
          className={cn("w-full rounded-2xl bg-warning text-warning-foreground font-extrabold", TAP)}
        >
          ⏳ Gecikmeli testi başlat
        </button>
      )}
      <button onClick={reset} className="w-full text-xs font-extrabold text-destructive underline">
        Deneyi sıfırla
      </button>
      <p className="text-[11px] text-muted-foreground text-center">
        Kol dağılımı: A {wordsOfArm(st, "A").length} kelime ({ARM_REPS.A} tekrar) · B{" "}
        {wordsOfArm(st, "B").length} ({ARM_REPS.B}) · C {wordsOfArm(st, "C").length} ({ARM_REPS.C})
      </p>
    </div>,
  );
};

export default Deney;
