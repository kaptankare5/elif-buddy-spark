import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

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

// Eşikler TEK YERDE: 22 ms ≈ 45 fps altı "kasıyor", 13 ms ≈ 77 fps üstü
// "bol pay var". Aradaki geniş bant salınımı (sürekli inip çıkma) önler.
const SLOW_MS = 22;
const FAST_MS = 13;
const STEP = 0.25;
// ⚠️ PENCERE SANİYE İLE ÖLÇÜLÜR, KARE İLE DEĞİL. Kare sayarken kural tersine
// dönüyordu: 60 fps'lik cihaz 2.5 sn'de düzeltme yapıyor, 10 fps'lik cihaz
// 15 sn bekliyordu — yani yardıma EN ÇOK ihtiyacı olan cihaz EN GEÇ yardım
// alıyordu. Çocuk o 15 saniye boyunca donmuş bir oyuna bakıyor.
const WINDOW_S = 1.0;       // bu kadar saniyelik ortalamaya bak
const SETTLE_S = 0.6;       // değişiklikten sonra bu kadar saniye ölçme

/**
 * Ölçen çekirdek — çizim motorundan BAĞIMSIZ.
 *
 * ⚠️ İKİ FARKLI MOTOR VAR: Partisi/Yarışı düz three.js (renderer.setPixelRatio),
 * Koşusu R3F (`setDpr` — R3F kendi boyutlandırmasını yapar, orada
 * setPixelRatio+setSize çağırmak çakışır). Eşikler ikisinde de aynı olsun diye
 * karar mantığı burada, uygulama çağırana bırakıldı.
 */
export function createResSampler(uygula: (oran: number) => void, min: number, max: number) {
  let ratio = max, acc = 0, n = 0, bekle = SETTLE_S;
  const set = (r: number) => { ratio = r; uygula(r); bekle = SETTLE_S; acc = 0; n = 0; };
  set(max);
  return {
    current: () => ratio,
    sample: (dt: number) => {
      // ⚠️ SEKME KORUMASI GERÇEKTEN YAVAŞ KAREYİ ELEMEMELİ. Eşik 0.2 sn iken
      // 5 fps'in altındaki her kare (dt ≥ 0.2) "arkaplan" sanılıp atılıyordu:
      // uyarlanır çözünürlük tam da EN ÇOK gereken cihazda hiç devreye
      // girmiyordu. Ölçüldü — Partisi 9-15 fps'te uyarlanıyor (824×1760 →
      // 412×880), Yarışı 4-5 fps'te 824×1760'ta ÇAKILI kalıyordu.
      // Arkaplana atılan sekme saniyelerce duraklar; 1 sn gerçek bir oyun
      // karesi olamaz, ayrım orada.
      if (dt <= 0 || dt > 1.0) return;
      // Sekme gizliyken rAF ya hiç dönmez ya seyrek döner — o kareler cihazın
      // gücü hakkında bilgi taşımaz. Eşiği gevşettiğimiz için bu ayrı emniyet
      // şart: tek bir 0.5 sn'lik uyanma karesi 1 sn'lik pencereyi tek başına
      // bozup çözünürlüğü boş yere düşürüyordu.
      if (typeof document !== "undefined" && document.hidden) return;
      if (bekle > 0) { bekle -= dt; return; }
      acc += dt; n += 1;
      if (acc < WINDOW_S) return;
      const avg = (acc / n) * 1000; acc = 0; n = 0;
      if (avg > SLOW_MS && ratio > min) set(Math.max(min, ratio - STEP));
      else if (avg < FAST_MS && ratio < max) set(Math.min(max, ratio + STEP));
    },
  };
}

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
  return createResSampler((r) => {
    try {
      renderer.setPixelRatio(r);
      const { w, h } = getSize();
      renderer.setSize(w, h, false);
    } catch { /* ölçüm oyunu bozmasın */ }
  }, MIN, MAX);
}

/**
 * R3F sürümü — `<Canvas>` İÇİNE konur: `<UyarlanirDpr min={1} max={1.75} />`
 *
 * ⚠️ R3F'te `dpr={[1, 1.75]}` yazmak TEK BAŞINA uyarlanır YAPMAZ: R3F o
 * aralığın ÜST ucunu kullanır ve biri `setDpr` çağırana kadar orada kalır.
 * Koşusu'nda tam olarak bu vardı — Partisi/Yarışı'nda uyarlanır çözünürlük
 * çalışırken Koşusu her cihazda 1.75 ile çiziyordu.
 * ⚠️ `setPixelRatio`/`setSize` ÇAĞIRMA: R3F kendi boyutlandırmasını yapıyor,
 * ikisi çakışıyor. Doğrusu `setDpr`.
 */
export function UyarlanirDpr({ min = 1, max = 2 }: { min?: number; max?: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const ref = useRef<{ sample: (dt: number) => void } | null>(null);
  if (!ref.current) {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const ust = Math.min(max, Math.max(min, dpr));
    ref.current = createResSampler((r) => setDpr(r), min, ust);
  }
  useFrame((_, dt) => ref.current?.sample(dt));
  return null;
}
