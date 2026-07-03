import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Capacitor (Android) donanım geri tuşunu yönetir.
 * - Ana sayfadaysa uygulamadan çıkar.
 * - Başka bir sayfadaysa tarayıcı geçmişinde bir adım geri gider,
 *   geçmiş yoksa ana sayfaya yönlendirir.
 *
 * @capacitor/app yüklü değilse sessizce devre dışı kalır (web modu).
 */
export const CapacitorBackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        // Sadece native (Capacitor) ortamda çalışsın
        const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
        if (!w.Capacitor?.isNativePlatform?.()) return;

        const pkg = ["@capacitor", "app"].join("/");
        const dynImport = new Function("p", "return import(p)") as (p: string) => Promise<any>;
        const mod: any = await dynImport(pkg).catch(() => null);
        const App = mod?.App;
        if (cancelled || !App) return;

        const handle = await App.addListener("backButton", () => {
          const path = window.location.pathname;
          if (path === "/" || path === "") {
            App.exitApp();
            return;
          }
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate("/", { replace: true });
          }
        });

        cleanup = () => {
          try { handle?.remove?.(); } catch { /* ignore */ }
        };
      } catch {
        /* capacitor yok — yoksay */
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [navigate, location.pathname]);

  return null;
};

export default CapacitorBackHandler;
