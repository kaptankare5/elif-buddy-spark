// Basit ebeveyn kapısı: küçük çocukların geçemeyeceği aritmetik soru.
import { useMemo, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

interface Props {
  open: boolean;
  onPass: () => void;
  onCancel: () => void;
  title?: string;
}

export function ParentGate({ open, onPass, onCancel, title = "Ebeveyn Doğrulaması" }: Props) {
  const { a, b } = useMemo(() => ({
    a: 4 + Math.floor(Math.random() * 6),
    b: 4 + Math.floor(Math.random() * 6),
  }), [open]);
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);

  if (!open) return null;
  const submit = () => {
    if (parseInt(v, 10) === a + b) { setV(""); setErr(false); onPass(); }
    else { setErr(true); }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card border-4 border-primary/30 shadow-elegant p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-extrabold flex-1">{title}</h2>
          <button onClick={onCancel} className="p-1 rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Yalnızca yetişkinler devam edebilir. Aşağıdaki işlemi yapın.
        </p>
        <div className="text-center text-3xl font-extrabold mb-3">{a} + {b} = ?</div>
        <input
          inputMode="numeric"
          autoFocus
          value={v}
          onChange={(e) => { setV(e.target.value); setErr(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full rounded-xl border-2 border-border bg-background p-3 text-center text-xl font-bold"
          placeholder="cevap"
        />
        {err && <div className="text-xs text-destructive mt-2 text-center font-bold">Yanlış cevap, tekrar deneyin.</div>}
        <button
          onClick={submit}
          className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground py-3 font-extrabold"
        >
          Doğrula
        </button>
      </div>
    </div>
  );
}
