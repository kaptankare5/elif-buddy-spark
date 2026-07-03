import { useEffect, useState } from "react";
import { playSpeech } from "@/lib/audio";
import { Hand } from "lucide-react";

/**
 * Yazısız "nasıl oynanır" tanıtımı.
 * Çocuğa sesle + animasyonlu parmakla nasıl oynayacağını gösterir.
 * Ekrana dokununca veya 4sn sonra otomatik kapanır.
 */
interface Props {
  /** Otomatik çalınacak sesli anlatım metni */
  voice: string;
  /** Animasyon yönü: yukarı-aşağı sürükle / iki yana dokun / soldan-sağa */
  hint: "drag-y" | "tap-two" | "drag-x";
  /** Görsel emoji (ne yapılacağını gösterir) */
  emoji: string;
  onDone: () => void;
}

export function HowToPlay({ voice, hint, emoji, onDone }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    playSpeech(voice, "tr");
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 250);
    }, 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    setVisible(false);
    setTimeout(onDone, 150);
  };

  if (!visible) return null;

  const handAnim =
    hint === "drag-y"
      ? "animate-[bounce_1.2s_ease-in-out_infinite]"
      : hint === "drag-x"
      ? "animate-[wiggle_1.2s_ease-in-out_infinite]"
      : "animate-pulse";

  return (
    <button
      onClick={skip}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/95 backdrop-blur-sm animate-fade-in"
      aria-label="Başla"
    >
      <div className="relative">
        <div className="text-[140px] leading-none animate-pop">{emoji}</div>
        <div
          className={`absolute -right-6 -bottom-2 text-primary ${handAnim}`}
        >
          <Hand className="h-16 w-16 drop-shadow-lg" strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </button>
  );
}
