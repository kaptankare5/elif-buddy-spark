import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Crown, TrendingUp, Gamepad2, Flame } from "lucide-react";
import { RouteHead } from "@/components/RouteHead";

import { SUBJECTS } from "@/data/subjects";

import { getUnlockedTopicIds, isTopicCompleted } from "@/lib/unlock";
import { getTopicSrs, useSrsTick, type Level } from "@/data/srs";
import { getStreak, STREAK_EVENT } from "@/lib/streak";
import { useStudents } from "@/lib/students";
import { StudentSwitcher } from "@/components/StudentSwitcher";
import type { ContentTopic } from "@/data/types";
import { cn } from "@/lib/utils";

// Konu ilerlemesi: kaç öğe ustalaşıldı (seviye 3+). noPractice konular ölçülmez.
function topicProgress(t: ContentTopic): { done: number; total: number; pct: number } {
  if (t.noPractice || t.items.length === 0) return { done: 0, total: 0, pct: 0 };
  const srs = getTopicSrs("quiz", t.id);
  let done = 0;
  for (const it of t.items) if (((srs[it.id]?.level ?? 1) as Level) >= 3) done++;
  return { done, total: t.items.length, pct: Math.round((done / t.items.length) * 100) };
}

const Index = () => {
  useSrsTick("quiz");
  const [unlocked, setUnlocked] = useState<Set<string>>(() => getUnlockedTopicIds());
  const [streak, setStreak] = useState(() => getStreak());
  
  const { active: activeStudent } = useStudents();

  useEffect(() => {
    const refresh = () => { setUnlocked(getUnlockedTopicIds()); setStreak(getStreak()); };
    refresh();
    window.addEventListener("elifba-progress-updated", refresh);
    window.addEventListener("elifba-srs-quiz-updated", refresh);
    window.addEventListener(STREAK_EVENT, refresh);
    return () => {
      window.removeEventListener("elifba-progress-updated", refresh);
      window.removeEventListener("elifba-srs-quiz-updated", refresh);
      window.removeEventListener(STREAK_EVENT, refresh);
    };
  }, []);

  const topics = SUBJECTS[0].topics;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50 via-background to-teal-50">
      <RouteHead
        title="ElifMim — Çocuklar için Elifbâ Öğrenme Uygulaması"
        description="ElifMim ile 3-8 yaş çocuklar Kur'an harflerini, harekeleri ve okuma kurallarını eğlenceli oyunlarla ve gerçek hoca sesiyle öğrenir."
        path="/"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute top-10 left-6 text-6xl font-arabic text-emerald-700/60">ﷲ</div>
        <div className="absolute top-40 right-8 text-5xl font-arabic text-teal-700/40">ﺍﻟﻘﺮﺁﻥ</div>
      </div>

      <main className="container relative mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {/* Hoca modu: öğrenci profili değiştirici */}
          <StudentSwitcher />
          {/* Hesap/Giriş butonu şimdilik gizli — Ayarlar alt menüden erişilebilir */}
        </div>

        <div className="mb-6 text-center animate-bounce-in">
          <div className="text-7xl font-arabic mb-2 text-emerald-700">ﺇﻗﺮﺃ</div>
          <h1 className="mb-1 text-4xl font-extrabold tracking-tight text-primary text-shadow-soft">
            Elifbâ
          </h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Kur'an-ı Kerim'i Öğreniyorum • Diyanet Müfredatı
          </p>
        </div>

        <div className="mb-4 rounded-2xl bg-card border-2 border-primary/20 p-4 shadow-card text-center">
          <p className="text-sm font-bold text-foreground mb-1 font-arabic text-2xl">رَبِّ يَسِّرْ وَلَا تُعَسِّرْ</p>
          <p className="text-xs text-muted-foreground">Rabbim, kolaylaştır zorlaştırma</p>
        </div>

        {/* Günlük seri — alışkanlık döngüsü (her gün biraz çalış!) */}
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 border-2 shadow-soft font-extrabold text-sm",
            streak.count > 0
              ? "bg-warning/15 border-warning/50 text-warning"
              : "bg-muted/50 border-border text-muted-foreground",
          )}>
            <Flame className={cn("h-5 w-5", streak.count > 0 && "fill-warning")} />
            {streak.count > 0
              ? <span>{streak.count} günlük seri{!streak.activeToday && " — bugün de çalış!"}</span>
              : <span>Bugün başla, serini kur!</span>}
          </div>
        </div>

        {/* Hoca modu: kimin profili aktif — hoca bir bakışta görsün */}
        {activeStudent && (
          <div className="mb-4 -mt-2 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info/15 border-2 border-info/40 px-4 py-1 text-xs font-extrabold text-info">
              📖 {activeStudent.emoji} {activeStudent.name} çalışıyor
            </span>
          </div>
        )}

        <div className="space-y-2 mb-6">
          {topics.map((t, i) => {
            const isUnlocked = unlocked.has(t.id);
            const done = isUnlocked && isTopicCompleted(t);
            return (
              <Link
                key={t.id}
                to={isUnlocked ? `/konu/elifba/${t.id}` : "#"}
                onClick={(e) => { if (!isUnlocked) e.preventDefault(); }}
                aria-disabled={!isUnlocked}
                className={cn(
                  "flex items-center gap-3 rounded-2xl bg-card p-4 border-2 shadow-card transition-bouncy animate-bounce-in",
                  isUnlocked
                    ? "border-primary/30 hover:-translate-y-1 hover:shadow-elegant"
                    : "border-border/40 opacity-60 cursor-not-allowed",
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-arabic",
                  done ? "bg-success/15 text-success" : isUnlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                    {t.title}
                    {done && <span className="text-xs text-success">✓</span>}
                    {!isUnlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </h2>
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    {isUnlocked ? t.description : "Alıştırma yaparak öğrenince açılır"}
                  </p>
                  {/* İlerleme çubuğu — görünür ilerleme motivasyonu güçlendirir */}
                  {isUnlocked && !t.noPractice && (() => {
                    const p = topicProgress(t);
                    return (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", done ? "bg-success" : "bg-primary")}
                            style={{ width: `${Math.max(p.pct, p.done > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground shrink-0">{p.done}/{p.total}</span>
                      </div>
                    );
                  })()}
                </div>
                {done && <Crown className="h-4 w-4 text-warning" />}
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/oyunlar"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-warning to-topic-pink p-4 text-white shadow-card transition-bouncy hover:-translate-y-1"
          >
            <Gamepad2 className="h-7 w-7" />
            <span className="text-sm font-extrabold text-shadow-soft">Oyunlar</span>
          </Link>
          <Link
            to="/ilerleme"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-info to-primary p-4 text-white shadow-card transition-bouncy hover:-translate-y-1"
          >
            <TrendingUp className="h-7 w-7" />
            <span className="text-sm font-extrabold text-shadow-soft">İlerleme</span>
          </Link>
        </div>

        <footer className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="underline hover:text-primary">Gizlilik Politikası</Link>
        </footer>
      </main>
    </div>
  );
};

export default Index;
