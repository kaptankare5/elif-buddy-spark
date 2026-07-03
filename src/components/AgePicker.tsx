import { useAge, AGE_LABELS, AGE_DESCRIPTIONS } from "@/lib/age";
import type { Age } from "@/data/types";
import { ALL_AGES } from "@/data/types";
import { cn } from "@/lib/utils";

const ICONS: Record<Age, string> = {
  2: "🍼", 3: "🧸", 4: "🎨", 5: "🔤", 6: "📚", 7: "✏️",
};

export function AgePicker({ onPick }: { onPick?: (a: Age) => void }) {
  const [, setAge] = useAge();
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {ALL_AGES.map((a, i) => (
        <button
          key={a}
          onClick={() => { setAge(a); onPick?.(a); }}
          className={cn(
            "group flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center shadow-card border-4 border-primary/20 transition-bouncy hover:-translate-y-1 hover:shadow-elegant animate-bounce-in"
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="text-3xl">{ICONS[a]}</div>
          <div className="text-lg font-extrabold text-primary leading-none">{AGE_LABELS[a]}</div>
          <div className="text-[10px] font-semibold text-muted-foreground leading-tight">{AGE_DESCRIPTIONS[a]}</div>
        </button>
      ))}
    </div>
  );
}

export function AgeBadge() {
  const [age, setAge] = useAge();
  if (!age) return null;
  return (
    <div className="mb-3 flex items-center justify-center gap-1 rounded-full bg-card px-2 py-1 shadow-soft border-2 border-primary/20 w-fit mx-auto flex-wrap">
      <span className="text-xs font-bold text-muted-foreground px-2">Yaş:</span>
      {ALL_AGES.map((a) => (
        <button
          key={a}
          onClick={() => setAge(a)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-extrabold transition-bouncy",
            a === age ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
