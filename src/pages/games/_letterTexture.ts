// 3B oyunların paylaştığı doku üretimi: Arapça harf panosu ve isim etiketi.
//
// Neden ortak: Elifbâ Partisi ve Elifbâ Yarışı aynı işi yapıyordu. Harfin
// panoya SIĞDIRILMASI (ölçüp ölçekleme) önemsiz bir detay değil — derin
// çanaklı harfler (ج ح خ ع غ) sabit font boyutuyla kesiliyor, ufak harfler
// (ا) panonun ortasında kayboluyor. Tek yerde durması ikisinin de bozulmasını
// engeller.
import * as THREE from "three";

const FONT_STACK = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif';
const cache = new Map<string, THREE.CanvasTexture>();

/** Beyaz zeminli, ortalanmış Arapça harf panosu dokusu. */
export function letterTexture(text: string, opts?: { bg?: string; fg?: string }): THREE.CanvasTexture {
  const bg = opts?.bg ?? "#ffffff";
  const fg = opts?.fg ?? "#065f46";
  const key = `L:${text}:${bg}:${fg}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 512;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  // RTL şart: harfler tatweel ile sarılı gelebiliyor, doğru bitişik şekli
  // (init/med/fin) fontun kendi Arapça biçimlendirmesi seçsin.
  g.direction = "rtl";
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  // 1) ölçüm turu
  const base = 320;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `${base}px ${FONT_STACK}`;
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent || base * 0.75;
  const desc = m.actualBoundingBoxDescent || base * 0.25;
  const w = Math.max((m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0), m.width, 1);
  // 2) kullanılabilir alana sığdır
  const pad = 60;
  const scale = Math.min((S - pad * 2) / (asc + desc), (S - pad * 2) / w, 1.6);
  const size = Math.floor(base * scale);
  g.font = `${size}px ${FONT_STACK}`;
  const m2 = g.measureText(text);
  const asc2 = m2.actualBoundingBoxAscent || size * 0.75;
  const desc2 = m2.actualBoundingBoxDescent || size * 0.25;
  // 3) dikeyde ortala
  g.fillStyle = fg;
  g.fillText(text, S / 2, (S - (asc2 + desc2)) / 2 + asc2);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Yarışmacının başının üstünde uçan isim tabelası dokusu. */
export function nameTexture(name: string, color: string): THREE.CanvasTexture {
  const key = `N:${name}:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.beginPath();
  const r = 22;
  g.moveTo(r, 4);
  g.arcTo(252, 4, 252, 60, r);
  g.arcTo(252, 60, 4, 60, r);
  g.arcTo(4, 60, 4, 4, r);
  g.arcTo(4, 4, 252, 4, r);
  g.closePath();
  g.fill();
  g.fillStyle = color;
  g.font = "700 34px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(name, 128, 34);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Emoji'yi şeffaf zeminli dokuya çizer (taç, muz, item kutusu ikonu…). */
export function emojiTexture(emoji: string, size = 256): THREE.CanvasTexture {
  const key = `E:${emoji}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  g.font = `${Math.round(size * 0.78)}px serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, size / 2, size * 0.54);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
