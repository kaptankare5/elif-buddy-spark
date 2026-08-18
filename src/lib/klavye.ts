// PC KLAVYESİ — oyunların bilgisayarda da oynanabilmesi için ortak yardımcılar.
//
// ⚠️ NEDEN: oyunların yarısı yalnız dokunmatikle oynanıyordu. Balon, Hızlı
// Quiz, Kutu Boşalt gibi ŞIK tabanlı oyunlarda hiç klavye yoktu; PC'de fare
// zorunluydu. Aksiyon oyunlarında da WASD ile ok tuşları tutarsızdı (Uçan
// Kuş'ta W yok, Yılan'da WASD yok).
//
// ⚠️ e.key DEĞİL e.code kullanılır: e.key klavye DÜZENİNE göre değişir
// (Türkçe F klavyede WASD başka harf verir), e.code FİZİKSEL tuşu söyler.
import { useEffect, useState } from "react";

/**
 * 1-9 rakam tuşlarını şıklara bağlar (üst sıra ve numpad).
 *
 * `sayi` kadar şık varsayılır; kapsam dışındaki tuş yok sayılır.
 * `etkin` false iken dinlemez (oyun bitti/duraklatıldı).
 */
export function useSecenekTuslari(
  sayi: number,
  sec: (index: number) => void,
  etkin = true,
) {
  useEffect(() => {
    if (!etkin || sayi <= 0) return;
    const h = (e: KeyboardEvent) => {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (!m) return;
      const i = Number(m[1]) - 1;
      if (i >= sayi) return;
      e.preventDefault();
      sec(i);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sayi, sec, etkin]);
}

/**
 * Cihazda fiziksel klavye/fare var mı?
 *
 * ⚠️ "Dokunmatik var mı" diye bakmak YETMEZ: dokunmatik ekranlı dizüstüler
 * hem dokunuyor hem klavyeli. Ölçüt İŞARETLEME CİHAZININ İNCELİĞİ
 * (`pointer: fine`) — fare/kalem varsa ipuçlarında tuşlar yazılır.
 */
export function pcMi(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(pointer: fine)").matches; } catch { return false; }
}

export function usePcMi(): boolean {
  const [v, setV] = useState(() => pcMi());
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine)");
    const h = () => setV(mq.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return v;
}

/** Cihaza göre ipucu metni — PC'de tuşları, telefonda dokunmayı anlatır. */
export function ipucu(dokunmatik: string, klavye: string): string {
  return pcMi() ? klavye : dokunmatik;
}
