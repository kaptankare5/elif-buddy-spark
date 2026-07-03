import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  // 2. adım metni — daha sert uyarı
  finalTitle?: string;
  finalDescription?: string;
  countdownSeconds?: number;
  onConfirm: () => void | Promise<void>;
}

// İki adımlı + geri sayımlı yıkıcı onay diyaloğu.
export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Sil",
  finalTitle = "Gerçekten silinsin mi?",
  finalDescription = "Bu işlem geri alınamaz.",
  countdownSeconds = 3,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setStep(1); setRemaining(countdownSeconds); setBusy(false); return; }
  }, [open, countdownSeconds]);

  useEffect(() => {
    if (step !== 2) return;
    setRemaining(countdownSeconds);
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [step, countdownSeconds]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{step === 1 ? title : finalTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1 ? description : finalDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
          {step === 1 ? (
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setStep(2); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Devam et
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              disabled={remaining > 0 || busy}
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try { await onConfirm(); } finally { setBusy(false); onOpenChange(false); }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remaining > 0 ? `${confirmLabel} (${remaining})` : confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
