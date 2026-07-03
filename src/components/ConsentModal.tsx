import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { setConsent, updateMyProfile, getCachedProfile, PROFILE_CACHE_KEY } from "@/lib/analytics";
import { setAge, ageBandFor } from "@/lib/age";
import type { Age } from "@/data/types";
import { ALL_AGES } from "@/data/types";
import { Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConsentModal() {
  const { session, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [age, setAgeLocal] = useState<Age>(5);
  const [gender, setGender] = useState<"k" | "e" | "x">("x");
  const [accept, setAccept] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    // Yerel cache varsa bir daha sorma.
    if (getCachedProfile()?.consent_at) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("age_band, consent_at, gender")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.consent_at) {
        try {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
            age_band: data.age_band ?? undefined,
            gender: data.gender ?? undefined,
            consent_at: data.consent_at,
          }));
        } catch { /* ignore */ }
        return;
      }
      setOpen(true);
    })();
  }, [session, loading]);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    setConsent(accept);
    setAge(age);
    await updateMyProfile({ age_band: ageBandFor(age), gender, analytics_consent: accept });
    setSaving(false);
    setOpen(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-background/80 backdrop-blur flex items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
    >
      <div className="w-full max-w-md rounded-3xl bg-card border-4 border-primary/30 shadow-elegant p-6 max-h-[90vh] overflow-y-auto" style={{ pointerEvents: "auto" }}>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-extrabold">Hoş geldin!</h2>
          <button onClick={() => setOpen(false)} className="ml-auto p-1 rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-snug">
          Veli sıfatıyla, çocuğunuza en uygun içeriği sunabilmemiz için birkaç bilgi.
          Çocuğun adı, fotoğrafı veya doğum tarihi hiçbir zaman saklanmaz.
        </p>

        <Label>Çocuğun yaşı</Label>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {ALL_AGES.map((a) => (
            <Choice key={a} active={age === a} onClick={() => setAgeLocal(a)} label={`${a} yaş`} />
          ))}
        </div>

        <Label>Cinsiyet (opsiyonel)</Label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Choice active={gender === "k"} onClick={() => setGender("k")} label="👧 Kız" />
          <Choice active={gender === "e"} onClick={() => setGender("e")} label="👦 Erkek" />
          <Choice active={gender === "x"} onClick={() => setGender("x")} label="Belirtme" />
        </div>

        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span className="text-xs text-muted-foreground leading-snug">
            Uygulamayı geliştirmek için <strong>anonim</strong> kullanım verilerinin (hangi oyun
            oynandı, hangi harf öğrenildi, süre) işlenmesine veli olarak <strong>açık rıza</strong>
            veriyorum. İstediğim zaman Ayarlar'dan kapatabilir ve verilerimi silebilirim. (KVKK)
          </span>
        </label>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3 font-extrabold disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Devam et"}
        </button>
      </div>
    </div>,
    document.body
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold text-muted-foreground mb-1.5">{children}</div>;
}
function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl p-2 border-2 font-bold text-sm transition-bouncy",
        active ? "bg-primary/10 border-primary text-primary" : "bg-muted/40 border-border text-foreground",
      )}
    >
      {label}
    </button>
  );
}
