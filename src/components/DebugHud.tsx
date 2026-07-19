// 🐞 Debug HUD — yalnız TEST MODUNDA (Ayarlar'da 1234) görünür.
//
// Amaç: gizli sistemleri ELLE doğrulamak. Cevap verdikçe canlı güncellenir;
// test/flashcard/oyunlar dahil her sayfada görünür. Gösterdikleri:
// - Uyarlanır zorluk: anlık doğruluk (son 12) + hangi bant (ısınma/normal/
//   zorlanıyor→kolay/uçuyor→zor) → cevaplayınca bandın değiştiğini gör.
// - Son seçilen öğe: seviye + bilet (sıklık × bayatlık) + kaç gün bayat →
//   bayatlık çarpanı + sıklık ağırlığı çalışıyor mu gör.
// - Seri (affedici) + bugünkü öğrenilen/pratik sayısı (veli paneli verisi).
import { useEffect, useState } from "react";
import { useTestUnlock } from "@/lib/testUnlock";
import { getAdaptiveDebug, getLastPickInfo, getTopicSrs, type AdaptiveDebug, type LastPickInfo } from "@/data/srs";
import { getStreak } from "@/lib/streak";
import { getAllTopics } from "@/data/subjects";
import { cn } from "@/lib/utils";

function todayCounts() {
  const d = new Date(); d.setHours(0, 0, 0, 0); const t0 = d.getTime();
  let learned = 0, practiced = 0;
  for (const t of getAllTopics()) {
    if (t.noPractice) continue;
    const srs = getTopicSrs("quiz", t.id);
    for (const it of t.items) {
      const e = srs[it.id];
      if (!e) continue;
      if ((e.lastSeen ?? 0) >= t0) practiced++;
      if ((e.learnedAt ?? 0) >= t0) learned++;
    }
  }
  return { learned, practiced };
}

const LVL_COLOR = ["#94a3b8", "#ef4444", "#f59e0b", "#eab308", "#22c55e"];

export function DebugHud() {
  const [active] = useTestUnlock();
  const [open, setOpen] = useState(true);
  const [adaptive, setAdaptive] = useState<AdaptiveDebug>(() => getAdaptiveDebug());
  const [pick, setPick] = useState<LastPickInfo | null>(() => getLastPickInfo());
  const [streak, setStreak] = useState(() => getStreak());
  const [today, setToday] = useState(() => todayCounts());

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      setAdaptive(getAdaptiveDebug());
      setPick(getLastPickInfo());
      setStreak(getStreak());
      setToday(todayCounts());
    };
    // her cevap srs event'i yayar; ayrıca güvenlik için 800ms poll
    window.addEventListener("elifba-srs-quiz-updated", refresh);
    window.addEventListener("elifba-srs-games-updated", refresh);
    window.addEventListener("elifba-progress-updated", refresh);
    const id = setInterval(refresh, 800);
    return () => {
      window.removeEventListener("elifba-srs-quiz-updated", refresh);
      window.removeEventListener("elifba-srs-games-updated", refresh);
      window.removeEventListener("elifba-progress-updated", refresh);
      clearInterval(id);
    };
  }, [active]);

  if (!active) return null;

  const accPct = adaptive.accuracy === null ? "—" : `%${Math.round(adaptive.accuracy * 100)}`;
  const correctN = adaptive.recent.filter(Boolean).length;
  const bandColor =
    adaptive.band.includes("ZORLAN") ? "#3b82f6" :
    adaptive.band.includes("UÇUYOR") ? "#ef4444" :
    adaptive.band.includes("ISINMA") ? "#a855f7" : "#22c55e";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-2 bottom-20 z-[60] rounded-full bg-black/80 text-white text-[11px] font-extrabold px-3 py-1.5 shadow-lg"
      >🐞 Debug</button>
    );
  }

  return (
    <div className="fixed left-2 bottom-20 z-[60] w-[214px] rounded-xl bg-black/85 text-white shadow-2xl backdrop-blur border border-white/10 text-[11px] leading-tight font-mono">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
        <span className="font-extrabold text-[10px] tracking-wide">🐞 TEST DEBUG</span>
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-sm leading-none">×</button>
      </div>
      <div className="p-2.5 space-y-2">
        {/* Uyarlanır zorluk */}
        <div>
          <div className="text-white/50 text-[9px] uppercase mb-0.5">Uyarlanır Zorluk</div>
          <div className="font-extrabold" style={{ color: bandColor }}>{adaptive.band}</div>
          <div className="text-white/80">Doğruluk: <b>{accPct}</b> ({correctN}/{adaptive.count})</div>
          <div className="flex gap-0.5 mt-1">
            {adaptive.recent.slice(-12).map((c, i) => (
              <span key={i} className={cn("h-2 w-2 rounded-full")} style={{ background: c ? "#22c55e" : "#ef4444" }} />
            ))}
            {adaptive.recent.length === 0 && <span className="text-white/40">henüz cevap yok</span>}
          </div>
        </div>
        {/* Son seçim: sıklık × bayatlık */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="text-white/50 text-[9px] uppercase mb-0.5">Son Seçilen Öğe</div>
          {pick ? (
            <>
              <div className="text-white/80 truncate">{pick.id}</div>
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1 font-extrabold text-black" style={{ background: LVL_COLOR[Math.min(4, pick.level)] }}>
                  {pick.level === 0 ? "YENİ" : `L${pick.level}`}
                </span>
                <span className="text-white/80">bilet <b>{pick.ticket}</b></span>
              </div>
              <div className="text-white/60 text-[10px]">sıklık {pick.weight} × bayat {pick.stale} · {pick.days}g</div>
            </>
          ) : <div className="text-white/40">henüz seçim yok</div>}
        </div>
        {/* Seri + bugün */}
        <div className="border-t border-white/10 pt-1.5 flex justify-between">
          <div><span className="text-white/50">Seri</span> <b>🔥{streak.count}</b></div>
          <div><span className="text-white/50">Bugün</span> <b>{today.learned}</b>y <b>{today.practiced}</b>p</div>
        </div>
      </div>
    </div>
  );
}
