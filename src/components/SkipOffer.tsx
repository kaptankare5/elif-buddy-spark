// 🚀 KONU ATLAMA TEKLİFİ — "bunu zaten biliyorsun galiba, geçelim mi?"
//
// İleri yoklama (forwardProbe.ts) yeterli kanıt topladığında burası açılır.
//
// ⚠️ SİSTEM KARAR VERİP DAYATMAZ, TEKLİF EDER. Öz-belirleme kuramı (SDT):
// seçim hissi içsel motivasyonu artırır, kontrolü tamamen elden almak
// düşürür. Ama karar YÜKÜ de çocuğa bırakılmaz — eski "Bunu zaten
// biliyorum" düğmesinin asıl kusuru buydu: 5 yaşındaki bir çocuk "bunu
// biliyor muyum?" sorusuna cevap veremez, o üstbiliş o yaşta gelişmemiştir.
// Burada sistem zaten ÖLÇMÜŞTÜR; çocuğa düşen sadece sevinip onaylamak.
//
// "Biraz daha çalışayım" dendiğinde o konu için bir daha teklif edilmez —
// ısrar etmek teklifi baskıya çevirir.
import { useCallback, useEffect, useState } from "react";
import { Rocket, BookOpen } from "lucide-react";
import { PROBE_OFFER_EVENT, acceptSkip, declineSkip, topicSkillCount } from "@/lib/forwardProbe";
import { markTopicSkipped } from "@/lib/placement";
import { getTopic } from "@/data/subjects";
import { playFeedback } from "@/lib/audio";

export function SkipOffer() {
  const [topicId, setTopicId] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<{ topicId: string }>).detail?.topicId;
      if (id) { setTopicId(id); void playFeedback(true); }
    };
    window.addEventListener(PROBE_OFFER_EVENT, h);
    return () => window.removeEventListener(PROBE_OFFER_EVENT, h);
  }, []);

  const kapat = useCallback(() => setTopicId(null), []);

  const evet = useCallback(() => {
    if (!topicId) return;
    acceptSkip(topicId);
    // Konu "atlandı" işaretlenir: sonraki konu açılır AMA öğeler görülmemiş
    // kalır (placement.ts) — cevaplanmamış harfler asla L4 gibi görünmez.
    // Geriye yoklama radarı sonradan gerçekten bilip bilmediğini yoklar.
    markTopicSkipped(topicId);
    setTopicId(null);
  }, [topicId]);

  const hayir = useCallback(() => {
    if (!topicId) return;
    declineSkip(topicId);
    setTopicId(null);
  }, [topicId]);

  useEffect(() => {
    if (!topicId) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") hayir(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [topicId, hayir]);

  if (!topicId) return null;
  const topic = getTopic("elifba", topicId);
  if (!topic) { kapat(); return null; }
  const beceri = topicSkillCount(topicId);

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border-4 border-success/40 bg-card p-5 text-center shadow-2xl">
        <div className="text-5xl" aria-hidden>🚀</div>
        <h2 className="mt-2 text-lg font-extrabold leading-tight text-foreground">
          Bunu zaten biliyorsun galiba!
        </h2>
        <p className="mt-1 text-sm font-bold leading-snug text-muted-foreground">
          Arada <b>{topic.title.replace(/^\d+\.\s*/, "")}</b> konusundan da sorular
          sordum ve hepsini bildin.
        </p>

        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-success/10 px-3 py-2">
          <span className="font-arabic text-2xl leading-[1.7] text-emerald-900" dir="rtl">{topic.emoji}</span>
          <span className="text-xs font-extrabold text-success">
            {beceri} beceri · şimdiden biliyorsun
          </span>
        </div>

        <p className="mt-3 text-sm font-extrabold text-foreground">
          Sonraki konuya geçelim mi?
        </p>

        <div className="mt-3 grid gap-2">
          <button
            onClick={evet}
            className="flex items-center justify-center gap-2 rounded-2xl bg-success px-4 py-3.5 text-base font-extrabold text-white shadow-soft transition-bouncy active:scale-95"
          >
            <Rocket className="h-5 w-5" /> Hadi geçelim!
          </button>
          <button
            onClick={hayir}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-muted/50 px-4 py-3 text-sm font-extrabold text-muted-foreground transition-bouncy active:scale-95"
          >
            <BookOpen className="h-4 w-4" /> Biraz daha çalışayım
          </button>
        </div>

        <p className="mt-2 text-[10px] font-semibold leading-snug text-muted-foreground">
          Geçsen de arada bu konudan sorular sormaya devam edeceğim.
        </p>
      </div>
    </div>
  );
}
