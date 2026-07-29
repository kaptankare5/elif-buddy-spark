// 🔥 KOMBO ROZETİ + uçan puan — oyunlara "tepki" hissi veren küçük katman.
//
// Çocuk doğru cevabı verdiğinde ekranda BİR ŞEY olmalı: rakam büyümeli, bir
// şey uçmalı. Bu geri bildirim olmadan doğru cevap "hiçbir şey olmadı" gibi
// hissettiriyor ve oyun sıkıcı kalıyor.
import { cn } from "@/lib/utils";
import { comboMult } from "@/lib/gameFeel";

export function ComboBadge({ streak, className }: { streak: number; className?: string }) {
  const mult = comboMult(streak);
  if (streak < 2) return null;
  return (
    <span
      key={streak}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold shadow-soft animate-pop",
        mult >= 4 ? "bg-warning text-warning-foreground"
          : mult >= 3 ? "bg-destructive text-destructive-foreground"
            : mult >= 2 ? "bg-info text-info-foreground"
              : "bg-muted text-muted-foreground",
        className,
      )}
    >
      🔥 {streak}{mult > 1 && <span className="opacity-90">· {mult}×</span>}
    </span>
  );
}

/** Ekranda yukarı doğru uçup kaybolan "+12" yazısı */
export function FloatScore({ text, tone = "good" }: { text: string; tone?: "good" | "bad" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/3 z-20 text-3xl font-extrabold drop-shadow animate-score-pop",
        tone === "good" ? "text-success" : "text-destructive",
      )}
    >
      {text}
    </span>
  );
}
