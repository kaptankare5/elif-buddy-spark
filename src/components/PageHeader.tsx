import { forwardRef } from "react";
import { ArrowLeft, RotateCcw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentSwitcher } from "@/components/StudentSwitcher";

interface PageHeaderProps {
  title?: string;
  backTo?: string;
  onBack?: () => void;
  onReset?: () => void;
  centered?: boolean;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, backTo = "/", onBack, onReset, centered }, ref) => {
    const navigate = useNavigate();
    // Geri butonu etiketi hedefe göre — oyunlarda "Ana Sayfa" yazıp /oyunlar'a
    // gitmesi kafa karıştırıyordu. Home'a gidiyorsa "Ana Sayfa", değilse "Geri".
    const isHomeBack = backTo === "/";
    const backLabel = isHomeBack ? "Ana Sayfa" : "Geri";
    return (
      <header
        ref={ref}
        className="sticky top-0 z-50 grid grid-cols-[auto_1fr_auto] items-center gap-2 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => (onBack ? onBack() : backTo ? navigate(backTo) : navigate(-1))}
          aria-label={backLabel}
          className="group flex shrink-0 items-center gap-1.5 h-11 pl-2 pr-4 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft border-2 border-primary-foreground/40 active:scale-95 transition-bouncy"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/25">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span className="text-xs font-extrabold tracking-wide">{backLabel}</span>
        </button>

        {title ? (
          <h1
            className={
              (centered ? "justify-self-center " : "justify-self-start ") +
              "min-w-0 max-w-full truncate px-4 h-10 inline-flex items-center rounded-full bg-card/90 backdrop-blur text-sm font-extrabold text-foreground shadow-card border-2 border-primary/20"
            }
          >
            <span className="truncate">{title}</span>
          </h1>
        ) : (
          <span />
        )}

        <div className="flex shrink-0 items-center gap-2 justify-self-end">
          {/* Hoca modu: öğrenci profili değiştirici (öğrenci yoksa görünmez) */}
          <StudentSwitcher />
          {onReset && (
            <button
              onClick={onReset}
              aria-label="Sıfırla"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-card border-2 border-primary/30 active:scale-90 transition-bouncy hover:bg-primary-soft"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
          {/* Her ekrandan tek dokunuşla Ana Sayfa — mobilde belirgin */}
          {!isHomeBack && (
            <button
              onClick={() => navigate("/")}
              aria-label="Ana Sayfa"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-warning to-topic-pink text-white shadow-card border-2 border-white/50 active:scale-90 transition-bouncy"
            >
              <Home className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>
    );
  }
);

PageHeader.displayName = "PageHeader";
