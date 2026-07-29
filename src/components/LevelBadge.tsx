// Seviye rozeti — yalnız TEST MODUNDA (1234) görünür. Kartın köşesinde o
// öğenin SRS seviyesini (YENİ / L1-L4) gösterir → seviye sistemini ve
// uyarlanır zorluğu elle doğrulamak için. Kapalıyken hiçbir şey render etmez.
import { useTestUnlock } from "@/lib/testUnlock";
import { getTopicSrs } from "@/data/srs";
import { findTopicOfItem } from "@/data/subjects";
import { cn } from "@/lib/utils";

const LVL_COLOR = ["#94a3b8", "#ef4444", "#f59e0b", "#eab308", "#22c55e"];

export function LevelBadge({ itemId, topicId, className }: { itemId: string; topicId?: string; className?: string }) {
  const [active] = useTestUnlock();
  if (!active) return null;
  const tid = topicId ?? findTopicOfItem(itemId)?.topicId;
  if (!tid) return null;
  const e = getTopicSrs("quiz", tid)[itemId];
  const lvl = e?.level ?? 1;
  const seen = (e?.seen ?? 0) > 0;
  return (
    <span
      className={cn("pointer-events-none z-30 rounded px-1 text-[9px] font-extrabold text-black leading-tight shadow-sm", className)}
      style={{ background: LVL_COLOR[Math.min(4, seen ? lvl : 0)] }}
    >
      {seen ? `L${lvl}` : "YENİ"}
    </span>
  );
}
