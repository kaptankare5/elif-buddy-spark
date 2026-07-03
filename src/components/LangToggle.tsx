import { useEffect, useState } from "react";
import { getGameLang, setGameLang } from "@/pages/games/_shared";
import type { Lang } from "@/data/types";
import { cn } from "@/lib/utils";

export function LangToggle({ className }: { className?: string }) {
  const [lang, setLang] = useState<Lang>(() => getGameLang());

  useEffect(() => {
    const onChange = () => setLang(getGameLang());
    window.addEventListener("games-lang-change", onChange);
    return () => window.removeEventListener("games-lang-change", onChange);
  }, []);

  const choose = (l: Lang) => { setGameLang(l); setLang(l); };

  return (
    <div className={cn("inline-flex rounded-full bg-card p-1 shadow-soft border-2 border-primary/30", className)}>
      <button
        onClick={() => choose("tr")}
        className={cn(
          "px-4 py-1.5 text-sm font-extrabold rounded-full transition-bouncy",
          lang === "tr" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
        )}
      >🇹🇷 Türkçe</button>
      <button
        onClick={() => choose("en")}
        className={cn(
          "px-4 py-1.5 text-sm font-extrabold rounded-full transition-bouncy",
          lang === "en" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
        )}
      >🇬🇧 English</button>
    </div>
  );
}
