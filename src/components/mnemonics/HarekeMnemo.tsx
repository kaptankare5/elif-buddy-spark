// ﹷ HAREKE HAFIZA YÖNTEMİ — Türkçe öncelikli.
//
// Birinci kanca TÜRKÇE İSİM (çocuk zaten biliyor): "ÜSTÜN → ÜSTte durur",
// "ÖTRE → adında Ö var, Ü okunur", "ESRE → üstünün tersi, ALTta".
// İkinci katman yapısal: her hareke kendi uzatma harfinin minyatürü — animasyon
// bunu gösterir (Elif yan yatıp küçülür → üstün olur).
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HarekeMnemonic } from "@/data/writingMnemonics";
import { findItem } from "@/data/subjects";
import { playItem } from "@/lib/audio";

// Örnek: Be harfi üzerinde bu hareke (l3-02-fetha gibi) → gerçek hoca sesi
const beItemId = (id: HarekeMnemonic["id"]) => `l3-02-${id}`;

export function HarekeMnemo({ m }: { m: HarekeMnemonic }) {
  const [playing, setPlaying] = useState(true);
  const item = findItem(beItemId(m.id));

  return (
    <div className="rounded-2xl border-2 border-primary/25 bg-card p-3 shadow-card">
      {/* Başlık: hareke + adı + Türkçe sesi */}
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {/* onLetter (harf+hareke) kullanılır — izole "◌َ" (noktalı daire+işaret)
              Amiri/Scheherazade'de kesikli halka gibi çiziliyor, okunaksız. */}
          <span className="font-arabic text-2xl leading-none text-primary">{m.onLetter}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-foreground">{m.name}</div>
          <div className="text-[11px] font-bold text-muted-foreground">
            ince harfte <b className="text-primary">{m.soundThin}</b> · kalın harfte <b className="text-primary">{m.soundThick}</b>
          </div>
        </div>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="shrink-0 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground active:scale-95"
          aria-label={playing ? "Animasyonu duraklat" : "Animasyonu oynat"}
        >
          {playing ? "⏸" : "▶"}
        </button>
      </div>

      {/* TÜRKÇE ANA KANCA — en büyük, en görünür */}
      <div className="mb-2 rounded-xl border-2 border-warning/40 bg-warning/10 p-2.5">
        <div className="mb-0.5 text-[9px] font-extrabold uppercase tracking-wide text-warning">
          🇹🇷 {m.hookKind}
        </div>
        <p className="text-[13px] font-extrabold leading-snug text-foreground">{m.hook}</p>
      </div>

      {/* Yapısal katman: kaynak şekil → hareke dönüşümü (animasyonlu).
          "harf" (üstün/ötre): gerçek uzatma harfi küçülür/döner.
          "isaret" (esre): SAHTE bir harf benzerliği uydurmadan, üstünün
          KENDİ işareti aşağı iner — dürüst gösterim (kullanıcı düzeltmesi). */}
      <div className="rounded-xl bg-emerald-50/60 p-2">
        <p className="mb-1 text-center text-[10px] font-extrabold text-muted-foreground">
          {m.morphLabel} {m.name}
        </p>
        <div className="relative mx-auto flex h-20 w-full max-w-[200px] items-center justify-center overflow-hidden">
          {/* Kaynak şekil: döner/küçülür/iner.
              "harf" → gerçek uzatma harfi (font glifi, güvenilir çizilir).
              "isaret" (yalnız esre) → font'un noktalı-daire+işaret kombosu
              bazı hatlarda (Amiri/Scheherazade) kesikli halka gibi çiziliyor,
              işaret gibi OKUNMUYOR — bu yüzden CSS'le çizilmiş net bir çizgi
              kullanılır: üstünle birebir aynı, yalnız konumu animasyonla değişir. */}
          {m.morphKind === "harf" ? (
            <span
              className={cn(
                "absolute font-arabic text-5xl leading-none text-emerald-900",
                playing ? "animate-hareke-morph" : "opacity-0",
              )}
              style={{
                "--mn-rot": `${m.rotate}deg`,
                "--mn-scale": m.scale,
                "--mn-y": `${m.translateY}px`,
              } as React.CSSProperties}
              dir="rtl"
            >
              {m.morphGlyph}
            </span>
          ) : (
            <span
              aria-hidden
              className={cn("absolute", playing ? "animate-hareke-morph" : "opacity-0")}
              style={{
                "--mn-rot": `${m.rotate}deg`,
                "--mn-scale": m.scale,
                "--mn-y": `${m.translateY}px`,
              } as React.CSSProperties}
            >
              <span className="block h-[7px] w-9 rounded-full bg-emerald-900" />
            </span>
          )}
          {/* Hedef: harf üzerinde hareke */}
          <span
            className={cn(
              "absolute font-arabic text-5xl leading-none text-primary",
              playing ? "animate-hareke-target" : "opacity-100",
            )}
            dir="rtl"
          >
            {m.onLetter}
          </span>
        </div>
        <p className="mt-1 text-center text-[10px] font-bold leading-snug text-muted-foreground">
          {m.shapeSay}
        </p>
      </div>

      {/* Ses + ileri kanca */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => item && playItem(item)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground shadow-soft active:scale-95"
        >
          🔊 Dinle: {m.onLetter} = &quot;b{m.soundThin}&quot;
        </button>
      </div>
      <p className="mt-1.5 rounded-lg bg-muted/60 px-2 py-1 text-[10px] font-semibold leading-snug text-muted-foreground">
        🔮 {m.future}
      </p>
    </div>
  );
}
