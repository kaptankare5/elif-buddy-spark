// ✂️ KUYRUK SİLME animasyonu — "yalın hâlin kuyruğunu silersen başta hâli çıkar".
//
// Döngü (4sn, CSS'te tanımlı): yalın hâl → kuyruk bölgesi kırmızı kesikli
// çerçeveyle işaretlenir → silgi süpürür, yalın solar / başta belirir → durur.
// Üç katman aynı süreyi paylaşır (index.css) → senkron kalır.
//
// Neden font glifi üzerinde "maskeleme" yapmıyoruz: kuyruğun tam geometrisi
// fonta göre değişir; yanlış yerden kesmek kafa karıştırır. Bunun yerine
// bölgeyi İŞARETLEYİP çapraz geçiş yapıyoruz — çocuk "şurası silindi, bu
// kaldı" bağını kuruyor, üstelik her fontta doğru çalışıyor.
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TailRule } from "@/data/writingMnemonics";

export function TailErase({ rule, size = "md" }: { rule: TailRule; size?: "sm" | "md" }) {
  // Duraklat/oynat — çocuk kendi hızında inceleyebilsin (özerklik).
  const [playing, setPlaying] = useState(true);
  // Sahne yüksekliğine göre glif: derin çanaklı harfler (ج ع) kırpılmasın diye
  // glif, sahneden belirgin küçük tutulur.
  const glyph = size === "sm" ? "text-5xl" : "text-6xl sm:text-7xl";

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-card p-3 shadow-soft">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-foreground">{rule.name}</span>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground active:scale-95"
          aria-label={playing ? "Animasyonu duraklat" : "Animasyonu oynat"}
        >
          {playing ? "⏸ durdur" : "▶ oynat"}
        </button>
      </div>

      {/* Sahne: yalın ↔ başta çapraz geçiş + silgi süpürmesi */}
      <div className="relative mx-auto flex h-32 w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl bg-emerald-50/60">
        {/* Kuyruk bölgesi işareti — RTL'de kuyruk sol-ALTA sarkar; kutu glifin
            alt yarısına oturur. DIŞ katman konumlandırır, İÇ katman animasyonu
            taşır: keyframe `transform: scale()` yazdığı için ikisi aynı öğede
            olursa Tailwind'in `-translate-x` sınıfını ezer. */}
        <span aria-hidden className="pointer-events-none absolute bottom-4 left-1/2 h-12 w-[50%] -translate-x-[52%]">
          <span
            className={cn(
              "block h-full w-full rounded-lg border-2 border-dashed border-destructive/70 bg-destructive/5",
              playing ? "animate-tail-marker" : "opacity-0",
            )}
          />
        </span>
        {/* Yalın hâl (solar) */}
        <span
          className={cn(
            "absolute -translate-y-2 font-arabic leading-[1.6] text-emerald-900", glyph,
            playing ? "animate-tail-iso" : "opacity-0",
          )}
          dir="rtl"
        >
          {rule.iso}
        </span>
        {/* Başta hâli (belirir) */}
        <span
          className={cn(
            "absolute -translate-y-2 font-arabic leading-[1.6] text-primary", glyph,
            playing ? "animate-tail-init" : "opacity-100",
          )}
          dir="rtl"
        >
          {rule.init}
        </span>
        {/* Silgi — sarmalayıcı sahne genişliğinde (keyframe yüzdeleri sahneye
            göre çalışsın diye), emoji sarmalayıcının solunda durur. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-3 left-0 w-full",
            playing ? "animate-tail-eraser" : "opacity-0",
          )}
        >
          <span className="text-3xl">🧽</span>
        </span>
      </div>

      {/* Yalın → başta özeti (animasyondan bağımsız, her zaman okunur).
          Glif kutuları SABİT ve BOL yükseklikli: Arapça glifler (ج ع gibi derin
          çanaklılar) satır kutusunun dışına taşar; dar kutuda alttaki etikete
          biner. h-16 + üstte hizalama, taşan mürekkebe alan bırakır. */}
      <div className="mt-2 flex items-end justify-center gap-2 text-center" dir="ltr">
        <span className="flex flex-col items-center">
          <span className="flex h-16 items-start justify-center pt-1">
            <span className="font-arabic text-3xl leading-none text-emerald-900" dir="rtl">{rule.iso}</span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground">yalın</span>
        </span>
        <span className="flex flex-col items-center px-1">
          <span className="flex h-16 flex-col items-center justify-center">
            <span className="text-lg leading-none" aria-hidden>✂️</span>
            <span className="mt-0.5 text-[9px] font-extrabold leading-tight text-destructive">{rule.tailName}</span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground">silinir</span>
        </span>
        <span className="flex h-16 items-center pb-4 text-xl text-muted-foreground" aria-hidden>→</span>
        <span className="flex flex-col items-center">
          <span className="flex h-16 items-start justify-center pt-1">
            <span className="font-arabic text-3xl leading-none text-primary" dir="rtl">{rule.init}</span>
          </span>
          <span className="text-[9px] font-bold text-muted-foreground">başta</span>
        </span>
      </div>

      <p className="mt-2 text-center text-[11px] font-bold leading-snug text-foreground">
        {rule.say}
      </p>
      <p className="mt-0.5 text-center text-[10px] font-semibold text-muted-foreground">
        Kalan parça: <b className="text-primary">{rule.keepName}</b>
      </p>
    </div>
  );
}
