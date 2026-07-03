import { cn } from "@/lib/utils";

// Renders an emoji or a special "badge" emoji marker.
// Supported markers:
//   "num:11:#f59e0b" -> colored square with the number inside (like keycap)
//   "rect:#f59e0b"   -> colored long rectangle (dikdörtgen)
//   "hex:#a855f7"    -> colored hexagon (altıgen)
// Otherwise renders the string as-is (normal emoji/text).
export function EmojiView({ value, className }: { value?: string; className?: string }) {
  if (!value) return null;

  if (value.startsWith("num:")) {
    const [, n, color] = value.split(":");
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-[0.22em] font-black text-white",
          "aspect-square",
          className,
        )}
        style={{
          backgroundColor: color || "#3b82f6",
          width: "1em",
          height: "1em",
          fontSize: "0.78em",
          lineHeight: 1,
          boxShadow: "inset 0 -0.08em 0 rgba(0,0,0,0.25)",
        }}
      >
        <span style={{ fontSize: "0.55em", lineHeight: 1 }}>{n}</span>
      </span>
    );
  }

  if (value.startsWith("rect:")) {
    const [, color] = value.split(":");
    return (
      <span
        className={cn("inline-block rounded-[0.15em]", className)}
        style={{
          backgroundColor: color || "#f59e0b",
          width: "1em",
          height: "0.5em",
          boxShadow: "inset 0 -0.05em 0 rgba(0,0,0,0.2)",
        }}
        aria-hidden
      />
    );
  }

  if (value.startsWith("hex:")) {
    const [, color] = value.split(":");
    return (
      <svg
        viewBox="0 0 100 100"
        className={cn("inline-block", className)}
        style={{ width: "1em", height: "1em" }}
        aria-hidden
      >
        <polygon
          points="50,4 94,27 94,73 50,96 6,73 6,27"
          fill={color || "#a855f7"}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="3"
        />
      </svg>
    );
  }

  return <span className={className}>{value}</span>;
}
