// "Mim" — ElifMim'in çocuk maskotu. Buddy.ai'daki robot gibi rehberlik eder
// ama SES OLARAK KONUŞMAZ (robotik TTS yasak — CLAUDE.md): konuşma balonu +
// mevcut gerçek sesler/ding kullanılır. El çizimi SVG; poz destekli, hafif.
//
// Pozlar: idle (nefes alma), wave (selam), celebrate (kutlama, kollar havada +
// yıldızlar), encourage (yanlıştan sonra şefkatli), point (yön gösterme).
// Gözler SMIL ile kendiliğinden kırpar — canlılık hissi, JS yok.
import { cn } from "@/lib/utils";

export type BuddyPose = "idle" | "wave" | "celebrate" | "encourage" | "point";

const SKIN = "#fcd9b8";
const SKIN_DARK = "#eab98d";
const HAIR = "#5a4632";
const VEST = "#1f7a58";
const VEST_DARK = "#175f45";
const SHIRT = "#fdf6e8";
const CAP = "#1f7a58";
const CAP_BAND = "#e8b73c";
const PANTS = "#3f5b70";
const MOUTH = "#a4552f";

export function Buddy({ pose = "idle", size = 96, className, bob = true }: {
  pose?: BuddyPose;
  size?: number;
  className?: string;
  bob?: boolean; // nazik nefes alma animasyonu
}) {
  const celebrating = pose === "celebrate";
  const leftUp = celebrating;
  const rightUp = celebrating || pose === "wave";
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      className={cn(bob && "animate-buddy-bob", className)}
      aria-hidden
      role="img"
    >
      {/* Kutlama yıldızları */}
      {celebrating && (
        <g fill={CAP_BAND}>
          <path d="M18 26l2.6 5.4 5.9.7-4.4 4 1.2 5.8-5.3-3-5.3 3 1.2-5.8-4.4-4 5.9-.7z" opacity="0.95" />
          <path d="M100 18l2 4.2 4.6.6-3.4 3.1.9 4.5-4.1-2.3-4.1 2.3.9-4.5-3.4-3.1 4.6-.6z" opacity="0.9" />
          <circle cx="94" cy="44" r="2.4" opacity="0.8" />
          <circle cx="26" cy="48" r="2" opacity="0.8" />
        </g>
      )}

      {/* Bacaklar + pabuçlar */}
      <g>
        <rect x="46" y="118" width="11" height="20" rx="5" fill={PANTS} />
        <rect x="63" y="118" width="11" height="20" rx="5" fill={PANTS} />
        <ellipse cx="50" cy="141" rx="9" ry="5.5" fill={VEST_DARK} />
        <ellipse cx="70" cy="141" rx="9" ry="5.5" fill={VEST_DARK} />
      </g>

      {/* Gövde: krem gömlek + zümrüt yelek */}
      <path d="M40 88 Q40 78 60 78 Q80 78 80 88 L80 116 Q80 124 60 124 Q40 124 40 116 Z" fill={SHIRT} />
      <path d="M40 88 Q40 78 60 78 L60 124 Q40 124 40 116 Z" fill={VEST} />
      <path d="M80 88 Q80 78 60 78 L60 124 Q80 124 80 116 Z" fill={VEST} opacity="0.92" />
      <path d="M56 80 L60 86 L64 80 L60 78 Z" fill={SHIRT} />
      {/* Yelek düğmeleri */}
      <circle cx="60" cy="96" r="1.8" fill={CAP_BAND} />
      <circle cx="60" cy="106" r="1.8" fill={CAP_BAND} />

      {/* Sol kol */}
      {leftUp ? (
        <g>
          <path d="M44 88 Q30 74 26 58" stroke={VEST} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="25" cy="55" r="6" fill={SKIN} />
        </g>
      ) : pose === "encourage" ? (
        <g>
          <path d="M44 90 Q38 100 46 104" stroke={VEST} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="49" cy="104" r="6" fill={SKIN} />
        </g>
      ) : (
        <g>
          <path d="M42 90 Q36 100 38 110" stroke={VEST} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="38" cy="113" r="6" fill={SKIN} />
        </g>
      )}

      {/* Sağ kol */}
      {rightUp ? (
        <g className={pose === "wave" ? "buddy-arm-wave" : undefined}>
          <path d="M76 88 Q90 74 94 58" stroke={VEST} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="95" cy="55" r="6.5" fill={SKIN} />
        </g>
      ) : pose === "point" ? (
        <g>
          <path d="M78 92 Q92 92 102 90" stroke={VEST} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="104" cy="90" r="6" fill={SKIN} />
        </g>
      ) : (
        <g>
          <path d="M78 90 Q84 100 82 110" stroke={VEST} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="82" cy="113" r="6" fill={SKIN} />
        </g>
      )}

      {/* Baş */}
      <g transform={pose === "encourage" ? "rotate(-4 60 50)" : undefined}>
        <circle cx="60" cy="50" r="29" fill={SKIN} />
        {/* Kulaklar */}
        <circle cx="31" cy="52" r="5" fill={SKIN} />
        <circle cx="89" cy="52" r="5" fill={SKIN} />
        {/* Saç — takkenin altından */}
        <path d="M32 44 Q30 56 36 62 Q33 50 38 42 Z" fill={HAIR} />
        <path d="M88 44 Q90 56 84 62 Q87 50 82 42 Z" fill={HAIR} />
        {/* Takke — zümrüt, altın şeritli */}
        <path d="M31 42 Q34 18 60 18 Q86 18 89 42 Q74 35 60 35 Q46 35 31 42 Z" fill={CAP} />
        <path d="M31 42 Q46 34 60 34 Q74 34 89 42 Q74 38 60 38 Q46 38 31 42 Z" fill={CAP_BAND} />
        <circle cx="60" cy="20" r="2.6" fill={CAP_BAND} />
        {/* Kaşlar */}
        <path d="M44 42 Q49 39.5 53 42" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M67 42 Q71 39.5 76 42" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* Gözler — SMIL kırpma */}
        <ellipse cx="49" cy="50" rx="3.4" ry="4" fill="#2c2a26">
          <animate attributeName="ry" values="4;4;0.4;4;4" keyTimes="0;0.46;0.5;0.54;1" dur="4.6s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="71" cy="50" rx="3.4" ry="4" fill="#2c2a26">
          <animate attributeName="ry" values="4;4;0.4;4;4" keyTimes="0;0.46;0.5;0.54;1" dur="4.6s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="50.3" cy="48.6" r="1.1" fill="#fff" />
        <circle cx="72.3" cy="48.6" r="1.1" fill="#fff" />
        {/* Yanaklar */}
        <circle cx="42" cy="58" r="4.6" fill="#f7a8a0" opacity="0.55" />
        <circle cx="78" cy="58" r="4.6" fill="#f7a8a0" opacity="0.55" />
        {/* Burun */}
        <path d="M58 55 Q60 58 62 55" stroke={SKIN_DARK} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Ağız */}
        {celebrating ? (
          <path d="M51 62 Q60 72 69 62 Q60 66 51 62 Z" fill={MOUTH} />
        ) : pose === "encourage" ? (
          <path d="M53 64 Q60 68 67 64" stroke={MOUTH} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M51 62 Q60 69 69 62" stroke={MOUTH} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        )}
      </g>
    </svg>
  );
}

// Maskot + konuşma balonu. Balon HTML'dir (Türkçe metin düzgün sarar).
export function BuddyWithBubble({ pose = "wave", say, size = 92, className, bubbleClassName }: {
  pose?: BuddyPose;
  say: string;
  size?: number;
  className?: string;
  bubbleClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Buddy pose={pose} size={size} className="shrink-0" />
      <div className={cn(
        "relative rounded-2xl rounded-bl-sm bg-card border-2 border-primary/25 px-4 py-2.5 shadow-card animate-bubble-in",
        bubbleClassName,
      )}>
        <span
          aria-hidden
          className="absolute -left-[7px] bottom-3 h-3 w-3 rotate-45 border-b-2 border-l-2 border-primary/25 bg-card"
        />
        <p className="text-sm font-bold leading-snug text-foreground">{say}</p>
      </div>
    </div>
  );
}
