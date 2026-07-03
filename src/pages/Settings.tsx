import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/settings";
import { playFeedback } from "@/lib/audio";
import { Volume2, Vibrate, GraduationCap, Shield, Trash2, Lock, Smartphone } from "lucide-react";
import { useGameMode } from "@/lib/gameMode";
import { cn } from "@/lib/utils";
import { consentGiven, setConsent, deleteMyAnalytics, updateMyProfile } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { AccountCard } from "@/components/AccountCard";
import { clearLocalProgress, hydrateSrsFromCloud } from "@/data/srs";
import { ConfirmDestructive } from "@/components/ConfirmDestructive";
import { toast } from "sonner";


const Settings = () => {
  const [s, set] = useSettings();
  const [mode, setMode] = useGameMode();
  const { session } = useAuth();
  const { hasSuperMode } = useSubscription();
  const [consent, setConsentState] = useState(consentGiven());
  const [confirmCloudDel, setConfirmCloudDel] = useState(false);
  const [confirmDeviceDel, setConfirmDeviceDel] = useState(false);
  const [deviceScope, setDeviceScope] = useState<"active" | "guest" | "all">(session ? "active" : "guest");

  useEffect(() => {
    const fn = () => setConsentState(consentGiven());
    window.addEventListener("miniakil:consent-changed", fn);
    return () => window.removeEventListener("miniakil:consent-changed", fn);
  }, []);
  useEffect(() => {
    if (!hasSuperMode && mode === "super") setMode("normal");
  }, [hasSuperMode, mode, setMode]);
  const toggleConsent = async (v: boolean) => {
    setConsent(v); setConsentState(v);
    if (session) await updateMyProfile({ analytics_consent: v });
  };

  const doCloudDelete = async () => {
    const res = await deleteMyAnalytics();
    if (res.ok) toast.success("Analitik verilerin silindi. Öğrenme ilerlemen korunuyor.");
    else toast.error("Silme başarısız: " + (res.error ?? "bilinmeyen hata"));
  };

  const doDeviceDelete = async () => {
    clearLocalProgress(deviceScope);
    if (session?.user.id) await hydrateSrsFromCloud(session.user.id).catch(() => {});
    toast.success("Cihazdaki önbellek silindi; hesap verisi yeniden yüklendi.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="⚙️ Ayarlar" backTo="/" centered />

        <AccountCard />

        <div className="space-y-3">
          <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <Volume2 className="h-7 w-7 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-foreground">Ses Efektleri</h3>
              <p className="text-xs text-muted-foreground">Doğru/yanlış kısa sesler</p>
            </div>
            <Switch
              checked={s.sound}
              onCheckedChange={(v) => { set({ sound: v }); if (v) setTimeout(() => playFeedback(true), 100); }}
            />
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <Vibrate className="h-7 w-7 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-foreground">Titreşim</h3>
              <p className="text-xs text-muted-foreground">Yanlış cevapta telefon titrer</p>
            </div>
            <Switch
              checked={s.vibrate}
              onCheckedChange={(v) => { set({ vibrate: v }); if (v) setTimeout(() => playFeedback(false), 100); }}
            />
          </div>

          {/* Oyun Modu */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <div className="flex items-center gap-3 mb-3">
              <GraduationCap className="h-7 w-7 text-primary" />
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-foreground">Oyun Modu</h3>
                <p className="text-xs text-muted-foreground">Öğrenme zorluğunu seç</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("normal")}
                className={cn(
                  "rounded-2xl p-3 border-2 font-extrabold text-sm text-left transition-bouncy",
                  mode === "normal"
                    ? "bg-primary text-primary-foreground border-primary shadow-soft"
                    : "bg-muted/40 border-border text-foreground"
                )}
              >
                🎮 Normal
                <div className="text-[10px] font-bold opacity-80 mt-1">Arada test sorusu</div>
              </button>
              <button
                onClick={() => { if (hasSuperMode) setMode("super"); }}
                disabled={!hasSuperMode}
                className={cn(
                  "rounded-2xl p-3 border-2 font-extrabold text-sm text-left transition-bouncy relative",
                  mode === "super" && hasSuperMode
                    ? "bg-warning text-warning-foreground border-warning shadow-soft"
                    : "bg-muted/40 border-border text-foreground",
                  !hasSuperMode && "opacity-70"
                )}
              >
                ⚡ Süper Öğrenme
                <div className="text-[10px] font-bold opacity-80 mt-1">Her zaman test, hep ilerleme</div>
                {!hasSuperMode && (
                  <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 rounded-full bg-warning/90 text-warning-foreground px-1.5 py-0.5 text-[9px] font-extrabold">
                    <Lock className="h-2.5 w-2.5" /> 249₺
                  </span>
                )}
              </button>
            </div>
            {!hasSuperMode && (
              <Link
                to="/abonelik"
                className="mt-2 block text-center text-[11px] font-extrabold text-warning underline"
              >
                Süper Öğrenme'yi açmak için 249₺ paketine geç →
              </Link>
            )}
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              Süper modda sadece şu oyunlar gösterilir: Yılan, Uzay, Balon, Kutu Boşalt, Hızlı Quiz. İpucu halkası yalnız seviye 1'de görünür.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => playFeedback(true)}
            className="rounded-2xl bg-success/15 border-2 border-success/40 p-4 font-extrabold text-success shadow-soft active:scale-95"
          >
            ✓ Doğru sesi
          </button>
          <button
            onClick={() => playFeedback(false)}
            className="rounded-2xl bg-destructive/15 border-2 border-destructive/40 p-4 font-extrabold text-destructive shadow-soft active:scale-95"
          >
            ✗ Yanlış sesi
          </button>
        </div>




        {/* Gizlilik */}
        <div className="mt-6 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-extrabold">Gizlilik & Veri</h3>
              <p className="text-xs text-muted-foreground">Anonim kullanım verisi toplama</p>
            </div>
            <Switch checked={consent} onCheckedChange={toggleConsent} />
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
            Kimlik bilgisi (ad, foto, doğum tarihi) saklanmaz. Sadece hangi oyun ne kadar
            oynandı ve hangi ekranlar kullanıldı gibi anonim veriler — uygulamayı geliştirmek için.
          </p>
          {session && (
            <button
              onClick={() => setConfirmCloudDel(true)}
              className="w-full rounded-xl bg-destructive/10 text-destructive border-2 border-destructive/30 py-2 font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Kullanım verilerimi sil
            </button>
          )}
        </div>

        {/* Cihaz verileri */}
        <div className="mt-6 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <h3 className="text-base font-extrabold flex-1">📱 Cihaz verileri</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
            Bu cihazda tutulan ilerleme önbelleğini siler. <strong>Buluttaki verin etkilenmez</strong>;
            tekrar giriş yaptığında hesabından geri yüklenir.
          </p>
          {session && (
            <div className="mb-3 space-y-1">
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="dscope" checked={deviceScope === "active"} onChange={() => setDeviceScope("active")} />
                Yalnız bu hesabın cihaz önbelleği
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="dscope" checked={deviceScope === "guest"} onChange={() => setDeviceScope("guest")} />
                Yalnız misafir ilerlemesi
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="dscope" checked={deviceScope === "all"} onChange={() => setDeviceScope("all")} />
                Hepsi (bu hesap + misafir)
              </label>
            </div>
          )}
          <button
            onClick={() => setConfirmDeviceDel(true)}
            className="w-full rounded-xl bg-destructive/10 text-destructive border-2 border-destructive/30 py-2 font-extrabold text-sm flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> Cihazdaki ilerlememi sil
          </button>
        </div>

        <ConfirmDestructive
          open={confirmCloudDel}
          onOpenChange={setConfirmCloudDel}
          title="Kullanım verilerin silinsin mi?"
          description="Oyun oturumları ve ekran kullanım kayıtları silinir. Öğrenme ilerlemen ve seviye kayıtların korunur."
          finalDescription="Bu işlem geri alınamaz; ancak tekrar sistemi ve ilerleme seviyeleri silinmez."
          confirmLabel="Evet, sil"
          onConfirm={doCloudDelete}
        />

        <ConfirmDestructive
          open={confirmDeviceDel}
          onOpenChange={setConfirmDeviceDel}
          title="Cihazdaki ilerleme silinsin mi?"
          description={
            session
              ? "Yalnızca bu cihazdaki önbellek silinir. Buluttaki ilerlemen yerinde kalır ve tekrar giriş yapınca geri yüklenir."
              : "Misafir ilerlemen bu cihazdan silinir. Hesabın olmadığı için geri yüklenemez."
          }
          finalDescription="Bu işlem geri alınamaz."
          confirmLabel="Evet, sil"
          onConfirm={doDeviceDelete}
        />
      </main>
    </div>

  );
};

export default Settings;
