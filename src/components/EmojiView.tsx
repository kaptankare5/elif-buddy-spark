import { cn } from "@/lib/utils";

// Renders an emoji or a special "badge" emoji marker.
// Supported markers:
//   "num:11:#f59e0b" -> colored square with the number inside (like keycap)
//   "rect:#f59e0b"   -> colored long rectangle (dikdörtgen)
//   "hex:#a855f7"    -> colored hexagon (altıgen)
// Otherwise renders the string as-is (normal emoji/text).
//
// ARAPÇA: değer Arap harfi içeriyorsa konu sayfalarıyla AYNI hat (font-arabic
// = Amiri Quran) + geniş satır kutusu (leading) uygulanır. Varsayılan dar
// leading'de ع/ح/ج gibi derin çanaklı harflerin altı kırpılıyordu ("harf tam
// gözükmüyor"); leading-[1.6] tüm glifi boyatır. Boyut/renk ebeveynden miras.
// \u kod noktası kaçışlarıyla: Arapça (U+0600-06FF) + Arapça Ek (U+0750-077F)
// + Arapça Genişletilmiş-A (U+08A0-08FF) + Sunum Biçimleri A (U+FB50-FDFF) +
// Sunum Biçimleri B (U+FE70-FEFC, BOM U+FEFF HARİÇ). Literal glif aralığı
// eslint "irregular whitespace" hatası veriyordu (U+FEFF BOM aralığa
// giriyordu) — kod noktası kaçışı hem güvenli hem net.
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/;

/**
 * `fit`: değeri SABİT BİR KUTUYA sığdırmak gerektiğinde (oyun taşları,
 * tepsi gözleri). Havuzda tek harfler de var, harekeli/med'li diziler de
 * (كَانَ gibi 4 glif) — hepsine aynı font boyutu verilince uzun olanlar
 * kutunun dışına taşıyordu. Ölçek ebeveynin font boyutuna GÖRECELİdir
 * (em), böylece kutu büyüdükçe harf de büyür.
 */
// Ölçekler TAHMİN DEĞİL: Amiri Quran'da canvas measureText ile gerçek mürekkep
// oranları ölçüldü (mürekkep yüksekliği ÷ font boyutu):
//   tek glif 0.70–0.96 (en derin ع), harekeli/şeddeli diziler 1.10–1.52 (رَبِّ).
// Genişlikte: tek glif ≤0.74, 5 glif ≤1.24 em.
// Buradaki k'lar, mürekkep kutunun ~%70'ini dolduracak biçimde seçildi:
// harf kutuyu dolduracak kadar büyük, ama kuyruğu kesilmeyecek kadar küçük.
function fitScale(value: string): number {
  const n = [...value].length;
  if (n <= 1) return 1.25;
  if (n === 2) return 0.95;
  if (n === 3) return 0.9;
  if (n <= 5) return 0.82;
  return 0.68;
}

export function EmojiView({ value, className, fit }: { value?: string; className?: string; fit?: boolean }) {
  if (!value) return null;

  if (ARABIC_RE.test(value)) {
    return (
      <span
        dir="rtl"
        className={cn(
          "font-arabic inline-block",
          // fit modunda leading ölçülen en derin mürekkebi (1.52) rahat
          // kapsar; kutuda `overflow-hidden` KULLANMA — ح ج ع gibi harflerin
          // kuyruğu kesilip "harfin yarısı görünmüyor" hâline geliyor.
          fit ? "leading-[1.7] max-w-full whitespace-nowrap" : "leading-[1.6]",
          className,
        )}
        style={fit ? { fontSize: `${fitScale(value)}em` } : undefined}
      >
        {value}
      </span>
    );
  }

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
