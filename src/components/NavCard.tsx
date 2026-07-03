import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string; // e.g. "bg-topic-green"
  showChevron?: boolean;
}

export function NavCard({ to, title, description, icon, iconBg, showChevron = true }: NavCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card",
        "transition-bouncy hover:-translate-y-0.5 hover:shadow-elegant",
        "border border-border/60"
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl text-primary-foreground shadow-soft",
          iconBg
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-bold text-foreground">{title}</h3>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
      {showChevron && (
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}
