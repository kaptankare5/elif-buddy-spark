import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ParentGate } from "@/components/ParentGate";


export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pending, setPending] = useState<null | "signup" | "google">(null);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const afterAuthSuccess = async () => {
    // Yeni hesap girişinde cihazdaki misafir verisi otomatik aktarılmaz.
    // Aktarmak için Ayarlar > "Cihazdaki misafir ilerlemesini bu hesaba aktar".
    navigate("/");
  };


  const doEmail = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!kvkk) { toast.error("Devam etmek için KVKK aydınlatmasını onaylamalısın."); return; }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Hesabın oluşturuldu!");
        await afterAuthSuccess();
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await afterAuthSuccess();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/sifre-sifirla`,
        });
        if (error) throw error;
        toast.success("Şifre sıfırlama bağlantısı e-postana gönderildi.");
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bir hata oluştu";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      if (!kvkk) { toast.error("Devam etmek için KVKK aydınlatmasını onaylamalısın."); return; }
      setPending("signup"); setGateOpen(true);
    } else {
      void doEmail();
    }
  };

  const doGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }) as { error?: unknown; redirected?: boolean };
      if (result.error) {
        const e = result.error as { message?: string };
        toast.error(`Google ile giriş yapılamadı: ${e?.message || String(result.error)}`);
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      await afterAuthSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google girişi başarısız";
      toast.error(msg);
      setBusy(false);
    }
  };

  const handleGoogle = () => { setPending("google"); setGateOpen(true); };

  const onGatePass = () => {
    setGateOpen(false);
    if (pending === "signup") void doEmail();
    else if (pending === "google") void doGoogle();
    setPending(null);
  };

  const title =
    mode === "signin" ? "Giriş yap" : mode === "signup" ? "Hesap oluştur" : "Şifremi unuttum";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/40 via-background to-primary-soft/40 px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-card">
        <div className="text-center mb-5">
          <div className="text-5xl mb-2 animate-float">🐱</div>
          <h1 className="text-2xl font-extrabold text-primary text-shadow-soft">Endless Mum</h1>
          <p className="text-xs font-semibold text-muted-foreground">MEB Okul Öncesi • Çocuklar için</p>
          <p className="text-sm text-foreground mt-2 font-bold">{title}</p>
        </div>

        {mode !== "forgot" && (
          <>
            <Button onClick={handleGoogle} disabled={busy} variant="outline" className="w-full mb-4">
              Google ile devam et
            </Button>
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">veya</span></div>
            </div>
          </>
        )}

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Veli adı (opsiyonel)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Adın" />
            </div>
          )}
          <div>
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug cursor-pointer">
              <input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} className="mt-1" />
              <span>
                <strong>Veli sıfatıyla</strong> hesabı kendim açıyorum. KVKK aydınlatmasını okudum;
                çocuğa ait hiçbir kimlik bilgisinin (ad, foto, doğum tarihi) saklanmayacağını,
                yalnızca anonim öğrenme verilerinin işleneceğini kabul ediyorum.
              </span>
            </label>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {mode === "signin" ? "Giriş yap" : mode === "signup" ? "Kayıt ol" : "Sıfırlama bağlantısı gönder"}
          </Button>
        </form>

        {mode === "signin" && (
          <p className="text-center text-xs mt-3">
            <button className="text-primary underline" onClick={() => setMode("forgot")}>Şifremi unuttum</button>
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "signin" && (
            <>Hesabın yok mu? <button className="text-primary font-semibold underline" onClick={() => setMode("signup")}>Kayıt ol</button></>
          )}
          {mode === "signup" && (
            <>Zaten üye misin? <button className="text-primary font-semibold underline" onClick={() => setMode("signin")}>Giriş yap</button></>
          )}
          {mode === "forgot" && (
            <button className="text-primary font-semibold underline" onClick={() => setMode("signin")}>← Girişe dön</button>
          )}
        </p>

        <p className="text-center text-xs text-muted-foreground mt-3">
          <Link to="/">Misafir olarak devam et</Link>
        </p>
      </div>

      <ParentGate
        open={gateOpen}
        onPass={onGatePass}
        onCancel={() => { setGateOpen(false); setPending(null); }}
        title="Veli misin?"
      />
    </div>
  );
}
