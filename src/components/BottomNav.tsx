import { NavLink, useLocation } from "react-router-dom";
import { Settings, Gamepad2, TrendingUp, Home, Shield, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";

export function BottomNav() {
  const loc = useLocation();
  const { isAdmin } = useSubscription();

  if (/^\/oyunlar\/[^/]+/.test(loc.pathname)) return null;
  if (loc.pathname === "/giris") return null;

  const items = [
    { to: "/", label: "Ana", icon: Home, show: true },
    { to: "/bahce", label: "Bahçem", icon: Sprout, show: true },
    { to: "/oyunlar", label: "Oyunlar", icon: Gamepad2, show: true },
    { to: "/ilerleme", label: "İlerleme", icon: TrendingUp, show: true },
    { to: "/admin", label: "Admin", icon: Shield, show: isAdmin },
    { to: "/ayarlar", label: "Ayarlar", icon: Settings, show: true },
  ].filter((i) => i.show);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-t-2 border-primary/20 shadow-elegant"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="container mx-auto max-w-2xl grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "group flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-bold transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn(
                  "flex h-7 w-11 items-center justify-center rounded-full transition-colors",
                  isActive && "bg-primary/12",
                )}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
