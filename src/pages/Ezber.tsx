// Ezber ana sayfası: sure/dua listesi + ilerleme. Çalışma /ezber/:suraId'de.
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { SURAS } from "@/data/ezber";
import { getSuraProgress, suraMasteryPct, suraMastered } from "@/lib/ezberSrs";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_CHIP = [
  "bg-muted",                // 0 görülmemiş
  "bg-destructive/70",       // 1
  "bg-warning/80",           // 2
  "bg-yellow-400/90",        // 3
  "bg-success",              // 4
];

const Ezber = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-success/10 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="📿 Ezber" backTo="/" centered />

        <div className="mb-4 rounded-2xl bg-card p-4 shadow-card border-2 border-success/30">
          <h3 className="font-extrabold text-sm text-foreground mb-1">Nasıl çalışır?</h3>
          <p className="text-[12px] leading-relaxed text-muted-foreground font-semibold">
            Sure küçük parçalara bölünür. Sistem bildiğin parçaları gösterir,
            sıradakini gizler — <span className="text-foreground">devamını içinden getir</span>,
            sonra kendini işaretle. Bilmediklerin daha sık gelir, ustalaştıkça
            ipuçları azalır. 🧠
          </p>
        </div>

        <div className="space-y-3">
          {SURAS.map((s, i) => {
            const pct = suraMasteryPct(s);
            const done = suraMastered(s);
            const prog = getSuraProgress(s.id);
            return (
              <Link
                key={s.id}
                to={`/ezber/${s.id}`}
                className="block rounded-2xl bg-card p-4 shadow-card border-2 border-border/40 transition-bouncy hover:-translate-y-0.5 hover:shadow-elegant animate-bounce-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-foreground">{s.title}</h2>
                      {done && <Crown className="h-4 w-4 text-warning shrink-0" />}
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground truncate">{s.desc}</p>
                  </div>
                  <span className="text-sm font-extrabold text-success shrink-0">%{pct}</span>
                </div>
                {/* parça haritası: her kutu bir parça, renk = seviye */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.segments.map((seg) => (
                    <span
                      key={seg.id}
                      className={cn(
                        "h-2.5 flex-1 min-w-[14px] rounded-full",
                        LEVEL_CHIP[Math.min(4, prog[seg.id]?.lvl ?? 0)],
                      )}
                    />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-4 text-center text-[11px] font-bold text-muted-foreground">
          🟩 ezberlendi • 🟨 pekişiyor • 🟥 zayıf • ⬜ sırada
        </p>
      </main>
    </div>
  );
};

export default Ezber;
