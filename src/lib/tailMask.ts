// ✂️ KUYRUK MASKESİ — yalın harfin hangi pikselleri "kuyruk", hangileri "baş"?
//
// Hem SİL-ÇIKAR OYUNU (EraseGame) hem de KUYRUK SİLME ANİMASYONU (TailErase)
// bu modülü kullanır. Daha önce animasyon her harf için AYNI sabit dikdörtgeni
// kırmızıya boyuyordu; bu yüzden Cim ile Be'nin NOKTASI kutunun içinde kalıp
// siliniyor, Sin/Şin/Gaf/Dad'ın kuyruk ucu kutunun dışında kalıp yeşil şerit
// bırakıyor, Sad/Dad'ın başı fazla kesiliyor, Lem ise baştan aşağı kırmızı
// görünüyordu. Maske artık gerçek glif pikselleri üzerinden hesaplanır.
//
// Yöntem — üç adımlı bağlı bileşen (8-komşuluk) analizi:
//   1) Ana gövde = en büyük bileşen. Ayrı duran küçük lekeler NOKTA'dır ve
//      başta hâlinde de bulunur → asla kuyruğa girmez.
//   2) Kuyruk çekirdeği = ana gövde ∧ kuyruk bölgesi (TailRule.zone: "alt"
//      ya da "sol" + mürekkep kutusuna göre oran). Kesikten sonra BAŞTAN
//      KOPAN parçalar da kuyruğa katılır — kuyruk ucu yukarı kıvrıldığı için
//      düz kesiğin üstünde kalıyor ve yeşil şerit bırakıyordu.
//   3) Tersi: kuyruk gövdesinden KOPUK küçük kırmızı lekeler başa geri döner
//      (Sad/Dad'ın halkasının sol ucu kopuk bir kırmızı çentik bırakıyordu).
import type { TailRule } from "@/data/writingMnemonics";

export const TAIL_FONT_FAMILY = `"Amiri Quran", "Amiri", "Scheherazade New", serif`;

export type TailMaskGeom = {
  /** iç kanvas ölçüleri (px) */
  cw: number;
  ch: number;
  /** glif punto (iç çözünürlükte) */
  fontPx: number;
  /** taban çizgisi (iç çözünürlükte) */
  baseY: number;
};

export type TailMask = {
  /** tam glif (yeşil) */
  glyph: HTMLCanvasElement;
  /** yalnız baş — kuyruk silinmiş hâli */
  head: HTMLCanvasElement;
  /** kuyruğun kırmızı vurgusu */
  tailTint: HTMLCanvasElement;
  /** kuyruğun alfa maskesi (kesişim için) */
  tailMask: HTMLCanvasElement;
  /** baş pikselleri (uyarı için hızlı sorgu) */
  headFlags: Uint8Array;
  tailInk: number;
  headInk: number;
  /** kuyruk mürekkebinin sınırları — silgi süpürmesi bu aralıkta gezer */
  tailBox: { left: number; right: number; top: number; bottom: number };
};

const mkCanvas = (cw: number, ch: number) => {
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  return c;
};

const fontOf = (g: TailMaskGeom) => `${g.fontPx}px ${TAIL_FONT_FAMILY}`;

/** Bu geometri için font yükleme dizesi (document.fonts.load) */
export const tailFontSpec = (g: TailMaskGeom) => fontOf(g);

type Drawn = {
  canvas: HTMLCanvasElement;
  data: Uint8ClampedArray;
  left: number; right: number; top: number; bottom: number; ink: number;
};

/** Glifi kendi kanvasına çizer + mürekkep kutusunu ölçer. */
function drawGlyph(ch: string, geom: TailMaskGeom, dx: number, dy = 0): Drawn {
  const c = mkCanvas(geom.cw, geom.ch);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = fontOf(geom);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#134e3a";
  g.fillText(ch, dx, geom.baseY + dy);
  const d = g.getImageData(0, 0, geom.cw, geom.ch).data;
  let right = -1, left = geom.cw, top = geom.ch, bottom = -1, ink = 0;
  for (let y = 0; y < geom.ch; y++) {
    for (let x = 0; x < geom.cw; x++) {
      if (d[(y * geom.cw + x) * 4 + 3] > 40) {
        ink++;
        if (x > right) right = x;
        if (x < left) left = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { canvas: c, data: d, left, right, top, bottom, ink };
}

/** Ortalanmış glif çizer (yalın/başta hâlleri aynı sahnede hizalansın diye). */
export function drawCentered(ch: string, geom: TailMaskGeom, color = "#134e3a"): HTMLCanvasElement | null {
  const probe = drawGlyph(ch, geom, 0);
  if (probe.right < 0) return null;
  const dx = Math.round((geom.cw - probe.right) / 2);
  const c = mkCanvas(geom.cw, geom.ch);
  const g = c.getContext("2d")!;
  g.font = fontOf(geom);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = color;
  g.fillText(ch, dx, geom.baseY);
  return c;
}

/** 8-komşuluklu bağlı bileşen etiketleme (BFS/yığın). */
function labelComponents(src: Uint8Array, cw: number, ch: number) {
  const n = cw * ch;
  const comp = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (!src[start] || comp[start] !== -1) continue;
    const id = sizes.length;
    let sp = 0, size = 0;
    stack[sp++] = start;
    comp[start] = id;
    while (sp > 0) {
      const i = stack[--sp];
      size++;
      const x = i % cw, y = (i / cw) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const j = ny * cw + nx;
          if (src[j] && comp[j] === -1) { comp[j] = id; stack[sp++] = j; }
        }
      }
    }
    sizes.push(size);
  }
  let main = -1, best = -1;
  for (let k = 0; k < sizes.length; k++) if (sizes[k] > best) { best = sizes[k]; main = k; }
  return { comp, main };
}

