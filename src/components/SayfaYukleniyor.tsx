/**
 * Kod bölünmesi sırasında görünen ara ekran.
 *
 * ⚠️ ÇOCUK "BOZULDU" SANMAMALI: boş beyaz ekran yerine uygulamanın kendi
 * rengiyle nefes alan bir simge duruyor. Capacitor'da paketler yerel diskten
 * geldiği için bu ekran çoğu zaman tek karelik — ağ beklemesi YOK.
 */
export function SayfaYukleniyor() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-primary/20" />
        <span className="text-sm text-muted-foreground">Yükleniyor…</span>
      </div>
    </div>
  );
}
