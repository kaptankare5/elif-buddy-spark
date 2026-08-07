// DENETİM KARTI (bkz. lib/audit.ts) — 20 soruda bir çıkar.
//
// Normal testin AYNASI: orada sesi duyup şekli seçiyoruz, burada şekli görüp
// SESİ seçiyoruz. Elifbâ kitabının sorduğu yön budur.
//
// ⚠️ ŞIKLAR TEKRAR DİNLENEBİLİR olmak zorunda. Ses geçici, şekil kalıcıdır:
// dört harf ekranda dururken çocuk gözüyle gidip gelebiliyor, sesler öyle
// değil — sırayla dinleyip akılda tutmak 6 yaşındaki çocukta harfi bilmekle
// İLGİSİ OLMAYAN bir çalışma belleği yükü ekler ve ölçümü kirletir. Serbest
// tekrar dinleme bu yükü kaldırır; bedeli yalnız SÜREdir, o da 20 soruda bir
// olduğu için önemsizdir. (Bu format ana test olsaydı süre öldürücü olurdu.)
import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, ShieldCheck } from "lucide-react";
import { playItem, playFeedback } from "@/lib/audio";
import type { AuditQuestion } from "@/lib/auditQuestion";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/data/types";

export function AuditCard({ question, onDone }: {
  question: AuditQuestion;
  onDone: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [calan, setCalan] = useState<string | null>(null);
  const busy = useRef(false);
  const { target, options } = question;

  // Soru SESLE sorulmuyor (şekil soruluyor) — açılışta hiçbir ses çalmaz,
  // yoksa cevabı vermiş oluruz.
  useEffect(() => { setPicked(null); busy.current = false; }, [target.id]);

  const dinle = async (it: ContentItem) => {
    setCalan(it.id);
    await playItem(it);
    setCalan(null);
  };

  const sec = async (it: ContentItem) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(it.id);
    const dogru = it.audio === target.audio;
    await playFeedback(dogru);
    setTimeout(() => onDone(dogru), 700);
  };

  // ⚠️ ARAPÇA GLİF `emoji` ALANINDADIR, `label` TÜRKÇE ADDIR ("Şin").
  // İlk sürümde label basılıyordu: çocuk ekranda Latin harflerle "Şin"
  // görüyordu — soru ya okuma bilene bedava, bilmeyene anlamsız oluyordu,
  // yani denetim hiçbir şey ölçmüyordu. Tarayıcı denemesinde yakalandı.
  const glif = target.emoji || target.label;
  const harfBoyu = useMemo(
    () => ((glif?.length ?? 1) > 3 ? "text-5xl" : "text-7xl"),
    [glif],
  );

  return (
    <div className="rounded-3xl border-2 border-gold/50 bg-gold/5 p-4 shadow-card">
      <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-gold-foreground">
        <ShieldCheck className="h-4 w-4" /> KONTROL SORUSU
      </div>
      <p className="mb-3 text-center text-sm font-bold text-foreground">
        Bu harfin sesi hangisi?
      </p>
      <div className="mb-4 flex justify-center">
        <div className={cn(
          "rounded-2xl bg-card px-8 py-4 font-arabic text-emerald-800 shadow-soft leading-[1.6]",
          harfBoyu,
        )} dir="rtl">
          {glif}
        </div>
      </div>
      <div className="grid gap-2">
        {options.map((o, i) => {
          const secildi = picked === o.id;
          const dogruSik = o.audio === target.audio;
          return (
            <div key={o.id} className="flex items-center gap-2">
              <button
                onClick={() => dinle(o)}
                disabled={picked !== null}
                aria-label={`${i + 1}. sesi dinle`}
                className={cn(
                  "flex h-14 min-w-14 items-center justify-center gap-1 rounded-2xl border-2 border-primary/30 bg-card px-3 font-extrabold text-primary shadow-soft transition-bouncy",
                  calan === o.id && "scale-105 border-primary bg-primary/10",
                )}
              >
                <Volume2 className="h-6 w-6" /> {i + 1}
              </button>
              <button
                onClick={() => sec(o)}
                disabled={picked !== null}
                className={cn(
                  "h-14 flex-1 rounded-2xl border-2 text-sm font-extrabold shadow-soft transition-bouncy",
                  picked === null && "border-border bg-card hover:-translate-y-0.5",
                  secildi && dogruSik && "border-success bg-success/15 text-success",
                  secildi && !dogruSik && "border-destructive bg-destructive/15 text-destructive",
                  picked !== null && !secildi && "border-border/40 bg-card/60 text-muted-foreground",
                )}
              >
                {secildi ? (dogruSik ? "✓ Doğru" : "✗") : "Bu"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] font-semibold text-muted-foreground">
        🔊 düğmesine istediğin kadar basıp tekrar dinleyebilirsin
      </p>
    </div>
  );
}
