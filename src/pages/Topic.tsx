import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { getSubject, getTopic } from "@/data/subjects";
import { PageHeader } from "@/components/PageHeader";
import { RouteHead } from "@/components/RouteHead";
import { playItem, playFeedback, preloadItems } from "@/lib/audio";
import { Volume2, Layers, Zap, Lock, Gamepad2 } from "lucide-react";
import type { ContentItem, SubjectId } from "@/data/types";
import {
  pickNextLetter,
  recordSrsAnswer,
  getTopicSrs,
  resetTopicSrs,
  useSrsTick,
  getActiveStudentScope,
  type Level,
} from "@/data/srs";
import { cn } from "@/lib/utils";
import { isTopicUnlocked, getUnlockedSections, getSectionOrder, getUnlockedItemsOf } from "@/lib/unlock";
import { UnlockCelebration } from "@/components/UnlockCelebration";
import { LevelBadge } from "@/components/LevelBadge";

type Mode = "browse" | "test";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function buildQuestion(items: ContentItem[], targetId: string) {
  const target = items.find((it) => it.id === targetId) || items[0];
  const wrongs = shuffle(items.filter((it) => it.id !== target.id)).slice(0, 3);
  return { target, options: shuffle([target, ...wrongs]) };
}

// YouTube izleme linkini gömülü oynatıcı linkine çevirir
function ytEmbedUrl(url: string): string | null {
  const m = url.match(/[?&]v=([\w-]+)/) || url.match(/youtu\.be\/([\w-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

const NS = "quiz" as const;

const Topic = () => {
  const { subjectId, topicId } = useParams<{ subjectId: string; topicId: string }>();
  const subject = getSubject(subjectId as SubjectId);
  const topic = getTopic(subjectId as SubjectId, topicId || "");
  const [mode, setMode] = useState<Mode>("browse");
  const tick = useSrsTick(NS);

  const [q, setQ] = useState<{ target: ContentItem; options: ContentItem[] } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ title: string; subtitle?: string } | null>(null);
  const questionStartRef = useRef<number>(0);
  // Yanlış cevaplanan harf bir sonraki soruda tekrar sorulsun (anlık düzeltici tekrar)
  const retryIdRef = useRef<string | null>(null);

  const items = topic?.items || [];
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  // Test/pratik yalnızca AÇIK bölüm öğelerini sorar (aşamalı müfredat)
  const unlockedItemIds = useMemo(
    () => (topic ? getUnlockedItemsOf(topic).map((i) => i.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, tick],
  );

  useEffect(() => {
    setQ(null);
    setPicked(null);
  }, [topicId, mode]);

  useEffect(() => {
    if (mode !== "test" || !topic || unlockedItemIds.length === 0 || q) return;
    if (topic.noPractice) return;
    const pool = items.filter((it) => unlockedItemIds.includes(it.id));
    // Yanlış cevaplanan harf varsa onu tekrar sor (düzeltici tekrar), yoksa SRS seçer
    let tid: string;
    if (retryIdRef.current && unlockedItemIds.includes(retryIdRef.current)) {
      tid = retryIdRef.current;
      retryIdRef.current = null;
    } else {
      tid = pickNextLetter(NS, topic.id, unlockedItemIds);
    }
    setQ(buildQuestion(pool, tid));
    setPicked(null);
    questionStartRef.current = Date.now();
  }, [mode, topic, unlockedItemIds, q, items]);

  useEffect(() => {
    if (mode === "test" && q?.target) playItem(q.target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.target?.id, mode]);

  // Öğe seslerini önden yükle → ilk tıkta bile anında çalar (gecikmesiz).
  useEffect(() => { preloadItems(items); }, [items]);

  // Yeni bölüm açıldı mı? Açılan bölüm sayısı önceki kayda göre arttıysa kutla.
  useEffect(() => {
    if (!topic) return;
    const order = getSectionOrder(topic);
    if (order.length === 0) return;
    const unlocked = getUnlockedSections(topic);
    const count = order.filter((s) => unlocked.has(s)).length;
    // Öğrenci profiline göre ayrı takip — profil geçişinde yanlış kutlama çıkmasın
    const scope = getActiveStudentScope() ?? "guest";
    const key = `elifba-secseen-${scope}-${topic.id}`;
    let prev = -1;
    try { prev = Number(localStorage.getItem(key) ?? "-1"); } catch { /* ignore */ }
    if (prev < 0) { try { localStorage.setItem(key, String(count)); } catch { /* ignore */ } return; }
    if (count > prev) {
      const done = order.length;
      setCelebrate({
        title: count >= done ? "🏆 Konu tamamlandı!" : "Yeni bölüm açıldı! 🎉",
        subtitle: count >= done ? "Hepsini öğrendin, aferin!" : `${count}. Bölüm hazır — hadi devam!`,
      });
      try { localStorage.setItem(key, String(count)); } catch { /* ignore */ }
    }
  }, [topic, tick]);

  if (!subject || !topic) return <Navigate to="/" replace />;
  if (!isTopicUnlocked(topic.id)) return <Navigate to="/" replace />;

  const srs = getTopicSrs(NS, topic.id);
  const levelCount: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const id of itemIds) {
    const lvl = (srs[id]?.level || 1) as Level;
    levelCount[lvl] += 1;
  }
  void tick;

  const cols = topic.gridCols ?? 4;
  const colClass = cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4";
  const baseItems = items.filter((it) => !it.section);
  // Bölümler ilk görülme sırasına göre (Harfler'de "1. Bölüm…", diğer konularda "Ekstralar")
  const sectionOrder = getSectionOrder(topic);
  const unlockedSecs = getUnlockedSections(topic);
  // Bir bölümde kaç öğe ustalaşıldı (L3+) — yıldız ilerlemesi
  const sectionMastery = (sec: string) => {
    const its = items.filter((it) => it.section === sec);
    const done = its.filter((it) => ((srs[it.id]?.level ?? 1) as Level) >= 3).length;
    return { done, total: its.length };
  };
  const videoEmbed = topic.video ? ytEmbedUrl(topic.video) : null;

  const renderTile = (it: ContentItem) => (
    <button
      key={it.id}
      onClick={() => playItem(it)}
      aria-label={it.translit || it.label || "harf"}
      className="relative aspect-square rounded-2xl bg-card border-2 border-primary/15 flex flex-col overflow-hidden shadow-soft transition-bouncy hover:-translate-y-1 hover:border-primary/40 hover:shadow-card active:scale-95"
    >
      <LevelBadge itemId={it.id} topicId={topic.id} className="absolute right-1 top-1" />
      {/* Glif bölgesi — hareke işaretleri taşsa bile alttaki etiket bandına binemez */}
      <span className="flex-1 min-h-0 flex w-full items-center justify-center px-1">
        <span className={cn(
          "font-arabic text-emerald-800",
          cols === 4 ? "text-3xl sm:text-4xl" : cols === 3 ? "text-[2.5rem] sm:text-5xl" : "text-6xl",
          "leading-[1.55]",
        )}>
          {it.emoji}
        </span>
      </span>
      {it.translit && (
        <span className={cn(
          "relative z-10 w-full shrink-0 truncate border-t border-emerald-100 bg-emerald-50 px-1 py-1 text-center font-extrabold text-emerald-900",
          cols === 4 ? "text-[10px]" : "text-[11px]",
        )} dir="ltr">
          {it.translit}
        </span>
      )}
    </button>
  );

  // === BROWSE (harflere tıkla → sesini çal) ===
  if (mode === "browse") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background">
        <RouteHead
          title={`${topic.title} — Elifbâ | ElifMim`}
          description={`${topic.title}: ${topic.description} — çocuklar için sesli Elifbâ dersi.`}
          path={`/konu/${subjectId}/${topicId}`}
        />
        <main className="container mx-auto max-w-2xl px-4 pb-24">
          <PageHeader title={topic.title} backTo="/" centered />

          <div className="mb-4 rounded-2xl bg-card border-2 border-primary/20 p-4 text-center shadow-card">
            <div className="text-6xl font-arabic leading-[1.4] mb-1 text-emerald-700">{topic.emoji}</div>
            <p className="text-sm text-muted-foreground">{topic.description}</p>
            {items.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">🔊 Bir harfe/kelimeye dokun</p>
            )}
          </div>

          {/* Alıştırma yap — sayfanın üstünde, hemen erişilebilir */}
          {!topic.noPractice && (
            <div className="mb-4 rounded-2xl bg-card border-2 border-primary/20 p-3 shadow-card">
              <h3 className="text-center font-extrabold text-foreground mb-2 text-sm">🎯 Alıştırma yap</h3>
              <div className="grid grid-cols-3 gap-2">
                <PracticeCard to="#" onClick={() => setMode("test")} icon={<Zap className="h-6 w-6" />} label="Test" color="from-info to-primary" />
                <PracticeCard to={`/konu/elifba/${topic.id}/flashcard`} icon={<Layers className="h-6 w-6" />} label="Flashcard" color="from-warning to-topic-pink" />
                <PracticeCard to="/oyunlar" icon={<Gamepad2 className="h-6 w-6" />} label="Oyunlar" color="from-success to-topic-doga" />
              </div>
            </div>
          )}

          {/* Konu videosu (Diyanet karekod videosu) */}
          {videoEmbed && (
            <div className="mb-4 overflow-hidden rounded-2xl border-2 border-primary/20 shadow-card bg-black">
              <div className="aspect-video">
                <iframe
                  src={videoEmbed}
                  title={`${topic.title} videosu`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Arapça sağdan sola okunur — grid sağdan başlar */}
          {baseItems.length > 0 && (
            <div dir="rtl" className={cn("grid gap-2 mb-6", colClass)}>
              {baseItems.map(renderTile)}
            </div>
          )}

          {sectionOrder.map((sec) => {
            const open = unlockedSecs.has(sec);
            const { done, total } = sectionMastery(sec);
            const isExtra = sec === "Ekstralar";
            return (
              <div key={sec}>
                <h3 className="mb-2 flex items-center justify-center gap-2 text-center font-extrabold text-foreground">
                  {!open && <Lock className="h-4 w-4 text-muted-foreground" />}
                  <span className={cn(!open && "text-muted-foreground")}>
                    {isExtra ? "✨ Ekstralar" : sec}
                  </span>
                  {/* Bölüm ilerleme rozeti: kaç öğe ustalaşıldı */}
                  {open && !isExtra && total > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 border border-warning/40 px-2 py-0.5 text-[11px] text-warning">
                      {done >= total ? "⭐" : "☆"} {done}/{total}
                    </span>
                  )}
                </h3>
                {isExtra && open && (
                  <p className="mb-2 text-center text-[11px] font-bold text-muted-foreground">
                    Kitaptaki alıştırmalardan
                  </p>
                )}
                {open ? (
                  <div dir="rtl" className={cn("grid gap-2 mb-6", colClass)}>
                    {items.filter((it) => it.section === sec).map(renderTile)}
                  </div>
                ) : (
                  <div className="mb-6 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-5 text-center">
                    <Lock className="mx-auto mb-1 h-6 w-6 text-muted-foreground" />
                    <p className="text-xs font-bold text-muted-foreground">
                      Alıştırma yaparak öğrenince açılır
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {topic.noPractice && (
            <div className="rounded-2xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Bu konuda alıştırma yok. Harflere tıklayarak dinle ve öğren.
            </div>
          )}
        </main>
        {celebrate && (
          <UnlockCelebration title={celebrate.title} subtitle={celebrate.subtitle} onDone={() => setCelebrate(null)} />
        )}
      </div>
    );
  }

  // === TEST MODU ===
  const choose = async (opt: ContentItem) => {
    if (!q || picked) return;
    setPicked(opt.id);
    const correct = opt.id === q.target.id;
    const responseMs = questionStartRef.current ? Date.now() - questionStartRef.current : undefined;
    await recordSrsAnswer(NS, topic.id, q.target.id, correct, { responseMs });
    await playFeedback(correct);
    // Yanlışsa aynı harf bir sonraki soruda tekrar sorulsun
    retryIdRef.current = correct ? null : q.target.id;
    setTimeout(() => setQ(null), correct ? 700 : 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background">
      <RouteHead
        title={`${topic.title} Testi — Elifbâ | ElifMim`}
        description={`${topic.title} konusunu test ederek pekiştir. ${topic.description}`}
        path={`/konu/${subjectId}/${topicId}`}
      />
      <main className="container mx-auto max-w-xl px-4 pb-24">
        <PageHeader
          title={`${topic.title} • Test`}
          onBack={() => { setMode("browse"); setQ(null); setPicked(null); }}
          centered
          onReset={() => {
            resetTopicSrs(NS, topic.id);
            setQ(null);
          }}
        />

        <button
          onClick={() => setMode("browse")}
          className="mb-3 text-xs font-bold text-primary underline"
        >
          ← Konuya dön
        </button>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((l) => (
            <div key={l} className={cn(
              "rounded-lg p-1.5 text-center shadow-soft border",
              l === 1 && "bg-info/10 border-info/40",
              l === 2 && "bg-warning/10 border-warning/40",
              l === 3 && "bg-secondary/40 border-secondary",
              l === 4 && "bg-success/10 border-success/40",
            )}>
              <div className="text-[10px] leading-none">{"⭐".repeat(l)}</div>
              <div className="text-xs font-extrabold text-foreground mt-0.5">{levelCount[l as Level]}</div>
            </div>
          ))}
        </div>

        {q && (
          <>
            <div className="relative bg-card rounded-3xl p-6 shadow-card border-4 border-primary/20 mb-4 text-center animate-bounce-in" key={q.target.id}>
              <LevelBadge itemId={q.target.id} topicId={topic.id} className="absolute right-2 top-2" />
              <button
                onClick={() => playItem(q.target)}
                className="inline-flex items-center gap-3 rounded-full bg-primary px-8 py-5 text-primary-foreground font-extrabold shadow-soft transition-bouncy hover:scale-105"
                aria-label="Tekrar dinle"
              >
                <Volume2 className="h-8 w-8" />
                <span className="text-lg">Hangisi?</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt) => {
                const isCorrect = !!picked && opt.id === q.target.id;
                const isWrong = picked === opt.id && opt.id !== q.target.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => choose(opt)}
                    className={cn(
                      "relative aspect-square rounded-3xl flex flex-col items-center justify-center gap-1 shadow-card border-4 transition-bouncy bg-card border-primary/20 hover:-translate-y-1 p-3",
                      isCorrect && "bg-success border-success animate-pop",
                      isWrong && "bg-destructive border-destructive animate-shake",
                    )}
                  >
                    <LevelBadge itemId={opt.id} topicId={topic.id} className="absolute right-1.5 top-1.5" />
                    <span className={cn(
                      "font-arabic text-5xl leading-[1.5]",
                      (isCorrect || isWrong) ? "text-white" : "text-emerald-800",
                    )}>
                      {opt.emoji}
                    </span>
                    {isCorrect && (
                      <span className="text-sm font-extrabold text-white animate-fade-in">
                        {opt.translit || opt.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
      {celebrate && (
        <UnlockCelebration title={celebrate.title} subtitle={celebrate.subtitle} onDone={() => setCelebrate(null)} />
      )}
    </div>
  );
};

function PracticeCard({ to, onClick, icon, label, color }: { to: string; onClick?: () => void; icon: React.ReactNode; label: string; color: string }) {
  const cls = `flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br ${color} p-3 text-white shadow-soft transition-bouncy hover:-translate-y-0.5`;
  if (onClick) return <button onClick={onClick} className={cls}>{icon}<span className="text-xs font-extrabold">{label}</span></button>;
  return <Link to={to} className={cls}>{icon}<span className="text-xs font-extrabold">{label}</span></Link>;
}

export default Topic;
