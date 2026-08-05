// UYARLANIR ÇÖZÜNÜRLÜK — 3B oyunların Capacitor/WebView'de kasmaması için.
//
// NEDEN GEREKLİ: en pahalı şey üçgen sayısı değil, DOLDURULAN PİKSEL sayısı.
// 2026 telefonlarında `devicePixelRatio` çoğunlukla 2.6-3.5. Sabit
// `setPixelRatio(min(2, dpr))` ile 412×880'lik bir ekran 824×1760 = 1.45 MP
// olarak çizilir; üstüne PCFSoft gölge + antialias binince orta seviye bir
// GPU'da kare süresi 16 ms'i aşar. Telefon ekranında pikseller zaten çok
// küçük olduğu için 1.25-1.5 oranıyla fark neredeyse görünmez, kazanç ise
// büyüktür: 2.0 → 1.5 = %44 daha az piksel.
//
// NASIL: kare sürelerinin ortalamasını izler; yavaşsa çözünürlüğü kademeli
// düşürür, rahatsa geri yükseltir. Cihaz sınıfını TAHMİN ETMEZ — ölçer.
// Böylece ucuz telefonda akıcı, amiral gemisinde net olur.

export interface AdaptiveRes {
  /** Her karede çağır (saniye cinsinden dt). */
  sample: (dt: number) => void;
  /** Şu anki oran (hata ayıklama/HUD için). */
  current: () => number;
}

export function createAdaptiveResolution(
  renderer: { setPixelRatio: (r: number) => void; setSize: (w: number, h: number, s: boolean) => void },
  getSize: () => { w: number; h: number },
  opts?: { min?: number; max?: number },
): AdaptiveRes {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const MIN = opts?.min ?? 1;
  const MAX = Math.min(opts?.max ?? 2, Math.max(MIN, dpr));
  const STEP = 0.25;
  // Eşikler: 22 ms ≈ 45 fps altı "kasıyor", 13 ms ≈ 77 fps üstü "bol pay var".
  // Aradaki geniş bant salınımı (sürekli inip çıkma) önler.
  const SLOW_MS = 22;
  const FAST_MS = 13;
  const WINDOW = 90;          // ~1.5 sn
  const SETTLE = 60;          // değişiklikten sonra bu kadar kare ölçme

  let ratio = MAX;
  let acc = 0;
  let n = 0;
  let cooldown = SETTLE;      // ilk karelerde (sahne ısınırken) ölçüm yapma

  const apply = (r: number) => {
    ratio = r;
    try {
      renderer.setPixelRatio(r);
      const { w, h } = getSize();
      renderer.setSize(w, h, false);
    } catch { /* ölçüm oyunu bozmasın */ }
    cooldown = SETTLE;
    acc = 0; n = 0;
  };

  apply(MAX);

  return {
    current: () => ratio,
    sample: (dt: number) => {
      if (cooldown > 0) { cooldown -= 1; return; }
      // Sekme arkaplandayken gelen dev dt'ler ölçümü bozmasın.
      if (dt <= 0 || dt > 0.2) return;
      acc += dt * 1000; n += 1;
      if (n < WINDOW) return;
      const avg = acc / n;
      acc = 0; n = 0;
      if (avg > SLOW_MS && ratio > MIN) apply(Math.max(MIN, ratio - STEP));
      else if (avg < FAST_MS && ratio < MAX) apply(Math.min(MAX, ratio + STEP));
    },
  };
}
