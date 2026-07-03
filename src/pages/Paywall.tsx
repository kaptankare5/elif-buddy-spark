import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Check, Lock, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackPaywall } from "@/lib/analytics";
import { ParentGate } from "@/components/ParentGate";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isNativePlatform,
  type RcPackages,
} from "@/lib/purchases";

const FEATURES = [
  "Tüm konular açık (İngilizce, Matematik, Doğa, Kavramlar)",
  "Tüm yaşlar için sınırsız içerik",
  "⚡ Süper Öğrenme modu açık",
  "Tüm oyunlar ve seviyeler kilitsiz",
  "Reklamsız, kesintisiz deneyim",
];

type PlanKey = "monthly" | "yearly";

const Paywall = () => {
  const { isPremium, isAdmin, loading, refresh } = useSubscription();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PlanKey>("yearly");
  const [parentOk, setParentOk] = useState(false);
  const [parentConsent, setParentConsent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pkgs, setPkgs] = useState<RcPackages>({ monthly: null, yearly: null, monthlyPrice: null, yearlyPrice: null });
  const [buying, setBuying] = useState(false);
  const native = isNativePlatform();

  useEffect(() => { void trackPaywall("viewed"); }, []);

  useEffect(() => {
    (async () => {
      const p = await getOfferings();
      setPkgs(p);
    })();
  }, []);

  const handleSelect = (id: PlanKey) => {
    setSelected(id);
    void trackPaywall("plan_selected", id);
  };

  const runCheckout = async () => {
    void trackPaywall("checkout_started", selected);
    if (!native) {
      alert("Abonelik satın alma sadece mobil uygulama (Android/iOS) üzerinden yapılabilir.");
      return;
    }
    const pkg = selected === "yearly" ? pkgs.yearly : pkgs.monthly;
    if (!pkg) {
      alert("Abonelik bilgileri yüklenemedi. Lütfen tekrar dene.");
      return;
    }
    setBuying(true);
    const ok = await purchasePackage(pkg);
    setBuying(false);
    if (ok) {
      await refresh();
      navigate("/");
    }
  };

  const handleSubscribe = () => {
    if (!session) { navigate("/giris"); return; }
    if (!parentConsent) { alert("Önce veli beyanını onaylamalısın."); return; }
    if (!parentOk) { setGateOpen(true); return; }
    void runCheckout();
  };

  const handleRestore = async () => {
    if (!native) { alert("Geri yükleme sadece mobil uygulamada çalışır."); return; }
    const ok = await restorePurchases();
    await refresh();
    alert(ok ? "Aboneliğin geri yüklendi ✨" : "Aktif bir abonelik bulunamadı.");
  };

  const monthlyPrice = pkgs.monthlyPrice ?? "₺49,99/ay";
  const yearlyPrice = pkgs.yearlyPrice ?? "₺4.999,99/yıl";

  return (
    <div className="min-h-screen bg-gradient-to-b from-warning/20 via-background to-primary-soft/30">
      <main className="container mx-auto max-w-xl px-4 pb-24">
        <PageHeader title="✨ Premium" backTo="/" centered />

        {loading ? (
          <p className="text-center text-muted-foreground font-bold py-12">Yükleniyor…</p>
        ) : isPremium ? (
          <div className="rounded-3xl bg-card p-6 shadow-card border-4 border-success/40 text-center animate-bounce-in">
            <div className="text-6xl mb-3">{isAdmin ? "🛡️" : "✨"}</div>
            <h1 className="text-2xl font-extrabold text-success mb-2">
              {isAdmin ? "Yönetici Erişimi" : "Endless Mum Pro aktif!"}
            </h1>
            <p className="text-sm font-bold text-muted-foreground mb-4">
              Tüm konular, oyunlar ve Süper Öğrenme modu açık.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-extrabold shadow-soft"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-br from-warning to-primary p-6 text-white text-center shadow-elegant mb-5 animate-bounce-in">
              <Crown className="h-14 w-14 mx-auto mb-2" />
              <h1 className="text-3xl font-extrabold text-shadow-soft mb-1">Endless Mum Pro</h1>
              <p className="text-sm font-bold opacity-90">Tek abonelik — her şey açık.</p>
            </div>

            <div className="rounded-3xl bg-card p-5 shadow-card border-4 border-primary/30 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-warning" />
                <h2 className="font-extrabold text-lg">Pro üyelik neler açar?</h2>
              </div>
              <ul className="space-y-2">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm font-semibold text-foreground/90">
                    <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {(["yearly", "monthly"] as const).map((key) => {
                const isSel = selected === key;
                const price = key === "yearly" ? yearlyPrice : monthlyPrice;
                const title = key === "yearly" ? "Yıllık" : "Aylık";
                const badge = null;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    className={cn(
                      "rounded-3xl p-4 border-4 shadow-card transition-bouncy text-left",
                      isSel ? "bg-card border-primary" : "bg-card border-border/40 hover:border-primary/40",
                    )}
                  >
                    {badge && (
                      <span className="inline-block mb-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                        {badge}
                      </span>
                    )}
                    <div className="font-extrabold text-base">{title}</div>
                    <div className="text-primary font-extrabold text-lg mt-1">{price}</div>
                  </button>
                );
              })}
            </div>

            <label className="flex items-start gap-2 mb-3 text-[11px] text-muted-foreground leading-snug cursor-pointer px-1">
              <input type="checkbox" checked={parentConsent} onChange={(e) => setParentConsent(e.target.checked)} className="mt-1" />
              <span>
                <strong>Veli/yasal vasi sıfatıyla</strong> ödemeyi kendim yapıyorum. Aboneliği
                istediğim zaman iptal edebileceğimi ve 6502 sayılı Tüketici Kanunu kapsamındaki
                haklarımı bildiğimi onaylıyorum.
              </span>
            </label>

            <button
              onClick={handleSubscribe}
              disabled={buying}
              className="w-full rounded-3xl bg-gradient-to-r from-warning to-primary text-white py-5 font-extrabold text-lg shadow-elegant active:scale-95 transition-bouncy flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Crown className="h-6 w-6" /> {buying ? "İşleniyor…" : "Pro'ya Geç"}
            </button>

            <button
              onClick={handleRestore}
              className="mt-3 w-full rounded-2xl border-2 border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted/40"
            >
              Satın almayı geri yükle
            </button>

            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Satın alma Google Play / App Store üzerinden gerçekleşir. Aboneliği istediğin zaman iptal edebilirsin.
            </p>
          </>
        )}

        <ParentGate
          open={gateOpen}
          onPass={() => { setParentOk(true); setGateOpen(false); void runCheckout(); }}
          onCancel={() => setGateOpen(false)}
          title="Ödemeden önce: Veli doğrulaması"
        />

        <div className="mt-8 rounded-2xl bg-muted/40 p-4 text-center">
          <Lock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs font-bold text-muted-foreground">
            Çocuğun gerçek adı sistemde tutulmaz (KVKK). Hesap velinin e-postasıyla açılır.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Paywall;
