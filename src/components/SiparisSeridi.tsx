import { EmojiView } from "@/components/EmojiView";
import { playItem } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import type { Siparis } from "@/lib/siparis";

/**
 * Sipariş şeridi — "şu harften 2 tane".
 *
 * ⚠️ SESLİ VE DOKUNULABİLİR: 6 yaşındaki çocuk yazı okumuyor. Harf hem
 * gösterilir hem şeride dokununca sesi çalar; ikisi birlikte olmazsa sipariş
 * sadece bir şekil avına dönüşür — çözmeye çalıştığımız sorunun ta kendisi.
 */
export function SiparisSeridi({ siparis, parla }: { siparis: Siparis | null; parla?: boolean }) {
  if (!siparis) return null;
  return (
    <button
      onClick={() => void playItem(siparis.hedef)}
      className={cn(
        "mb-3 flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-4 py-2.5 shadow-card transition-bouncy active:scale-95",
        parla ? "border-success bg-success/15 animate-juice-pop" : "border-warning/40 bg-card",
      )}
      aria-label="Siparişi dinle"
    >
      <Volume2 className="h-5 w-5 shrink-0 text-warning" />
      <span className="text-sm font-extrabold text-muted-foreground">Bul:</span>
      <span className="font-arabic text-3xl leading-[1.6] text-foreground">
        <EmojiView value={siparis.hedef.emoji ?? ""} />
      </span>
      <span className="flex gap-1" aria-label={`${siparis.kalan} kaldı`}>
        {Array.from({ length: siparis.kalan }).map((_, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-warning" />
        ))}
      </span>
    </button>
  );
}
