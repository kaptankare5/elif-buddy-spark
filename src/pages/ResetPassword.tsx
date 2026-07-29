import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// /sifre-sifirla — kullanıcı şifre sıfırlama e-postasındaki bağlantıyla buraya gelir.
// Supabase, hash'teki recovery token'ı otomatik işleyip onAuthStateChange("PASSWORD_RECOVERY")
// yayar; ardından updateUser({ password }) ile yeni şifre belirlenir.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Hash'te recovery token varsa zaten oturum kurulur; yine kontrol et:
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalı.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Şifren güncellendi.");
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Şifre güncellenemedi";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/40 via-background to-primary-soft/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-card">
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🔒</div>
          <h1 className="text-xl font-extrabold text-primary">Yeni şifre belirle</h1>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">
            Sıfırlama bağlantısı kontrol ediliyor… Bağlantıya e-postadan tıkladığından emin ol.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="pw">Yeni şifre</Label>
              <Input id="pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} className="w-full">Güncelle</Button>
          </form>
        )}
      </div>
    </div>
  );
}
