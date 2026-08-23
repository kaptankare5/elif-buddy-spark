// 3B oyunların paylaştığı doku üretimi: Arapça harf panosu, isim etiketi,
// karakter yüzü ve emoji ikonu.
//
// Neden ortak: Elifbâ Partisi ve Elifbâ Yarışı aynı işleri yapıyordu. Harfin
// panoya SIĞDIRILMASI (ölçüp ölçekleme) önemsiz bir detay değil — derin
// çanaklı harfler (ج ح خ ع غ) sabit font boyutuyla kesiliyor, ufak harfler
// (ا) panonun ortasında kayboluyor. Tek yerde durması ikisinin de bozulmasını
// engeller; aynısı sevimli yüz için de geçerli.
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

/**
 * KARE pano için YAZILI KELİME dokusu (yeni soru modları — bkz. lib/askMode.ts).
 * nameTexture 256×64 (4:1) — kare panoya gerilir ve okunmaz hâle gelir; bu
 * yüzden ayrı bir kare doku gerekiyor. Uzun ad sığmazsa font küçültülür.
 */
export function wordTexture(word: string, opts?: { bg?: string; fg?: string }): THREE.CanvasTexture {
  const bg = opts?.bg ?? "#fffdf5";
  const fg = opts?.fg ?? "#134e4a";
  const key = `W:${word}:${bg}:${fg}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 248);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  // Genişliğe göre font seç — "Elif" ile "Peltek Se" aynı puntoda sığmaz.
  let px = 84;
  do {
    g.font = `800 ${px}px system-ui, sans-serif`;
    if (g.measureText(word).width <= 216) break;
    px -= 6;
  } while (px > 24);
  g.fillText(word, 128, 132);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/**
 * KAPALI ŞERİT panosu — 2 şıklı modda ortadaki şerit boş kalıyordu ve oyun
 * BOZUKMUŞ gibi görünüyordu (kullanıcı bildirdi). Artık oraya "burası cevap
 * değil" diyen çapraz taralı bir plaka konuyor.
 */
export function blockedTexture(): THREE.CanvasTexture {
  const key = "BLOCKED";
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#475569";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#94a3b8";
  g.lineWidth = 10;
  for (let i = -128; i < 128; i += 26) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
  }
  g.strokeStyle = "#1e293b";
  g.lineWidth = 8;
  g.strokeRect(4, 4, 120, 120);
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

/**
 * Sevimli karakter yüzü — şeffaf doku, gövdenin/kafanın önüne yapıştırılır.
 * 3B primitiflerle (küre göz + küre bebek) yapılan yüz cansız duruyordu;
 * çizilmiş yüz hem çok daha sevimli hem tek çizim çağrısı. Oranlar Animal
 * Crossing mantığında: BÜYÜK parlak gözler, küçük ağız, belirgin yanak allığı.
 */
export function faceTexture(): THREE.CanvasTexture {
  const key = "F:cute";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 256;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const g = c.getContext("2d")!;

  // yanak allığı
  g.fillStyle = "rgba(255,120,160,0.45)";
  g.beginPath(); g.ellipse(52, 158, 26, 17, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(204, 158, 26, 17, 0, 0, Math.PI * 2); g.fill();

  // gözler: büyük, koyu, iki parlama noktalı
  for (const ex of [88, 168]) {
    g.fillStyle = "#241f1c";
    g.beginPath(); g.ellipse(ex, 112, 25, 31, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.ellipse(ex - 7, 100, 8.5, 10, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(ex + 9, 126, 4, 0, Math.PI * 2); g.fill();
  }

  // gülümseme
  g.strokeStyle = "#241f1c";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.arc(128, 156, 24, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/**
 * JANT GÖBEĞİ — tekerleğin döndüğünün GÖRÜLEBİLMESİ için.
 *
 * ⚠️ NEDEN GEREKLİ: lastik de göbek de düz silindir, yani dönme eksenine göre
 * TAM SİMETRİK. Kod tekerleği her karede döndürüyordu ama ekranda hiçbir şey
 * değişmiyordu — dönen simetrik bir cisim duruyormuş gibi görünür. Desen
 * gelince yuvarlanma görünür oluyor ve araç "kayıyor" değil "yuvarlanıyor"
 * gibi duruyor.
 *
 * ⚠️ DESENİN SİMETRİSİ STROBE SINIRINI BELİRLER: `n` kollu bir göbek, karede
 * yarım kol adımından (π/n) fazla dönerse zamansal örtüşmeye girer ve
 * tekerlek GERİYE dönüyormuş gibi görünür (wagon-wheel etkisi). Bu yüzden
 * kol sayısı AZ (3) tutuldu ve kollardan biri farklı renk: gözün takip
 * ettiği belirgin işaret bir tane olunca desen fiilen 1. dereceden simetrik
 * olur, örtüşme eşiği yükselir. Çizim silindirin KAPAKLARINA düşer
 * (three.js kapak UV'si merkezi (0.5,0.5) olan bir daireye eşlenir).
 */
export function hubTexture(spokes = 3): THREE.CanvasTexture {
  const key = `H:${spokes}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 128;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const M = S / 2;

  // jant gövdesi: açık metalik disk
  g.fillStyle = "#e8edf3";
  g.beginPath(); g.arc(M, M, M, 0, Math.PI * 2); g.fill();
  // dış çember (lastikle sınır)
  g.strokeStyle = "#9aa5b1";
  g.lineWidth = 6;
  g.beginPath(); g.arc(M, M, M - 5, 0, Math.PI * 2); g.stroke();

  // kollar — biri vurgulu (gözün takip ettiği tek işaret)
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    g.save();
    g.translate(M, M);
    g.rotate(a);
    g.fillStyle = i === 0 ? "#f59e0b" : "#7b8794";
    g.beginPath();
    g.moveTo(-8, -10);
    g.lineTo(8, -10);
    g.lineTo(5, -(M - 12));
    g.lineTo(-5, -(M - 12));
    g.closePath();
    g.fill();
    g.restore();
  }

  // orta somun
  g.fillStyle = "#4b5563";
  g.beginPath(); g.arc(M, M, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cbd5e1";
  g.beginPath(); g.arc(M, M, 8, 0, Math.PI * 2); g.fill();

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
