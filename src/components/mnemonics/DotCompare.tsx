// 🔵 NOKTA YÖNTEMİ — "aynı iskelet, farklı nokta".
//
// Karışıklığın gerçek kaynağı: ب/ت/ث/ن/ي başta ve ortada TIPATIP aynı çizilir.
// Bu bileşen harfleri YAN YANA koyar (discriminative-contrast: farkı görmenin
// tek yolu, karışanları aynı anda görmektir — Kornell & Bjork) ve tek fark olan
// noktayı şematik rozetle vurgular: kaç nokta, üstte mi altta mı.
//
// Nokta rozetleri font glifinin üstüne konumlandırılmaz (fonta göre kayar);
// bunun yerine harfin ALTINDA şematik bir "nokta diyagramı" çizilir —
// her fontta doğru, çocuk için okunaklı.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { dotLabel, type DotGroup, type MnemonicLetter } from "@/data/writingMnemonics";
import { playItem } from "@/lib/audio";
import { findItem } from "@/data/subjects";
import { writingItemIds } from "@/data/writingMnemonics";

type Form = "init" | "med" | "fin";
const FORM_LABEL: Record<Form, string> = { init: "Başta", med: "Ortada", fin: "Sonda" };

// Şematik nokta diyagramı: çizginin üstünde/altında noktalar.
function DotDiagram({ dots, where }: { dots: number; where: MnemonicLetter["where"] }) {
  const pips = Array.from({ length: dots });
  return (
    <span className="flex h-7 w-12 flex-col items-center justify-center gap-0.5" aria-hidden>
      <span className="flex h-2 items-center gap-0.5">
        {where === "ust" && pips.map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-warning animate-dot-pulse"
                style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="h-[2px] w-9 rounded-full bg-muted-foreground/40" />
      <span className="flex h-2 items-center gap-0.5">
        {where === "alt" && pips.map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-warning animate-dot-pulse"
                style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </span>
  );
}

export function DotCompare({ group }: { group: DotGroup }) {
  const [form, setForm] = useState<Form>("init");

  return (
    <div className="rounded-2xl border-2 border-warning/40 bg-card p-3 shadow-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-foreground">{group.title}</h3>
        {/* Hâl seçici — aynı grubu 3 hâlde de karşılaştır */}
        <div className="flex gap-1" role="group" aria-label="Harf hâli seç">
          {(["init", "med", "fin"] as Form[]).map((f) => (
            <button
              key={f}
              onClick={() => setForm(f)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors",
                form === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {FORM_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-[11px] font-bold leading-snug text-muted-foreground">{group.hint}</p>

      {/* Karşılaştırma şeridi — Arapça sağdan sola */}
      <div dir="rtl" className="flex flex-wrap justify-center gap-2">
        {group.letters.map((l) => {
          const ids = writingItemIds(l.n);
          const item = findItem(ids[form]);
          return (
            <button
              key={l.n}
              onClick={() => item && playItem(item)}
              aria-label={`${l.name} — ${dotLabel(l.dots, l.where)}`}
              className="flex min-w-[68px] flex-col items-center gap-0.5 rounded-xl border-2 border-primary/15 bg-emerald-50/50 px-2 py-2 transition-bouncy hover:-translate-y-0.5 hover:border-primary/40 active:scale-95"
            >
              <span className="font-arabic text-4xl leading-[1.6] text-emerald-900">
                {l[form]}
              </span>
              <DotDiagram dots={l.dots} where={l.where} />
              <span className="text-[11px] font-extrabold text-foreground" dir="ltr">{l.name}</span>
              <span className="text-[9px] font-bold text-warning" dir="ltr">
                {dotLabel(l.dots, l.where)}
              </span>
            </button>
          );
        })}
      </div>

      {/* "Aynı iskelet" vurgusu */}
      <div className="mt-2 flex items-center gap-2">
        <span className="h-1 flex-1 origin-right rounded-full bg-gradient-to-l from-warning to-warning/20 animate-skeleton-underline" />
        <span className="shrink-0 text-[10px] font-extrabold text-warning">
          hepsinin iskeleti aynı: {group.skeleton}
        </span>
      </div>

      {group.caveat && (
        <p className="mt-2 rounded-lg bg-muted/60 px-2 py-1.5 text-[10px] font-semibold leading-snug text-muted-foreground">
          ℹ️ {group.caveat}
        </p>
      )}
      <p className="mt-1.5 text-center text-[10px] font-bold text-muted-foreground">
        🔊 Bir harfe dokun — sesini dinle
      </p>
    </div>
  );
}
