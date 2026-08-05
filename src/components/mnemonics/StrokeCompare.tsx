// ÇİZGİ KARŞILAŞTIRMASI — Elif ile Lem gibi NOKTASIZ, aynı dikey çizgiyi
// paylaşan ikililer için. Nokta yöntemi burada işe yaramaz (ikisinin de
// noktası yok) ve harfin KENDİSİNE bakarak da ayrım yapılamaz; ayırt edici
// olan KOMŞUSU: solundaki harf bitişikse Lem, ayrıysa Elif.
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
  const quran = pair.quran?.[form];

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
          // Elif sola bağlanmaz → solundaki harf AYRI. Lem bağlanır → BİTİŞİK.
          const bitisik = l.n !== 1;
          return (
            <button
              key={l.n}
              onClick={() => item && playItem(item)}
              aria-label={`${l.name} — soldaki harf ${bitisik ? "bitişik" : "ayrı"}`}
              className="flex min-w-[92px] flex-col items-center gap-0.5 rounded-xl border-2 border-info/20 bg-sky-50/60 px-2 py-2 transition-bouncy hover:-translate-y-0.5 hover:border-info/50 active:scale-95"
            >
              <span className="font-arabic text-4xl leading-[1.6] text-emerald-900">{l[form]}</span>
              {/* KANIT: harfin yanına gerçek bir komşu (Be) konur ve font
                  şekillendirmesi kuralı KENDİSİ gösterir — Lem'de yapışır,
                  Elif'te arada boşluk kalır. Soyut kutu/çubuk çizmek yerine
                  çocuğun okurken göreceği şeklin aynısı.
                  ⚠️ Tek metin düğümü olmalı: harfleri ayrı <span>'lara bölmek
                  Arapça bitişmeyi bozar, o yüzden hedef harf renklendirilmez. */}
              <span className="font-arabic text-2xl leading-[1.7] text-info">
                {form === "init" ? `${l.iso}ب` : `ب${l.iso}ب`}
              </span>
              <span className="text-[11px] font-extrabold text-foreground" dir="ltr">{l.name}</span>
              <span className={cn("text-[9px] font-bold leading-tight", bitisik ? "text-info" : "text-warning")} dir="ltr">
                {bitisik ? "soldaki harf BİTİŞİK" : "soldaki harf AYRI"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 rounded-lg bg-muted/60 px-2 py-1.5 text-[10px] font-semibold leading-snug text-muted-foreground">
        ℹ️ Lem'in <b>sonda</b> (ﻞ) ve <b>yalın</b> (ل) hâlinde derin bir çanak var —
        orada Elif'le karışmaz, o yüzden burada gösterilmiyor.
      </p>

      {/* Kur'an'dan örnek — açık olan HÂLE ait olanı. Kural soyut kalmasın:
          çocuk aynı ayırt etmeyi gerçek bir kelimede yapar. */}
      {quran && (
        <div className="mt-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-2 text-center">
          <div className="text-[9px] font-extrabold uppercase tracking-wide text-primary/70">
            Kur'an'da böyle görürsün
          </div>
          {/* ⚠️ leading BOL olacak: Amiri Quran esreyi em kutusunun epey
              ALTINA çizer; leading-[1.7]'de esreler alttaki okunuş satırının
              üstüne biniyor ve harf yanlış okunuyordu. */}
          <div className="font-arabic pb-1 text-3xl leading-[2.2] text-emerald-900" dir="rtl">{quran.ar}</div>
          <div className="text-[11px] font-extrabold text-primary">{quran.okunus} · {quran.kaynak}</div>
          <div className="mt-0.5 text-[10px] font-bold leading-snug text-muted-foreground">{quran.not}</div>
        </div>
      )}

      <p className="mt-1.5 text-center text-[10px] font-bold text-muted-foreground">
        🔊 Bir harfe dokun — sesini dinle
      </p>
    </div>
  );
}
