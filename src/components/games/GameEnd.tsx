// 🏁 ORTAK BİTİŞ EKRANI — her oyun aynı tatmin edici kapanışı paylaşır.
//
// Eskiden bazı oyunların bitişi hiç yoktu (Balon, Hafıza, Yapboz sonsuzdu),
// bazılarınınki de düz bir "Skorun: 7" metniydi. Bitiş anı oyunun EN ÖNEMLİ
// anıdır: çocuk orada "bir daha" der ya da kapatır. Buradaki üç kanca:
//   • YILDIZ — 3 yıldız somut, ulaşılabilir bir hedef ("2 aldım, bir daha").
//   • REKOR — kendi rekorunu geçmek; başkasıyla değil kendiyle yarışma.
//   • BAHÇE — yüksek notada bitiş + yarına çağrı (Zeigarnik; sessionEnd.ts).
import { Link } from "react-router-dom";
import { Sprout, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GameEndProps {
  title?: string;
  /** Ana skor (büyük gösterilir) */
  score: number;
  scoreLabel?: string;
  /** 0-3 yıldız */
  stars: 0 | 1 | 2 | 3;
  best: number;
  newBest: boolean;
  /** Yüksek notada bitiş cümlesi (sessionEnd.gardenTease) */
  tease: string;
  onRestart: () => void;
  /** İsteğe bağlı ek satır: "12 harf öğrendin" gibi */
  detail?: string;
}

const STAR_TEXT: Record<number, string> = {
  0: "Denemeye devam!",
  1: "Güzel başlangıç!",
  2: "Çok iyi!",
  3: "Mükemmel! 3 yıldız!",
};

export function GameEnd({
  title = "Oyun Bitti", score, scoreLabel = "Puan", stars, best, newBest, tease, onRestart, detail,
}: GameEndProps) {
  return (
    <div className="rounded-3xl border-4 border-success/40 bg-card p-6 text-center shadow-card animate-bounce-in">
      {/* Yıldızlar — sırayla belirir, kazanılan his */}
      <div className="mb-2 flex justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "text-4xl transition-transform",
              i < stars ? "animate-pop" : "opacity-25 grayscale",
            )}
            style={{ animationDelay: `${i * 160}ms` }}
          >
            ⭐
          </span>
        ))}
      </div>
      <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
      <p className="mt-0.5 text-sm font-extrabold text-success">{STAR_TEXT[stars]}</p>

      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="rounded-2xl border-2 border-success/30 bg-success/10 px-4 py-2">
          <div className="text-[10px] font-bold text-muted-foreground">{scoreLabel}</div>
          <div className="text-2xl font-extrabold text-success">{score}</div>
        </div>
        <div className={cn(
          "rounded-2xl border-2 px-4 py-2",
          newBest ? "border-warning bg-warning/15 animate-pop" : "border-border bg-muted/40",
        )}>
          <div className="text-[10px] font-bold text-muted-foreground">
            {newBest ? "🎉 YENİ REKOR" : "Rekorun"}
          </div>
          <div className={cn("text-2xl font-extrabold", newBest ? "text-warning" : "text-muted-foreground")}>
            {best}
          </div>
        </div>
      </div>

      {detail && (
        <p className="mt-2 text-xs font-bold text-muted-foreground">{detail}</p>
      )}

      <div className="mt-3 rounded-2xl border-2 border-success/30 bg-success/10 px-4 py-2 text-sm font-extrabold text-success">
        {tease}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground shadow-card transition-bouncy hover:scale-105 active:scale-95"
        >
          <RotateCcw className="h-5 w-5" /> Tekrar Oyna
        </button>
        <Link
          to="/bahce"
          className="inline-flex items-center gap-1.5 rounded-full bg-success px-5 py-3 font-extrabold text-success-foreground shadow-card transition-bouncy hover:scale-105"
        >
          <Sprout className="h-5 w-5" /> Bahçem
        </Link>
      </div>
    </div>
  );
}
