// 🩹 TELAFİ EKRANI — hata yapılan harfin hafıza yöntemi, tek global host.
//
// Test, Flashcard ve oyunlar aynı olayı yayar (remedial.ts → REMEDY_EVENT);
// burası dinler ve harfe uygun yöntemi açar:
//   • kuyruklu harf (Ayn, Sin, Cim…) → PARMAKLA SİL oyunu; çocuk kuyruğu
//     silince başta hâli ortaya çıkar (anlatmak yerine yaptırmak).
//   • nokta ailesinden bir harf (Be, Te, Nun…) → nokta karşılaştırması.
//   • değişmeyen 6 harften biri → "bu harf hiç değişmez" hatırlatması.
//
// Ne zaman açılacağına remedial.ts karar verir (ısrar + soğuma + seans
// tavanı). Burada politika YOK — yalnız sunum.
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { REMEDY_EVENT, type Remedy } from "@/lib/remedial";
import { TAIL_RULES, DOT_GROUPS, STABLE_GROUP } from "@/data/writingMnemonics";
import { EraseGame } from "@/components/mnemonics/EraseGame";
import { DotCompare } from "@/components/mnemonics/DotCompare";
import { findItem } from "@/data/subjects";
import { playItem } from "@/lib/audio";

const FORM_TR: Record<string, string> = { init: "başta", med: "ortada", fin: "sonda" };

export function RemedyOverlay() {
  const [remedy, setRemedy] = useState<Remedy | null>(null);

  useEffect(() => {
    const h = (e: Event) => setRemedy((e as CustomEvent<Remedy>).detail);
    window.addEventListener(REMEDY_EVENT, h);
    return () => window.removeEventListener(REMEDY_EVENT, h);
  }, []);

  const close = useCallback(() => setRemedy(null), []);

  // Escape ile kapan (masaüstü/klavye)
  useEffect(() => {
    if (!remedy) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [remedy, close]);

  if (!remedy) return null;

  const rule = TAIL_RULES.find((r) => r.n === remedy.letter);
  // Harf birden çok nokta grubunda olabilir (Şın: "Sin · Şin" ve "Şın ile
  // Peltek Se"). Önce KARIŞTIRDIĞI harfle aynı gruptakini ara — çocuğa
  // gerçekten yaptığı hatanın karşılaştırmasını göster; bulunamazsa harfin
  // ilk grubuna düş.
  const group =
    (remedy.partner != null
      ? DOT_GROUPS.find((g) =>
          g.letters.some((l) => l.n === remedy.letter) &&
          g.letters.some((l) => l.n === remedy.partner))
      : undefined)
    ?? DOT_GROUPS.find((g) => g.letters.some((l) => l.n === remedy.letter));
  const stable = STABLE_GROUP.letters.find((l) => l.n === remedy.letter);
  const name = rule?.name ?? group?.letters.find((l) => l.n === remedy.letter)?.name ?? stable?.name ?? "";
  const form = remedy.itemId.match(/-(init|med|fin)$/)?.[1];
  const item = findItem(remedy.itemId);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/95 p-3 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border-4 border-warning/40 bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wide text-warning">
              🩹 Bunu karıştırdın — hatırlatma
            </div>
            <h2 className="text-base font-extrabold leading-tight text-foreground">
              {name}
              {form && <span className="text-muted-foreground"> · {FORM_TR[form]} hâli</span>}
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Kapat"
            className="shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sesi bir kez daha duysun — hata anında ses-şekil bağı tazelenir */}
        {item && (
          <button
            onClick={() => playItem(item)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground shadow-soft active:scale-95"
          >
            🔊 {name} · {form ? FORM_TR[form] : ""} — tekrar dinle
          </button>
        )}

        {remedy.kind === "kuyruk" && rule && <EraseGame rule={rule} />}
        {remedy.kind === "nokta" && group && (
          <DotCompare group={group} initialForm={(form as "init" | "med" | "fin") ?? "init"} />
        )}
        {remedy.kind === "sabit" && (
          <div className="rounded-2xl border-2 border-success/40 bg-success/10 p-4 text-center">
            <div className="font-arabic text-5xl leading-[1.5] text-emerald-900" dir="rtl">
              {stable?.iso}
            </div>
            <p className="mt-2 text-sm font-extrabold text-success">
              {name} hiç değişmez!
            </p>
            <p className="mt-1 text-xs font-bold leading-snug text-muted-foreground">
              Bu harf kendinden sonraki harfe bağlanmaz — başta da, ortada da,
              sonda da aynı görünür. Şeklini ezberlemene gerek yok.
            </p>
          </div>
        )}

        <button
          onClick={close}
          className="mt-3 w-full rounded-2xl bg-success px-4 py-3 text-sm font-extrabold text-white shadow-soft active:scale-95"
        >
          Anladım, devam ✓
        </button>
      </div>
    </div>
  );
}