/**
 * Yalın harfi çizer ve kuyruk/baş katmanlarını üretir.
 * Font henüz yüklenmemişse (boş glif) null döner.
 */
export function buildTailMask(rule: TailRule, geom: TailMaskGeom): TailMask | null {
  const { cw, ch } = geom;
  const probe = drawGlyph(rule.iso, geom, 0);
  if (probe.right < 0) return null;
  const iso = drawGlyph(rule.iso, geom, Math.round((cw - probe.right) / 2));
  const d = iso.data;
  const n = cw * ch;

  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) ink[i] = d[i * 4 + 3] > 40 ? 1 : 0;

  // 1) ana gövde — kalan küçük lekeler NOKTA, korunur
  const c1 = labelComponents(ink, cw, ch);

  // 2) kuyruk çekirdeği = ana gövde ∧ kuyruk bölgesi
  const bw = iso.right - iso.left, bh = iso.bottom - iso.top;
  const cutY = Math.round(iso.top + bh * rule.zone.at);
  const cutX = Math.round(iso.left + bw * rule.zone.at);
  const tail = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!ink[i] || c1.comp[i] !== c1.main) continue;
    const x = i % cw, y = (i / cw) | 0;
    if (rule.zone.dir === "alt" ? y >= cutY : x <= cutX) tail[i] = 1;
  }

  // 3a) kesikten sonra baştan KOPAN parçalar da kuyruktur (kıvrık uçlar)
  const head0 = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (ink[i] && c1.comp[i] === c1.main && !tail[i]) head0[i] = 1;
  const c2 = labelComponents(head0, cw, ch);
  for (let i = 0; i < n; i++) if (head0[i] && c2.comp[i] !== c2.main) tail[i] = 1;

  // 3b) kuyruk gövdesinden KOPUK kırmızı lekeler başa geri döner
  const c3 = labelComponents(tail, cw, ch);
  for (let i = 0; i < n; i++) if (tail[i] && c3.comp[i] !== c3.main) tail[i] = 0;

  // 4) katmanlar — createImageData ile, glifin yumuşak kenarları korunur
  const tailMask = mkCanvas(cw, ch);
  const tmCtx = tailMask.getContext("2d")!;
  const tImg = tmCtx.createImageData(cw, ch);
  const tint = mkCanvas(cw, ch);
  const tgCtx = tint.getContext("2d")!;
  const rImg = tgCtx.createImageData(cw, ch);
  const head = mkCanvas(cw, ch);
  const hdCtx = head.getContext("2d")!;
  const hImg = hdCtx.createImageData(cw, ch);

  let tailInk = 0, headInk = 0;
  let tl = cw, tr = -1, tt = ch, tb = -1;
  const headFlags = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!ink[i]) continue;
    const a = d[i * 4 + 3];
    if (tail[i]) {
      tailInk++;
      const x = i % cw, y = (i / cw) | 0;
      if (x < tl) tl = x;
      if (x > tr) tr = x;
      if (y < tt) tt = y;
      if (y > tb) tb = y;
      rImg.data[i * 4] = 220; rImg.data[i * 4 + 1] = 38;
      rImg.data[i * 4 + 2] = 38; rImg.data[i * 4 + 3] = a;
    } else {
      headInk++;
      headFlags[i] = 1;
      hImg.data[i * 4] = d[i * 4]; hImg.data[i * 4 + 1] = d[i * 4 + 1];
      hImg.data[i * 4 + 2] = d[i * 4 + 2]; hImg.data[i * 4 + 3] = a;
    }
  }

  // SİLME MASKESİ tam opak ve 1px genişletilmiş olmalı. Glifin kenarları
  // yumuşatılmıştır (alfa < 255); maske de yumuşak olursa destination-out
  // silmeyi TAM yapamaz ve kuyruk silindikten sonra soluk bir kırmızı iz
  // kalır. Nokta pikselleri genişletmenin dışında tutulur — nokta korunacak.
  const R = 2;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (ink[i] && c1.comp[i] !== c1.main) continue;    // nokta → dokunma
      let near = false;
      for (let dy = -R; dy <= R && !near; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          if (tail[ny * cw + nx]) { near = true; break; }
        }
      }
      if (near) tImg.data[i * 4 + 3] = 255;
    }
  }
  tmCtx.putImageData(tImg, 0, 0);
  tgCtx.putImageData(rImg, 0, 0);
  hdCtx.putImageData(hImg, 0, 0);

  return {
    glyph: iso.canvas,
    head,
    tailTint: tint,
    tailMask,
    headFlags,
    tailInk,
    headInk,
    tailBox: { left: tl, right: tr, top: tt, bottom: tb },
  };
}
