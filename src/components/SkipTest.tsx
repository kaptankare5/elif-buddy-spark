// HIZLI-GEÇİŞ SINAVI ("Test Out"). Konuyu zaten bilen çocuk yüzlerce bilinen
// harfte oyalanmasın diye: konudan 4 harf sorulur, 4/4 doğru → konu "atlandı"
// işaretlenir ve sonraki konu açılır (öğeler SAHTE ustalaştırılmaz — görülmemiş
// kalır; ara-kontrol sistemi sonradan gerçekten bilinip bilinmediğini yoklar).
// Tek yanlış → "birlikte öğrenelim" ve normal akışa dönülür.
//
// Sınav cevapları BİLEREK SRS'e işlenmez: bu bir yoklama, çalışma değil. 4
// şıktan rastgele 4/4 tutturma olasılığı ~%0.4 → şans geçişi düşük; kalanı
// ara-kontrolün deneme süresi yakalar.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentTopic } from "@/data/types";
import { playItem, playFeedback } from "@/lib/audio";
import { markTopicSkipped } from "@/lib/placement";
import { pickDistractors } from "@/lib/confusables";
import { cn } from "@/lib/utils";
import { Volume2, X } from "lucide-react";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const N_Q = 4;

export function SkipTest({ topic, onClose, onPass }: {
  topic: ContentTopic;
  onClose: () => void;
  onPass: () => void;
}) {
  // Gösterilebilir (Arapça glifi olan) öğelerden 4 rastgele soru. Son
  // bölümlere hafif ağırlık → "en zorlar" (nadir görülenler).
  const questions = useMemo(() => {
    const pool = topic.items.filter((it) => it.emoji);
    if (pool.length < 2) return [];
    const half = Math.floor(pool.length / 2);
    const later = pool.slice(half);
    const bias = shuffle(later).slice(0, 2); // sondan 2
    const rest = shuffle(pool.filter((it) => !bias.includes(it))).slice(0, N_Q - bias.length);
    const targets = shuffle([...bias, ...rest]).slice(0, Math.min(N_Q, pool.length));
    return targets.map((target) => {
      const wrongs = pickDistractors(pool, target, 3);
      return { target, options: shuffle([target, ...wrongs]) };
    });
  }, [topic.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  const q = questions[idx];

  useEffect(() => {
    if (q?.target) playItem(q.target);
  }, [q?.target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (questions.length === 0) { onClose(); return null; }

  const choose = async (optId: string) => {
    if (busyRef.current || picked || failed) return;
    busyRef.current = true;
    setPicked(optId);
    const correct = optId === q.target.id;
    await playFeedback(correct);
    if (!correct) {
      setFailed(true);
      setTimeout(() => { onClose(); }, 1400);
      return;
    }
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        markTopicSkipped(topic.id);
        onPass();
        return;
      }
      setIdx((i) => i + 1);
      setPicked(null);
      busyRef.current = false;
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-card border-4 border-primary/30 shadow-elegant p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-extrabold text-foreground">🚀 Bunu biliyor musun?</span>
          <button onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* İlerleme noktaları */}
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {questions.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 rounded-full transition-all",
                i < idx ? "w-2.5 bg-success" : i === idx ? "w-6 bg-primary" : "w-2.5 bg-muted",
              )}
            />
          ))}
        </div>

        {failed ? (
          <div className="py-8 text-center">
            <div className="text-5xl mb-2">💛</div>
            <p className="font-extrabold text-foreground">Hadi birlikte öğrenelim!</p>
            <p className="text-sm text-muted-foreground mt-1">Bu konuyu adım adım çalışalım.</p>
          </div>
        ) : (
          <>
            <div className="relative bg-muted/40 rounded-2xl p-5 mb-4 text-center">
              <button
                onClick={() => playItem(q.target)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-4 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105"
                aria-label="Tekrar dinle"
              >
                <Volume2 className="h-7 w-7" />
                <span>Hangisi?</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt) => {
                const isCorrect = !!picked && opt.id === q.target.id;
                const isWrong = picked === opt.id && opt.id !== q.target.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => choose(opt.id)}
                    disabled={!!picked}
                    className={cn(
                      "aspect-square rounded-2xl flex items-center justify-center shadow-card border-4 transition-bouncy bg-card border-primary/20 hover:-translate-y-1 disabled:hover:translate-y-0",
                      isCorrect && "bg-success border-success animate-pop",
                      isWrong && "bg-destructive border-destructive animate-shake",
                    )}
                  >
                    <span className={cn(
                      "font-arabic text-5xl leading-[1.5]",
                      (isCorrect || isWrong) ? "text-white" : "text-emerald-800",
                    )}>
                      {opt.emoji}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
