import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { RouteHead } from "@/components/RouteHead";
import { BuddyWithBubble } from "@/components/Buddy";
import { Home } from "lucide-react";

/**
 * ⚠️ METİN TÜRKÇE OLMALI. Sayfa şablondan geldiği gibi kalmıştı: başlık ve
 * açıklama Türkçeydi ama EKRANDAKİ yazı İngilizceydi ("Oops! Page not found",
 * "Return to Home"). Bu uygulamanın kullanıcısı 5-8 yaşında bir çocuk ve
 * ebeveyni; eski bir yer imine ya da kaldırılmış bir oyunun adresine
 * (örneğin silinen İki Yol Koşusu) tıklayınca gördükleri tek ekran burası.
 * Çıkış yolu da tek bir alt çizgili bağlantıydı — çocuk dokunma hedefi
 * olarak zor bulur.
 */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Geliştirici günlüğü: hangi adres istendi? (Konsolda kalır, ekranda değil.)
    console.warn("404 — bulunamayan adres:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/60 to-background px-4">
      <RouteHead
        title="Sayfa bulunamadı (404) — ElifMim"
        description="Aradığın sayfa bulunamadı. Ana sayfaya dönerek Elifbâ öğrenmeye devam edebilirsin."
        noindex
      />
      <div className="w-full max-w-sm text-center">
        <BuddyWithBubble
          pose="wave"
          size={96}
          say="Burada bir şey yok! Hadi ana sayfaya dönelim. 🏠"
        />
        <div className="mt-4 text-5xl font-extrabold text-primary">404</div>
        <p className="mt-1 text-base font-bold text-muted-foreground">
          Aradığın sayfayı bulamadım
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-7 py-3.5 font-extrabold text-primary-foreground shadow-card transition-bouncy hover:-translate-y-0.5 active:scale-95"
        >
          <Home className="h-5 w-5" /> Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
