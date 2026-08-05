// ÇİZGİ KARŞILAŞTIRMASI — Elif ile Lem gibi NOKTASIZ, aynı dikey çizgiyi
// paylaşan ikililer için. Nokta yöntemi burada işe yaramaz (ikisinin de
// noktası yok); ayırt edici olan tek şey ÇİZGİNİN SOLA DEVAM EDİP ETMEMESİ.
//
// Yalnız BAŞTA ve ORTADA hâlleri gösterilir: Lem'in sonda/yalın hâlinde derin
// çanak olduğu için orada karışma yok (kullanıcı kararı; confusables.ts'teki
// form kısıtıyla aynı kural). Karışmayan hâli göstermek çocuğa fazladan yük.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { playItem } from "@/lib/audio";
import { findItem } from "@/data/subjects";
import { writingItemIds, type StrokePair } from "@/data/writingMnemonics";

type Form = "init" | "med";
const FORM_LABEL: Record<Form, string> = { init: "Başta", med: "Ortada" };

export function StrokeCompare({ pair, initialForm = "init" }: { pair: StrokePair; initialForm?: Form }) {
  const [form, setForm] = useState<Form>(pair.forms.includes(initialForm) ? initialForm : pair.forms[0]);

  return (
    <div className="rounded-2xl border-2 border-info/40 bg-card p-3 shadow-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-foreground">{pair.title}</h3>
        <div className="flex gap-1" role="group" aria-label="Harf hâli seç">
          {pair.forms.map((f) => (
            <button
              key={f}
              onClick={() => setForm(f)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors",
                form === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {FORM_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Kural — çocuğun aklında kalacak TEK cümle */}
      <p className="mb-2 rounded-lg bg-info/10 px-2 py-1.5 text-[11px] font-extrabold leading-snug text-info">
        {pair.rule}
      </p>
      <p className="mb-2 text-[11px] font-bold leading-snug text-muted-foreground">{pair.hint}</p>

      <div dir="rtl" className="flex flex-wrap justify-center gap-2">
        {pair.letters.map((l) => {
          const ids = writingItemIds(l.n);
          const item = findItem(ids[form]);
          // Elif sola bağlanmaz → çizgi biter. Lem bağlanır → devam eder.
          const devam = l.n !== 1;
          return (
            <button
              key={l.n}
              onClick={() => item && playItem(item)}
              aria-label={`${l.name} — ${devam ? "çizgi devam eder" : "çizgi biter"}`}
              className="flex min-w-[92px] flex-col items-center gap-0.5 rounded-xl border-2 border-info/20 bg-sky-50/60 px-2 py-2 transition-bouncy hover:-translate-y-0.5 hover:border-info/50 active:scale-95"
            >
              <span className="font-arabic text-4xl leading-[1.6] text-emerald-900">{l[form]}</span>
              {/* Şematik: çizgi ve solundaki devam — fontun üstüne çizilmez,
                  ALTINDA gösterilir (font sürümüne göre kayma olmasın). */}
              <span className="mt-0.5 flex items-center gap-0.5" dir="ltr" aria-hidden>
                <span className={cn("h-0.5 w-5 rounded-full", devam ? "bg-info" : "bg-transparent")} />
                <span className="h-4 w-0.5 rounded-full bg-warning" />
                <span className="h-0.5 w-1.5 rounded-full bg-warning/40" />
              </span>
              <span className="text-[11px] font-extrabold text-foreground" dir="ltr">{l.name}</span>
              <span className={cn("text-[9px] font-bold", devam ? "text-info" : "text-warning")} dir="ltr">
                {devam ? "çizgi devam eder" : "çizgi biter"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 rounded-lg bg-muted/60 px-2 py-1.5 text-[10px] font-semibold leading-snug text-muted-foreground">
        ℹ️ Lem'in <b>sonda</b> (ﻞ) ve <b>yalın</b> (ل) hâlinde derin bir çanak var —
        orada Elif'le karışmaz, o yüzden burada gösterilmiyor.
      </p>

      {pair.quran && (
        <div className="mt-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-2 text-center">
          <div className="font-arabic text-2xl leading-[1.7] text-emerald-900" dir="rtl">{pair.quran.ar}</div>
          <div className="text-[11px] font-extrabold text-primary">{pair.quran.okunus}</div>
          <div className="text-[9px] font-bold text-muted-foreground">{pair.quran.kaynak} · {pair.quran.not}</div>
        </div>
      )}

      <p className="mt-1.5 text-center text-[10px] font-bold text-muted-foreground">
        🔊 Bir harfe dokun — sesini dinle
      </p>
    </div>
  );
}
