// 🗂️ Harf Kartlarım — koleksiyon meta-oyunu (kozmetik katman).
// Her harf toplanabilir bir kart: kilitli (hiç görülmedi) → normal (L1-L3)
// → ALTIN (L4, parıltılı). Sahiplenme/koleksiyon psikolojisi: ilerleme görünür
// ve biriktirilebilir olunca değerlenir. SRS'i DEĞİŞTİRMEZ — yalnız okur.
import { useEffect, useMemo, useState } from "react";
import { RouteHead } from "@/components/RouteHead";
import { PageHeader } from "@/components/PageHeader";
import { BuddyWithBubble } from "@/components/Buddy";
import { getTopic } from "@/data/subjects";
import { getTopicSrs, useSrsTick, getActiveStudentScope, type Level } from "@/data/srs";
import { playItem } from "@/lib/audio";
import { Lock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const NS = "quiz" as const;

const Koleksiyon = () => {
  const tick = useSrsTick(NS);
  const topic = getTopic("elifba", "harfler");
  const srs = topic ? getTopicSrs(NS, topic.id) : {};
  void tick;

  const items = topic?.items ?? [];
  const states = items.map((it) => {
    const e = srs[it.id];
    const seen = (e?.seen ?? 0) > 0;
    const level = (e?.level ?? 1) as Level;
    return { it, seen, gold: seen && level >= 4, level };
  });
  const goldCount = states.filter((s) => s.gold).length;
  const seenCount = states.filter((s) => s.seen).length;

  // "YENİ" rozeti: son ziyaretten beri altına dönüşen kartlar
  const scope = getActiveStudentScope() ?? "guest";
  const seenKey = `elifba-collection-gold-${scope}-v1`;
  const [newGold, setNewGold] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const prev = new Set<string>(JSON.parse(localStorage.getItem(seenKey) || "[]"));
      const nowGold = states.filter((s) => s.gold).map((s) => s.it.id);
      setNewGold(new Set(nowGold.filter((id) => !prev.has(id))));
      localStorage.setItem(seenKey, JSON.stringify(nowGold));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenKey]);

  const buddyLine = useMemo(() => {
    if (goldCount >= items.length && items.length > 0) return "MAŞALLAH! Bütün kartlar altın oldu! 🏆";
    if (goldCount > 0) return `${goldCount} altın kartın var, maşallah! Sıradaki hangisi olacak?`;
    if (seenCount > 0) return "Harfleri en üst seviyeye çıkar, kartların ALTIN olsun! ✨";
    return "Harf öğrendikçe kartların açılır. Hadi başlayalım!";
  }, [goldCount, seenCount, items.length]);

  if (!topic) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-background">
      <RouteHead
        title="Harf Kartlarım — Elifbâ Koleksiyonu | ElifMim"
        description="Öğrendiğin her Kur'an harfi bir koleksiyon kartı: ustalaştıkça kartların altına dönüşür."
        path="/koleksiyon"
      />
      <main className="container mx-auto max-w-2xl px-4 pb-24">
        <PageHeader title="🗂️ Harf Kartlarım" backTo="/" centered />

        <div className="mb-4">
          <BuddyWithBubble pose={goldCount > 0 ? "celebrate" : "point"} say={buddyLine} size={84} />
        </div>

        {/* Sayaç + ilerleme */}
        <div className="mb-5 rounded-2xl border-2 border-gold/40 bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
              <Crown className="h-4 w-4 text-gold" /> Altın Kartlar
            </span>
            <span className="rounded-full bg-gradient-gold px-3 py-0.5 text-xs font-extrabold text-gold-foreground shadow-soft">
              {goldCount} / {items.length}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-gold transition-all duration-700"
              style={{ width: `${items.length ? (goldCount / items.length) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground">
            Bir harfi en üst seviyeye (⭐⭐⭐⭐) çıkarınca kartı altına dönüşür
          </p>
        </div>

        {/* Kart galerisi — Arapça sağdan sola */}
        <div dir="rtl" className="grid grid-cols-4 gap-2.5">
          {states.map(({ it, seen, gold, level }) => (
            <button
              key={it.id}
              onClick={() => seen && playItem(it)}
              aria-label={it.translit || it.label}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-2xl border-2 transition-bouncy",
                gold
                  ? "border-gold/60 bg-gradient-gold shadow-card hover:-translate-y-1"
                  : seen
                    ? "border-primary/20 bg-card shadow-soft hover:-translate-y-1 hover:border-primary/40"
                    : "border-border/60 bg-muted/40",
              )}
            >
              {/* Altın parıltı süpürmesi */}
              {gold && (
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-md animate-shimmer" />
              )}
              {gold && (
                <Crown aria-hidden className="absolute left-1.5 top-1.5 h-4 w-4 text-gold-foreground/80" />
              )}
              {newGold.has(it.id) && (
                <span className="absolute right-1 top-1 z-10 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-extrabold text-destructive-foreground animate-pop">
                  YENİ
                </span>
              )}

              <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1">
                <span className={cn(
                  "font-arabic text-3xl leading-[1.6]",
                  gold ? "text-gold-foreground" : seen ? "text-emerald-800" : "text-foreground/10",
                )}>
                  {it.emoji}
                </span>
                {seen ? (
                  <>
                    <span className={cn(
                      "truncate text-[10px] font-extrabold",
                      gold ? "text-gold-foreground/90" : "text-muted-foreground",
                    )} dir="ltr">
                      {it.translit}
                    </span>
                    <span className={cn("text-[8px] leading-none", gold ? "opacity-90" : "opacity-70")} aria-hidden>
                      {"⭐".repeat(level)}
                    </span>
                  </>
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] font-bold text-muted-foreground">
          🔊 Açılan bir karta dokun — harfin sesini dinle
        </p>
      </main>
    </div>
  );
};

export default Koleksiyon;
