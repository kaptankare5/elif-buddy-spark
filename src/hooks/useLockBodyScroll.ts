import { useEffect } from "react";

/**
 * Oyun ekranlarında sayfa kaydırmayı kilitler — mobilde tam ekran hissi.
 * Yan/alt scroll bar'larını gizler, sayfa aşağı yukarı kaydırılmaz.
 */
export function useLockBodyScroll() {
  useEffect(() => {
    const b = document.body;
    const h = document.documentElement;
    const prevBO = b.style.overflow;
    const prevHO = h.style.overflow;
    const prevOB = b.style.overscrollBehavior;
    const prevTouch = b.style.touchAction;
    b.style.overflow = "hidden";
    h.style.overflow = "hidden";
    b.style.overscrollBehavior = "none";
    // Yatay swipe yılan vb. için izinli kalsın; sadece varsayılan kaydırmayı engelle
    b.style.touchAction = "none";
    return () => {
      b.style.overflow = prevBO;
      h.style.overflow = prevHO;
      b.style.overscrollBehavior = prevOB;
      b.style.touchAction = prevTouch;
    };
  }, []);
}
