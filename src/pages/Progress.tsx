import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SUBJECTS } from "@/data/subjects";
import { getTopicSrs, getNamespaceStats, getCloudSrsState, useSrsTick, type Level, type SrsState } from "@/data/srs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NS = "quiz" as const;

const ProgressPage = () => {
  useSrsTick(NS);
  const localStats = getNamespaceStats(NS);
  const { session } = useAuth();
  // Local-first: ilerleme verisi her zaman bu cihazdaki localStorage'dan okunur.
  // Bulut sadece yedek/izleme amaçlıdır (yazma devam ediyor, okuma yapılmıyor).
  const uid = session?.user.id ?? null;
  const [cloudSrs] = useState<SrsState | null>(null);

  // (kaldırıldı) bulut yükleme efekti — local-first
  useEffect(() => {
    // re-render on progress updates
    const onProgress = () => {};
    window.addEventListener("elifba-progress-updated", onProgress);
    return () => { window.removeEventListener("elifba-progress-updated", onProgress); };
  }, []);

  const showCloudLoading = false;
  const stats = localStats;
  const accountLabel = session
    ? (session.user.user_metadata?.display_name || session.user.email || "Hesabım")
    : "Misafir (sadece bu cihaz)";

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      <main className="container mx-auto max-w-2xl px-4 pb-16">
        <PageHeader title="📈 İlerleme" backTo="/" centered />

        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-card border-2 border-primary/30 px-3 py-1">
            👤 {accountLabel}
          </span>
          {!session && (
            <Link to="/giris" className="rounded-full bg-primary text-primary-foreground px-3 py-1 font-extrabold">
              Giriş yap
            </Link>
          )}
        </div>

        {false && (
          <div className="mb-3 text-center text-xs font-bold text-muted-foreground animate-pulse">
            ☁️ Hesap verisi yükleniyor…
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="Toplam Cevap" value={showCloudLoading ? "…" : stats.total} color="text-primary" />
          <Stat label="Doğru" value={showCloudLoading ? "…" : stats.correct} color="text-success" />
          <Stat label="Başarı" value={showCloudLoading ? "…" : `${stats.percent}%`} color="text-info" />
        </div>


        <div className="mb-6 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((l) => (
            <LevelBox key={l} level={l as Level} count={showCloudLoading ? "…" : stats.levelCount[l as Level]} />
          ))}
        </div>

        <div className="space-y-4">
          {SUBJECTS.map((s) => (
            <div key={s.id} className="rounded-3xl bg-card shadow-card border-2 border-border/50 overflow-hidden">
              <div className={cn("p-3 text-white", s.bgVar)}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{s.emoji}</span>
                  <h2 className="font-extrabold">{s.title}</h2>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {s.topics.map((t) => {
                  const srs = getTopicSrs(NS, t.id);
                  const ids = t.items.map((i) => i.id);
                  const counts: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
                  let touched = 0;
                  for (const id of ids) {
                    const e = srs[id];
                    if (e) { counts[e.level as Level]++; touched++; }
                  }
                  const pct = ids.length ? Math.round((touched / ids.length) * 100) : 0;
                  const topicLoading = showCloudLoading;
                  return (
                    <details key={t.id} className="group rounded-2xl bg-muted/50 overflow-hidden">
                      <summary className="flex items-center gap-3 p-3 cursor-pointer list-none transition-bouncy hover:bg-muted">
                        <span className="text-2xl">{t.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{t.title}</div>
                          <div className="mt-1 h-2 rounded-full bg-background overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-info via-primary to-success" style={{ width: topicLoading ? "100%" : `${pct}%` }} />
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground font-semibold">
                            {topicLoading ? "Yükleniyor…" : `${touched}/${ids.length} öğe • %${pct}`}
                          </div>
                        </div>
                        <div className="flex gap-1 text-[10px] font-bold">
                          {[1, 2, 3, 4].map((l) => (
                            <span key={l} className={cn("rounded px-1 py-0.5",
                              l === 1 && "bg-info/20 text-info",
                              l === 2 && "bg-warning/20 text-warning",
                              l === 3 && "bg-secondary text-secondary-foreground",
                              l === 4 && "bg-success/20 text-success")}>
                              {topicLoading ? "…" : counts[l as Level]}
                            </span>
                          ))}
                        </div>
                        <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="px-3 pb-3 pt-1">
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          {t.items.map((it) => {
                            const e = srs[it.id];
                            const lv = topicLoading ? 0 : ((e?.level as Level) ?? 0);
                            return (
                              <div key={it.id} className={cn(
                                "flex items-center gap-2 rounded-lg px-2 py-1 text-xs bg-card border",
                                lv === 0 && "border-border/40 opacity-60",
                                lv === 1 && "border-info/40",
                                lv === 2 && "border-warning/40",
                                lv === 3 && "border-secondary",
                                lv === 4 && "border-success/40",
                              )}>
                                <span className="text-lg">{it.emoji}</span>
                                <span className="flex-1 truncate font-semibold">{it.label}</span>
                                {lv > 0 && (
                                  <span className={cn("text-[9px] font-bold rounded px-1",
                                    lv === 1 && "bg-info/20 text-info",
                                    lv === 2 && "bg-warning/20 text-warning",
                                    lv === 3 && "bg-secondary text-secondary-foreground",
                                    lv === 4 && "bg-success/20 text-success")}>L{lv}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <Link to={`/konu/${s.id}/${t.id}`} className="block text-center text-xs font-bold text-primary py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20">
                          Konuya git →
                        </Link>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

function statsFromState(state: SrsState): ReturnType<typeof getNamespaceStats> {
  let total = 0, correct = 0;
  const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  Object.values(state).forEach((topic) => {
    Object.values(topic).forEach((e) => {
      total += e.total;
      correct += e.correct;
      levelCount[e.level] += 1;
    });
  });
  return { total, correct, percent: total === 0 ? 0 : Math.round((correct / total) * 100), levelCount };
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-soft border-2 border-border/40">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-extrabold", color)}>{value}</div>
    </div>
  );
}

function LevelBox({ level, count }: { level: Level; count: number | string }) {
  return (
    <div className={cn("rounded-xl p-2 text-center shadow-soft border-2",
      level === 1 && "bg-info/10 border-info/40",
      level === 2 && "bg-warning/10 border-warning/40",
      level === 3 && "bg-secondary/40 border-secondary",
      level === 4 && "bg-success/10 border-success/40")}>
      <div className="text-[10px] font-bold text-muted-foreground">Seviye {level}</div>
      <div className="text-xl font-extrabold">{count}</div>
    </div>
  );
}

export default ProgressPage;
