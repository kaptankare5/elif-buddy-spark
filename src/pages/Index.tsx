import { useState } from "react";
import { Link } from "react-router-dom";

import { SUBJECTS } from "@/data/subjects";
import { Sparkles, Crown, LogIn, UserCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LangToggle } from "@/components/LangToggle";
import { useAge, AGE_LABELS } from "@/lib/age";
import { AgePicker, AgeBadge } from "@/components/AgePicker";
import { topicForAge } from "@/lib/age";
import { useSubscription } from "@/hooks/useSubscription";
import { HonorList } from "@/components/HonorList";

const Index = () => {
  const [age] = useAge();
  const { isPremium } = useSubscription();
  const { session } = useAuth();

  // İlk açılış: yaş seçimi
  if (!age) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-secondary/40 via-background to-primary-soft/40">
        <main className="container relative mx-auto max-w-2xl px-4 pb-16 pt-12">
          <Link
            to={session ? "/ayarlar" : "/giris"}
            className="absolute top-3 right-3 z-10 rounded-full bg-card p-2 shadow-card border-2 border-primary/20"
            aria-label={session ? "Hesap" : "Giriş"}
          >
            {session ? <UserCircle2 className="h-5 w-5 text-primary" /> : <LogIn className="h-5 w-5 text-primary" />}
          </Link>
          <div className="mb-6 text-center animate-bounce-in">
            <div className="text-7xl mb-3 animate-float">🐱</div>
            <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-primary text-shadow-soft">
              Endless Mum
            </h1>
            <p className="text-base font-semibold text-muted-foreground">
              MEB Okul Öncesi Programı
            </p>
          </div>
          <div className="bg-card rounded-3xl p-5 shadow-card border-4 border-primary/20 mb-4 text-center">
            <p className="text-lg font-extrabold text-foreground mb-1">Kaç yaşındasın?</p>
            <p className="text-xs font-semibold text-muted-foreground">Sana uygun konuları hazırlayalım</p>
          </div>
          <AgePicker />
          <footer className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/privacy-policy" className="underline hover:text-primary">Gizlilik Politikası / Privacy Policy</Link>
          </footer>
        </main>
      </div>
    );
  }

  const allVisible = SUBJECTS.map((s) => ({
    ...s,
    topicCount: s.topics.filter((t) => topicForAge(t, age)).length,
  })).filter((s) => s.topicCount > 0 && s.id !== "turkce");

  // İstenen tile sırası: İngilizce → Oyunlar → Matematik → Kavramlar → Doğa
  const order: string[] = ["ingilizce", "oyunlar", "matematik", "kavramlar", "doga"];
  const subjMap = new Map(allVisible.map((s) => [s.id, s]));

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-secondary/40 via-background to-primary-soft/40">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
        <div className="absolute top-10 left-6 text-5xl animate-float">☁️</div>
        <div className="absolute top-32 right-10 text-4xl animate-float" style={{ animationDelay: "1s" }}>⭐</div>
        <div className="absolute bottom-40 left-12 text-4xl animate-float" style={{ animationDelay: "2s" }}>🌈</div>
        <div className="absolute bottom-60 right-8 text-5xl animate-float" style={{ animationDelay: "0.5s" }}>🎈</div>
      </div>

      <main className="container relative mx-auto max-w-2xl px-4 pb-16 pt-6">
        <Link
          to={session ? "/ayarlar" : "/giris"}
          className="absolute top-3 right-3 z-10 rounded-full bg-card p-2 shadow-card border-2 border-primary/20 hover:scale-105 transition-bouncy"
          aria-label={session ? "Hesap" : "Giriş"}
        >
          {session ? <UserCircle2 className="h-5 w-5 text-primary" /> : <LogIn className="h-5 w-5 text-primary" />}
        </Link>
        <div className="mb-3 flex justify-center animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-bold text-primary shadow-card">
            <Sparkles className="h-3.5 w-3.5 text-warning" />
            MEB Anaokulu • {AGE_LABELS[age]}
          </div>
        </div>

        <div className="mb-4 text-center animate-bounce-in">
          <h1 className="mb-1 text-4xl font-extrabold tracking-tight text-primary text-shadow-soft">
            Endless Mum
          </h1>
          <p className="text-sm font-semibold text-muted-foreground">
            5 Alan • Türkiye Yüzyılı Maarif Modeli
          </p>
        </div>

        <AgeBadge />

        {!session && <GuestLoginReminder />}

        <div className="mb-6 flex justify-center">
          <div className="text-7xl animate-float" aria-hidden>🐱</div>
        </div>


        <nav className="grid grid-cols-2 gap-3 mb-6">
          {order.map((tileId, i) => {
            if (tileId === "oyunlar") {
              return (
                <Link
                  key="oyunlar"
                  to="/oyunlar"
                  className="bg-gradient-to-br from-warning to-topic-pink group flex flex-col items-center justify-center gap-2 rounded-3xl p-5 text-center text-white shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant min-h-[130px] animate-bounce-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="text-5xl mb-1 transition-transform group-hover:scale-110">🎮</div>
                  <h2 className="text-base font-extrabold text-shadow-soft">Oyunlar</h2>
                  <p className="text-[11px] font-medium opacity-90 px-1">Eğlenceli oyunlar</p>
                </Link>
              );
            }
            const s = subjMap.get(tileId as never);
            if (!s) return null;
            return (
              <Link
                key={s.id}
                to={`/konu/${s.id}`}
                className={`${s.bgVar} group flex flex-col items-center justify-center gap-2 rounded-3xl p-5 text-center text-white shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant min-h-[130px] animate-bounce-in`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="text-5xl mb-1 transition-transform group-hover:scale-110">{s.emoji}</div>
                <h2 className="text-base font-extrabold text-shadow-soft">{s.title}</h2>
                <p className="text-[11px] font-medium opacity-90 px-1">{s.topicCount} konu</p>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-3">
          <Link
            to="/ilerleme"
            className="w-full flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-info to-primary p-5 text-white shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant"
          >
            <span className="text-2xl">📈</span>
            <span className="text-lg font-extrabold text-shadow-soft">İlerleme</span>
          </Link>

          {!isPremium && (
            <Link
              to="/abonelik"
              className="w-full flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-warning to-primary p-5 text-white shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant animate-pulse"
            >
              <Crown className="h-6 w-6" />
              <span className="text-lg font-extrabold text-shadow-soft">Premium'a Geç</span>
            </Link>
          )}
          {isPremium && (
            <Link
              to="/abonelik"
              className="w-full flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-success to-primary p-5 text-white shadow-card"
            >
              <Crown className="h-6 w-6" />
              <span className="text-lg font-extrabold text-shadow-soft">👑 Premium Aktif</span>
            </Link>
          )}
        </div>

        <HonorList />

        <p className="mt-6 text-center text-xs font-semibold text-muted-foreground">
          {AGE_LABELS[age]} • {allVisible.reduce((a, s) => a + s.topicCount, 0)} Konu • Eğlenceli Oyunlar
        </p>

        <footer className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="underline hover:text-primary">Gizlilik Politikası</Link>
          <span className="mx-2">•</span>
          <Link to="/privacy-policy" className="underline hover:text-primary">Privacy Policy</Link>
        </footer>
      </main>
    </div>
  );
};

function GuestLoginReminder() {
  const KEY = "endlessmum:guest-reminder-hide-until";
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return !!(v && Number(v) > Date.now());
    } catch { return false; }
  });

  if (hidden) return null;
  return (
    <div className="mb-4 rounded-2xl bg-card border-2 border-primary/30 p-3 shadow-card flex items-start gap-3 animate-fade-in">
      <div className="text-2xl">👋</div>
      <div className="flex-1">
        <p className="text-sm font-extrabold text-foreground">Veli misin? Giriş yap.</p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          İlerleme şu an sadece bu cihazda. Hesabınla tüm cihazlarda güvenle saklansın.
        </p>
        <div className="mt-2 flex gap-2">
          <Link to="/giris" className="rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-extrabold">
            Giriş yap
          </Link>
          <button
            onClick={() => {
              try { localStorage.setItem(KEY, String(Date.now() + 3 * 24 * 3600 * 1000)); } catch { /* */ }
              setHidden(true);
            }}
            className="rounded-xl bg-muted text-muted-foreground px-3 py-1.5 text-xs font-bold"
          >
            Sonra
          </button>
        </div>
      </div>
    </div>
  );
}

export default Index;
