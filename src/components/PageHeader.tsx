import { forwardRef } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title?: string;
  backTo?: string;
  onReset?: () => void;
  centered?: boolean;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, backTo = "/", onReset, centered }, ref) => {
    const navigate = useNavigate();
    return (
      <header
        ref={ref}
        className="sticky top-0 z-50 flex items-center justify-between gap-2 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          aria-label="Ana Sayfa"
          className="group flex items-center gap-1.5 h-11 pl-2 pr-4 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft border-2 border-primary-foreground/40 active:scale-95 transition-bouncy"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/25">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span className="text-xs font-extrabold tracking-wide">Ana Sayfa</span>
        </button>

        {title && (
          <h1
            className={
              (centered
                ? "absolute left-1/2 -translate-x-1/2 "
                : "") +
              "px-4 h-10 inline-flex items-center rounded-full bg-card/90 backdrop-blur text-sm font-extrabold text-foreground shadow-card border-2 border-primary/20"
            }
          >
            {title}
          </h1>
        )}

        {onReset ? (
          <button
            onClick={onReset}
            aria-label="Sıfırla"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-card border-2 border-primary/30 active:scale-90 transition-bouncy hover:bg-primary-soft"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>
    );
  }
);

PageHeader.displayName = "PageHeader";
