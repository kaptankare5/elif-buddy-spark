import { useEffect } from "react";

// Yeni bölüm/başarı kutlaması — kısa, coşkulu, kendiliğinden kaybolur.
// Öğrenme bilimi: anlık, belirgin ödül sinyali yetkinlik algısını güçlendirir
// (öz-belirleme kuramı) ve bir sonraki hedefe geçiş motivasyonu verir.
// 2.6 sn sonra kendini kapatır — akışı bölmez.
export function UnlockCelebration({ title, subtitle, onDone }: {
  title: string;
  subtitle?: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      {/* Konfeti yağmuru */}
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${(i * 37) % 100}%`,
            top: "-8%",
            animationDelay: `${(i % 9) * 0.13}s`,
            animationDuration: `${1.8 + (i % 5) * 0.25}s`,
            fontSize: `${16 + (i % 3) * 10}px`,
          }}
        >
          {["🎉", "⭐", "✨", "🎈"][i % 4]}
        </span>
      ))}
      <div className="rounded-3xl bg-card border-4 border-warning px-8 py-6 text-center shadow-elegant animate-bounce-in">
        <div className="text-5xl mb-2">🎉</div>
        <div className="text-xl font-extrabold text-foreground">{title}</div>
        {subtitle && <div className="text-sm font-bold text-warning mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}
