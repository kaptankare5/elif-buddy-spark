// 🍄 "Harf Macerası" — Mario tarzı 2D yandan kaydırmalı platform oyunu.
//
// 10 BÖLÜM: her bölüm farklı temalı (çayır, orman, sahil, çöl, gün batımı,
// kar, gece, şeker, uzay, gökkuşağı), soldan sağa koşulur ve bölüm sonundaki
// BAYRAĞA ulaşınca biter (kale + kutlama). Bölüm ilerledikçe çukur/düşman
// artar; zıplama yayı, hareketli platform, merdiven, uçan kuş eklenir.
// İlerleme localStorage'da tutulur; bir bölümü bitirince sonraki açılır.
//
// Para/altın yerine HARF toplanır: sesli + yazılı soru hedef harfi verir,
// yolda 3 harf bloğu belirir; oyuncu koşup zıplayarak DOĞRU bloğa dokunur.
// Doğru: puan + seri + hedef harften bonus "harf parası" dizisi. Yanlış: can
// ve puan kaybı + doğru blok yeşil gösterilir ve harf tekrar sorulur.
// Sorular bloklar GÖRÜNÜRKEN seçilir (önceden değil) — böylece SRS/retry
// kuyruğu bölüm içinde de işler. Cevaplar recordGameAnswer'dan geçer
// (süper modda hepsi, normal modda 3'te 1 sayılır); ipucu halkası süper
// modda yalnız seviye 1'de.
// Mobil (Capacitor) öncelikli: büyük basılı-tut butonları (◀ ▶ Zıpla),
// pointer olayları, dpr'a duyarlı tek <canvas>, arka planda otomatik durur,
// rAF kısılmasına karşı DT_MAX kelepçesi.
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback, playItem } from "@/lib/audio";
import { gamePool, pickN, shuffle } from "./_shared";
import { enqueueRetryItem, getGameItemLevel, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Heart, Volume2, ArrowLeft, ArrowRight, ArrowUp, Pause, Play } from "lucide-react";

// ---- sabitler (mantıksal piksel; görünüm yüksekliği VH'ye ölçeklenir) ----
const VH = 360;               // mantıksal görünüm yüksekliği
const GROUND_Y = 300;         // zemin üst yüzeyi
const GRAVITY = 1900;
const JUMP_V = -660;          // zıplama tepe ≈ 115px — 138'lik bloklara yetişir
const JUMP_CUT = -220;        // tuş erken bırakılınca kısa zıplama
const SPRING_V = -1000;       // zıplama yayı ≈ 263px fırlatır
const MAX_FALL = 950;
const RUN_SPEED = 200;
const ENEMY_SPEED = 55;
const FLYER_SPEED = 70;
const DT_MAX = 0.05;          // sekme arkaplandan dönünce ışınlanmayı önler
const PW = 26, PH = 36;       // oyuncu çarpışma kutusu
const EW = 30, EH = 24;       // kestane (yürüyen düşman) kutusu
const FW = 26, FH = 20;       // uçan kuş kutusu
const COYOTE = 0.1, JUMP_BUFFER = 0.12;
const GHOST_TIME = 2.0;       // hasar sonrası dokunulmazlık
const BLOCK = 54;             // harf bloğu kenarı
const COIN_R = 13;
const PLAT_H = 16;
const LEVEL_COUNT = 10;

const FONT_STACK = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif';
const CONFETTI = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

// ---- bölüm temaları ----
interface Theme {
  name: string;
  emoji: string;
  skyTop: string;
  skyBottom: string;
  hillA: string;
  hillB: string;
  soil: string;
  grassA: string;      // çim üst ton
  grassB: string;      // çim alt ton
  tree: "tree" | "pine" | "palm" | "cactus" | "snowtree" | "candy" | "none";
  treeLeaf: string;
  trunk: string;
  celestial: "sun" | "moon" | "planet" | "rainbow" | "none";
  cloud: string | null;
  flower1: string;
  flower2: string;
  stars?: boolean;
  snow?: boolean;
  fireflies?: boolean;
  birds?: boolean;
}

const THEMES: Theme[] = [
  { name: "Çayır", emoji: "🌼", skyTop: "#7ec3f0", skyBottom: "#eaf8ff", hillA: "#8fd889", hillB: "#a7e3a0", soil: "#c07a35", grassA: "#5ec46a", grassB: "#3f9d45", tree: "tree", treeLeaf: "#4cae5b", trunk: "#8a5a34", celestial: "sun", cloud: "#ffffff", flower1: "#f472b6", flower2: "#facc15", birds: true },
  { name: "Orman", emoji: "🌲", skyTop: "#74b9e8", skyBottom: "#dff2fd", hillA: "#6fbf73", hillB: "#8fd889", soil: "#8a5a2c", grassA: "#4caf50", grassB: "#357a38", tree: "pine", treeLeaf: "#2f855a", trunk: "#6b4226", celestial: "sun", cloud: "#ffffff", flower1: "#fb7185", flower2: "#a3e635", birds: true },
  { name: "Sahil", emoji: "🏖️", skyTop: "#67c7f5", skyBottom: "#f3fbff", hillA: "#7dd3fc", hillB: "#a5e7ff", soil: "#d8ab60", grassA: "#f2d489", grassB: "#e0b96b", tree: "palm", treeLeaf: "#3fae5f", trunk: "#a9713d", celestial: "sun", cloud: "#ffffff", flower1: "#fda4af", flower2: "#fef08a", birds: true },
  { name: "Çöl", emoji: "🌵", skyTop: "#f7b267", skyBottom: "#ffe8c7", hillA: "#e8c07d", hillB: "#f2d49b", soil: "#c9945a", grassA: "#eec97f", grassB: "#d9a95f", tree: "cactus", treeLeaf: "#3f9d45", trunk: "#3f9d45", celestial: "sun", cloud: "#fff7ed", flower1: "#f87171", flower2: "#fbbf24", birds: true },
  { name: "Gün Batımı", emoji: "🌇", skyTop: "#8b5cf6", skyBottom: "#fb923c", hillA: "#6d28d9", hillB: "#8b5cf6", soil: "#7c4a24", grassA: "#4d9e57", grassB: "#3b7f44", tree: "tree", treeLeaf: "#2f6b4f", trunk: "#573418", celestial: "sun", cloud: "#ffe4e6", flower1: "#fb7185", flower2: "#fdba74", birds: true },
  { name: "Kar", emoji: "❄️", skyTop: "#b8def5", skyBottom: "#f0faff", hillA: "#e6f3fb", hillB: "#ffffff", soil: "#8fa5ba", grassA: "#ffffff", grassB: "#dcedf8", tree: "snowtree", treeLeaf: "#2f855a", trunk: "#6b4226", celestial: "sun", cloud: "#ffffff", flower1: "#93c5fd", flower2: "#e0f2fe", snow: true },
  { name: "Gece", emoji: "🌙", skyTop: "#1e293b", skyBottom: "#3b5578", hillA: "#14532d", hillB: "#166534", soil: "#5e3d1d", grassA: "#3f7d4a", grassB: "#2f5e38", tree: "tree", treeLeaf: "#1f7a44", trunk: "#3f2a14", celestial: "moon", cloud: "rgba(148,163,184,0.55)", flower1: "#a78bfa", flower2: "#f0abfc", stars: true, fireflies: true },
  { name: "Şeker", emoji: "🍭", skyTop: "#fbc7e4", skyBottom: "#fff0f7", hillA: "#f9a8d4", hillB: "#fbcfe8", soil: "#8d5b41", grassA: "#7fe3c3", grassB: "#4cc9a6", tree: "candy", treeLeaf: "#f472b6", trunk: "#fefce8", celestial: "none", cloud: "#ffffff", flower1: "#f472b6", flower2: "#38bdf8", birds: true },
  { name: "Uzay", emoji: "🪐", skyTop: "#241b4d", skyBottom: "#4c3a8c", hillA: "#5b4a9e", hillB: "#7263b8", soil: "#565073", grassA: "#9d94c4", grassB: "#7a71a8", tree: "none", treeLeaf: "#67e8f9", trunk: "#67e8f9", celestial: "planet", cloud: null, flower1: "#67e8f9", flower2: "#c084fc", stars: true },
  { name: "Gökkuşağı", emoji: "🌈", skyTop: "#7ec3f0", skyBottom: "#eaf8ff", hillA: "#86efac", hillB: "#fde68a", soil: "#c07a35", grassA: "#5ec46a", grassB: "#3f9d45", tree: "tree", treeLeaf: "#4cae5b", trunk: "#8a5a34", celestial: "rainbow", cloud: "#ffffff", flower1: "#f43f5e", flower2: "#facc15", birds: true },
];

// Bölüm zorluk ayarı — seviye arttıkça uzar ve sıklaşır
function levelConf(lv: number) {
  return {
    len: 2900 + lv * 380,
    gapChance: lv === 1 ? 0.22 : Math.min(0.5, 0.24 + lv * 0.028),
    gapMin: 58,
    gapMax: 84 + Math.min(38, lv * 4),
    enemyChance: Math.min(0.72, 0.3 + lv * 0.045),
    springs: lv >= 2,
    movers: lv >= 3,
    flyers: lv >= 4,
    questions: Math.min(8, 4 + Math.ceil(lv / 2)),
  };
}

// Bölüm ilerlemesi (kaç bölüm açık) — cihazda saklanır
const PROGRESS_KEY = "elifba-platform-progress-v1";
function getUnlockedLevel(): number {
  try {
    const n = parseInt(localStorage.getItem(PROGRESS_KEY) || "1", 10);
    return Math.min(LEVEL_COUNT, Math.max(1, isNaN(n) ? 1 : n));
  } catch { return 1; }
}
function unlockLevel(n: number) {
  try {
    if (n > getUnlockedLevel()) localStorage.setItem(PROGRESS_KEY, String(Math.min(LEVEL_COUNT, n)));
  } catch { /* ignore */ }
}

// ---- tipler ----
interface Mover { baseY: number; range: number; speed: number; phase: number }
interface SolidEnt { x: number; y: number; w: number; oneWay: boolean; mover?: Mover }
interface EnemyEnt { id: number; x: number; y: number; dir: 1 | -1; minX: number; maxX: number; squashT: number }
interface FlyerEnt { id: number; x: number; y: number; baseY: number; dir: 1 | -1; minX: number; maxX: number; amp: number; t: number; squashT: number }
interface SpringEnt { id: number; x: number; y: number; t: number }
interface BlockEnt { x: number; y: number; item: ContentItem | null; isTarget: boolean; state?: "good" | "bad" | "fade" }
interface TrioEnt {
  id: number;
  target: ContentItem | null;   // announce anında SRS'ten seçilir (retry kuyruğu işlesin)
  blocks: BlockEnt[];
  left: number;
  right: number;
  announced: boolean;
  hint: boolean;
  resolved: null | { correct: boolean; missed?: boolean };
  doneT: number;
}
interface CoinEnt { id: number; x: number; y: number; glyph: string; taken: boolean }
interface Pop { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; text?: string; grav?: boolean }
interface World {
  solids: SolidEnt[];
  enemies: EnemyEnt[];
  flyers: FlyerEnt[];
  springs: SpringEnt[];
  trios: TrioEnt[];
  coins: CoinEnt[];
  pops: Pop[];
  genX: number;
}

// ---- küçük yardımcılar ----
function hash01(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

// Harf sprite'ı: blok = beyaz pano + turkuaz çerçeve (Koşu panolarıyla aynı
// dil); para = altın madalyon; mystery = "?" kutusu (soru henüz seçilmedi).
// Harf gerçek piksel sınırları ölçülerek SIĞDIRILIR (derin çanaklı harfler
// kesilmez) — SubwayGame.boardTexture ile aynı yaklaşım.
const spriteCache = new Map<string, HTMLCanvasElement>();
function glyphSprite(glyph: string, kind: "block" | "coin" | "mystery"): HTMLCanvasElement {
  const key = kind + ":" + glyph;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const px = kind === "coin" ? COIN_R * 4 : BLOCK * 2;
  const c = document.createElement("canvas");
  c.width = px; c.height = px;
  const g = c.getContext("2d")!;
  // RTL şart: tatweel'le sarılı harflerde doğru bitişik biçim seçilsin
  g.direction = "rtl";
  if (kind === "block") {
    rr(g, 3, 3, px - 6, px - 6, 18);
    g.fillStyle = "#ffffff";
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = "#0f766e";
    g.stroke();
  } else if (kind === "mystery") {
    rr(g, 3, 3, px - 6, px - 6, 18);
    g.fillStyle = "#f59e0b";
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = "#b45309";
    g.stroke();
    // köşe perçinleri
    g.fillStyle = "#fde68a";
    for (const [cx, cy] of [[16, 16], [px - 16, 16], [16, px - 16], [px - 16, px - 16]]) {
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
    }
  } else {
    g.beginPath();
    g.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2);
    g.fillStyle = "#fbbf24";
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = "#b45309";
    g.stroke();
    g.beginPath();
    g.arc(px / 2, px / 2, px / 2 - 8, 0, Math.PI * 2);
    g.lineWidth = 2;
    g.strokeStyle = "#f59e0b";
    g.stroke();
  }
  const useArabic = kind !== "mystery";
  const base = px * 0.62;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  const fontOf = (sz: number) => useArabic ? `${sz}px ${FONT_STACK}` : `bold ${sz}px system-ui, sans-serif`;
  g.font = fontOf(base);
  const m = g.measureText(glyph);
  const asc = m.actualBoundingBoxAscent || base * 0.75;
  const desc = m.actualBoundingBoxDescent || base * 0.25;
  const wpx = Math.max((m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0), m.width, 1);
  const pad = kind === "coin" ? px * 0.2 : px * 0.14;
  const scale = Math.min((px - pad * 2) / (asc + desc), (px - pad * 2) / wpx, 1.4);
  const size = Math.floor(base * scale);
  g.font = fontOf(size);
  const m2 = g.measureText(glyph);
  const a2 = m2.actualBoundingBoxAscent || size * 0.75;
  const d2 = m2.actualBoundingBoxDescent || size * 0.25;
  g.fillStyle = kind === "block" ? "#065f46" : "#7c2d12";
  g.fillText(glyph, px / 2, (px - (a2 + d2)) / 2 + a2);
  spriteCache.set(key, c);
  return c;
}

// ---- gökyüzü / arkaplan çizimleri (ekran uzayı + paralaks) ----

function drawCelestial(g: CanvasRenderingContext2D, th: Theme, vw: number, time: number) {
  if (th.celestial === "sun") {
    const cx = vw - 64, cy = 56;
    g.save();
    g.translate(cx, cy);
    g.rotate(time * 0.15);
    g.strokeStyle = "rgba(253,224,71,0.8)";
    g.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
      g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
      g.stroke();
    }
    g.restore();
    g.fillStyle = "#fde047";
    g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fef9c3";
    g.beginPath(); g.arc(cx - 6, cy - 6, 8, 0, Math.PI * 2); g.fill();
  } else if (th.celestial === "moon") {
    const cx = vw - 64, cy = 54;
    g.fillStyle = "#fef3c7";
    g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(120,113,108,0.25)";
    g.beginPath(); g.arc(cx - 6, cy - 4, 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 5, cy + 7, 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 7, cy - 8, 2.4, 0, Math.PI * 2); g.fill();
  } else if (th.celestial === "planet") {
    const cx = vw - 70, cy = 60;
    g.fillStyle = "#fb923c";
    g.beginPath(); g.arc(cx, cy, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fdba74";
    g.beginPath(); g.arc(cx - 5, cy - 4, 6, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.35);
    g.strokeStyle = "#e9d5ff";
    g.lineWidth = 4;
    g.beginPath(); g.ellipse(0, 0, 30, 9, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
}

function drawStars(g: CanvasRenderingContext2D, vw: number, time: number) {
  for (let i = 0; i < 46; i++) {
    const sx = hash01(i * 13) * vw;
    const sy = hash01(i * 29) * (GROUND_Y - 90);
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.4 + i * 1.7));
    g.globalAlpha = tw;
    g.fillStyle = "#fef9c3";
    const r = i % 7 === 0 ? 2.2 : 1.3;
    g.fillRect(sx, sy, r, r);
  }
  g.globalAlpha = 1;
}

function drawClouds(g: CanvasRenderingContext2D, camX: number, vw: number, color: string) {
  const f = 0.2, spacing = 240;
  const off = camX * f;
  const i0 = Math.floor((off - 160) / spacing);
  const i1 = Math.ceil((off + vw + 160) / spacing);
  g.fillStyle = color;
  for (let i = i0; i <= i1; i++) {
    const x = i * spacing + hash01(i) * 120 - off;
    const y = 34 + hash01(i * 3 + 1) * 78;
    const sc = 0.6 + hash01(i * 7 + 2) * 0.9;
    g.beginPath();
    g.arc(x, y, 16 * sc, 0, Math.PI * 2);
    g.arc(x + 15 * sc, y + 4 * sc, 11 * sc, 0, Math.PI * 2);
    g.arc(x - 15 * sc, y + 4 * sc, 10 * sc, 0, Math.PI * 2);
    g.fill();
  }
}

function drawBirds(g: CanvasRenderingContext2D, vw: number, time: number) {
  g.strokeStyle = "rgba(51,65,85,0.7)";
  g.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    const bx = vw + 60 - ((time * (20 + i * 6) + i * 320) % (vw + 140));
    const by = 44 + hash01(i * 5) * 70 + Math.sin(time * 2 + i) * 7;
    const wf = Math.sin(time * 9 + i * 2) * 3.5;
    g.beginPath();
    g.moveTo(bx - 6, by - wf);
    g.quadraticCurveTo(bx - 2, by + 2, bx, by);
    g.quadraticCurveTo(bx + 2, by + 2, bx + 6, by - wf);
    g.stroke();
  }
}

function drawHills(g: CanvasRenderingContext2D, camX: number, vw: number, th: Theme, time: number) {
  // gökkuşağı — tepelerin arkasında büyük kemer
  if (th.celestial === "rainbow") {
    const off = camX * 0.3, spacing = 1400;
    const i0 = Math.floor((off - 300) / spacing);
    const i1 = Math.ceil((off + vw + 300) / spacing);
    const cols = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
    for (let i = i0; i <= i1; i++) {
      const cx = i * spacing + 420 - off;
      for (let k = 0; k < cols.length; k++) {
        g.strokeStyle = cols[k];
        g.lineWidth = 9;
        g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(cx, GROUND_Y + 30, 205 - k * 9, Math.PI, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
  const f = 0.4, spacing = 280;
  const off = camX * f;
  const i0 = Math.floor((off - 240) / spacing);
  const i1 = Math.ceil((off + vw + 240) / spacing);
  for (let i = i0; i <= i1; i++) {
    const x = i * spacing + hash01(i * 5) * 130 - off;
    const r = 55 + hash01(i * 2 + 1) * 75;
    g.fillStyle = i % 2 ? th.hillA : th.hillB;
    g.beginPath();
    g.arc(x, GROUND_Y + 4, r, Math.PI, Math.PI * 2);
    g.fill();
  }
  void time;
}

function drawSnow(g: CanvasRenderingContext2D, vw: number, time: number) {
  g.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 46; i++) {
    const spd = 26 + hash01(i) * 34;
    const x = ((hash01(i * 7) * 911 + time * (10 + hash01(i * 3) * 20)) % (vw + 24)) - 12;
    const y = ((hash01(i * 11) * 577 + time * spd) % (VH + 16)) - 8;
    g.beginPath();
    g.arc(x, y, 1.4 + hash01(i * 5) * 1.2, 0, Math.PI * 2);
    g.fill();
  }
}

// ---- dünya dekoru (dünya uzayı) ----

function drawTree(g: CanvasRenderingContext2D, x: number, baseY: number, sc: number, th: Theme) {
  switch (th.tree) {
    case "tree": {
      g.fillStyle = th.trunk;
      g.fillRect(x - 4 * sc, baseY - 34 * sc, 8 * sc, 34 * sc);
      g.fillStyle = th.treeLeaf;
      g.beginPath();
      g.arc(x, baseY - 44 * sc, 16 * sc, 0, Math.PI * 2);
      g.arc(x - 12 * sc, baseY - 36 * sc, 11 * sc, 0, Math.PI * 2);
      g.arc(x + 12 * sc, baseY - 36 * sc, 11 * sc, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "pine":
    case "snowtree": {
      g.fillStyle = th.trunk;
      g.fillRect(x - 3.5 * sc, baseY - 14 * sc, 7 * sc, 14 * sc);
      g.fillStyle = th.treeLeaf;
      for (let k = 0; k < 3; k++) {
        const wk = (26 - k * 6) * sc, yk = baseY - (12 + k * 16) * sc;
        g.beginPath();
        g.moveTo(x - wk / 2, yk);
        g.lineTo(x + wk / 2, yk);
        g.lineTo(x, yk - 20 * sc);
        g.closePath();
        g.fill();
      }
      if (th.tree === "snowtree") {
        g.fillStyle = "#ffffff";
        for (let k = 0; k < 3; k++) {
          const yk = baseY - (30 + k * 16) * sc;
          g.beginPath();
          g.ellipse(x, yk, (11 - k * 2.4) * sc, 3.2 * sc, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case "palm": {
      g.strokeStyle = th.trunk;
      g.lineWidth = 6 * sc;
      g.beginPath();
      g.moveTo(x, baseY);
      g.quadraticCurveTo(x + 6 * sc, baseY - 24 * sc, x + 14 * sc, baseY - 42 * sc);
      g.stroke();
      g.strokeStyle = th.treeLeaf;
      g.lineWidth = 4.5 * sc;
      for (let k = 0; k < 5; k++) {
        const a = -0.4 - k * 0.55;
        g.beginPath();
        g.moveTo(x + 14 * sc, baseY - 42 * sc);
        g.quadraticCurveTo(
          x + 14 * sc + Math.cos(a) * 16 * sc, baseY - 42 * sc + Math.sin(a) * 16 * sc - 6 * sc,
          x + 14 * sc + Math.cos(a) * 26 * sc, baseY - 42 * sc + Math.sin(a) * 26 * sc,
        );
        g.stroke();
      }
      g.fillStyle = "#92400e";
      g.beginPath(); g.arc(x + 11 * sc, baseY - 39 * sc, 3 * sc, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 18 * sc, baseY - 38 * sc, 3 * sc, 0, Math.PI * 2); g.fill();
      break;
    }
    case "cactus": {
      g.fillStyle = th.treeLeaf;
      rr(g, x - 6 * sc, baseY - 40 * sc, 12 * sc, 40 * sc, 6 * sc);
      g.fill();
      rr(g, x - 20 * sc, baseY - 30 * sc, 8 * sc, 14 * sc, 4 * sc);
      g.fill();
      g.fillRect(x - 20 * sc, baseY - 18 * sc, 16 * sc, 6 * sc);
      rr(g, x + 12 * sc, baseY - 36 * sc, 8 * sc, 14 * sc, 4 * sc);
      g.fill();
      g.fillRect(x + 6 * sc, baseY - 28 * sc, 14 * sc, 6 * sc);
      break;
    }
    case "candy": {
      g.fillStyle = th.trunk;
      g.fillRect(x - 2.5 * sc, baseY - 34 * sc, 5 * sc, 34 * sc);
      g.fillStyle = th.treeLeaf;
      g.beginPath(); g.arc(x, baseY - 44 * sc, 15 * sc, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#ffffff";
      g.lineWidth = 3.5 * sc;
      g.beginPath(); g.arc(x, baseY - 44 * sc, 10 * sc, 0.4, 2.4); g.stroke();
      g.beginPath(); g.arc(x, baseY - 44 * sc, 5 * sc, 2.8, 5.2); g.stroke();
      break;
    }
    case "none":
      break;
  }
}

function drawFlower(g: CanvasRenderingContext2D, x: number, baseY: number, color: string, ph: number, time: number) {
  const sway = Math.sin(time * 1.8 + ph) * 1.4;
  g.strokeStyle = "#3f9d45";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x, baseY);
  g.quadraticCurveTo(x + sway, baseY - 5, x + sway, baseY - 9);
  g.stroke();
  g.fillStyle = color;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.5;
    g.beginPath();
    g.arc(x + sway + Math.cos(a) * 2.6, baseY - 9 + Math.sin(a) * 2.6, 2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#fde047";
  g.beginPath();
  g.arc(x + sway, baseY - 9, 1.7, 0, Math.PI * 2);
  g.fill();
}

function drawGrassTuft(g: CanvasRenderingContext2D, x: number, baseY: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = 1.7;
  for (let k = -1; k <= 1; k++) {
    g.beginPath();
    g.moveTo(x, baseY);
    g.quadraticCurveTo(x + k * 3, baseY - 4, x + k * 4.5, baseY - 8);
    g.stroke();
  }
}

function drawFence(g: CanvasRenderingContext2D, x: number, baseY: number, n: number) {
  g.fillStyle = "#a9713d";
  for (let k = 0; k < n; k++) g.fillRect(x + k * 18, baseY - 18, 4, 18);
  g.fillRect(x - 3, baseY - 15, (n - 1) * 18 + 10, 3);
  g.fillRect(x - 3, baseY - 8, (n - 1) * 18 + 10, 3);
}

function drawGroundSolid(g: CanvasRenderingContext2D, so: SolidEnt, th: Theme, time: number) {
  g.fillStyle = th.soil;
  g.fillRect(so.x, so.y, so.w, VH - so.y + 40);
  g.fillStyle = th.grassB;
  g.fillRect(so.x, so.y, so.w, 12);
  g.fillStyle = th.grassA;
  g.fillRect(so.x, so.y, so.w, 6);
  // toprak benekleri (deterministik — her karede aynı yerde)
  g.fillStyle = "rgba(0,0,0,0.08)";
  const n = Math.floor(so.w / 42);
  for (let i = 0; i < n; i++) {
    const dx = so.x + 8 + ((i * 42 + hash01(so.x + i) * 26) % Math.max(1, so.w - 16));
    const dy = so.y + 20 + hash01(so.x * 3 + i) * (VH - so.y - 26);
    g.fillRect(dx, dy, 5, 3);
  }
  // dekor: çalı, çiçek, çim öbeği, çit, ağaç (hepsi so.x'ten deterministik)
  if (so.w > 150) {
    const fn = Math.max(1, Math.floor(so.w / 120));
    for (let i = 0; i < fn; i++) {
      const fx = so.x + 18 + hash01(so.x * 7 + i * 13) * (so.w - 36);
      drawFlower(g, fx, so.y + 1, i % 2 ? th.flower1 : th.flower2, i * 1.7 + so.x, time);
    }
    const tn = Math.max(1, Math.floor(so.w / 95));
    for (let i = 0; i < tn; i++) {
      const gx = so.x + 10 + hash01(so.x * 11 + i * 5) * (so.w - 20);
      drawGrassTuft(g, gx, so.y + 2, th.grassB);
    }
  }
  if (so.w > 220) {
    const bn = 1 + Math.floor(hash01(so.x) * 2);
    for (let i = 0; i < bn; i++) {
      const bx = so.x + 30 + hash01(so.x + i * 7 + 3) * (so.w - 60);
      g.fillStyle = th.grassB;
      g.beginPath();
      g.arc(bx, so.y + 1, 10, Math.PI, Math.PI * 2);
      g.arc(bx + 11, so.y + 1, 7.5, Math.PI, Math.PI * 2);
      g.arc(bx - 11, so.y + 1, 7.5, Math.PI, Math.PI * 2);
      g.fill();
    }
    if (hash01(so.x * 13) < 0.35) {
      drawFence(g, so.x + 20 + hash01(so.x * 17) * (so.w - 140), so.y, 4 + Math.floor(hash01(so.x * 19) * 3));
    }
  }
  if (so.w > 250 && th.tree !== "none") {
    const tn = 1 + Math.floor(hash01(so.x * 23) * 2);
    for (let i = 0; i < tn; i++) {
      const tx = so.x + 45 + hash01(so.x * 29 + i * 31) * (so.w - 90);
      drawTree(g, tx, so.y + 1, 0.85 + hash01(so.x + i * 41) * 0.5, th);
    }
  }
}

function drawPlatform(g: CanvasRenderingContext2D, so: SolidEnt, th: Theme) {
  rr(g, so.x, so.y, so.w, PLAT_H, 8);
  g.fillStyle = so.mover ? "#7c5a9e" : "#8b5a2b";
  g.fill();
  rr(g, so.x, so.y, so.w, 8, 6);
  g.fillStyle = so.mover ? "#c4b5fd" : th.grassA;
  g.fill();
  if (so.mover) {
    // hareketli platform: alt kenarda küçük itici ışıklar
    g.fillStyle = "#facc15";
    g.beginPath(); g.arc(so.x + 10, so.y + PLAT_H - 3, 2.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(so.x + so.w - 10, so.y + PLAT_H - 3, 2.5, 0, Math.PI * 2); g.fill();
  }
}

function drawSpring(g: CanvasRenderingContext2D, sp: SpringEnt) {
  const k = sp.t > 0 ? 0.45 : 1; // basılınca sıkışır
  const topY = sp.y - 16 * k;
  g.fillStyle = "#7f1d1d";
  rr(g, sp.x - 13, sp.y - 5, 26, 5, 2);
  g.fill();
  g.strokeStyle = "#94a3b8";
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const yy = sp.y - 5 - ((sp.y - 5 - topY) / 3) * i;
    g.moveTo(sp.x - 8, yy);
    g.lineTo(sp.x + 8, yy - 3);
  }
  g.stroke();
  g.fillStyle = "#ef4444";
  rr(g, sp.x - 16, topY - 6, 32, 7, 3);
  g.fill();
  g.fillStyle = "#fca5a5";
  rr(g, sp.x - 16, topY - 6, 32, 3, 2);
  g.fill();
}

function drawEnemy(g: CanvasRenderingContext2D, e: EnemyEnt, time: number) {
  g.save();
  g.translate(e.x + EW / 2, e.y + EH);
  g.scale(1, e.squashT > 0 ? 0.35 : 1);
  g.fillStyle = "#92400e";
  g.beginPath();
  g.ellipse(0, -EH / 2, EW / 2, EH / 2, 0, 0, Math.PI * 2);
  g.fill();
  const step = e.squashT > 0 ? 0 : Math.sin(time * 10 + e.id) * 3;
  g.fillStyle = "#451a03";
  g.beginPath();
  g.ellipse(-8 + step, -2, 6, 3.5, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(8 - step, -2, 6, 3.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(-5, -EH / 2 - 3, 3.4, 0, Math.PI * 2);
  g.arc(5, -EH / 2 - 3, 3.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1f2937";
  g.beginPath();
  g.arc(-4.4 + e.dir, -EH / 2 - 3, 1.5, 0, Math.PI * 2);
  g.arc(5.6 + e.dir, -EH / 2 - 3, 1.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#451a03";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-8, -EH / 2 - 8); g.lineTo(-2, -EH / 2 - 6);
  g.moveTo(8, -EH / 2 - 8); g.lineTo(2, -EH / 2 - 6);
  g.stroke();
  g.restore();
}

function drawFlyer(g: CanvasRenderingContext2D, f: FlyerEnt, time: number) {
  g.save();
  g.translate(f.x + FW / 2, f.y + FH / 2);
  g.scale(f.dir, f.squashT > 0 ? 0.35 : 1);
  // gövde
  g.fillStyle = "#7c3aed";
  g.beginPath();
  g.ellipse(0, 0, FW / 2, FH / 2, 0, 0, Math.PI * 2);
  g.fill();
  // karın
  g.fillStyle = "#c4b5fd";
  g.beginPath();
  g.ellipse(1, 3, FW / 3, FH / 3.2, 0, 0, Math.PI * 2);
  g.fill();
  // kanat (çırpar)
  const wf = Math.sin(time * 13 + f.id) * 0.9;
  g.fillStyle = "#a78bfa";
  g.save();
  g.translate(-2, -2);
  g.rotate(wf * 0.6 - 0.3);
  g.beginPath();
  g.ellipse(0, -6, 9, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // gaga + göz
  g.fillStyle = "#f59e0b";
  g.beginPath();
  g.moveTo(FW / 2 - 2, -2);
  g.lineTo(FW / 2 + 6, 1);
  g.lineTo(FW / 2 - 2, 4);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(5, -3, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1f2937";
  g.beginPath(); g.arc(6, -3, 1.4, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawFlag(g: CanvasRenderingContext2D, x: number, time: number) {
  // taban + direk + dalgalanan bayrak
  g.fillStyle = "#94a3b8";
  rr(g, x - 11, GROUND_Y - 10, 22, 10, 3);
  g.fill();
  g.fillStyle = "#64748b";
  g.fillRect(x - 2.5, GROUND_Y - 148, 5, 138);
  g.fillStyle = "#fbbf24";
  g.beginPath(); g.arc(x, GROUND_Y - 150, 6, 0, Math.PI * 2); g.fill();
  const wav = Math.sin(time * 4) * 4;
  g.fillStyle = "#ef4444";
  g.beginPath();
  g.moveTo(x + 3, GROUND_Y - 144);
  g.quadraticCurveTo(x + 28, GROUND_Y - 140 + wav, x + 48, GROUND_Y - 131 + wav);
  g.quadraticCurveTo(x + 28, GROUND_Y - 124 + wav, x + 3, GROUND_Y - 118);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(x + 18, GROUND_Y - 131 + wav * 0.5, 4.5, 0, Math.PI * 2); g.fill();
}

function drawCastle(g: CanvasRenderingContext2D, x: number) {
  const by = GROUND_Y;
  // yan kuleler
  for (const tx of [x - 16, x + 112]) {
    g.fillStyle = "#b97c39";
    g.fillRect(tx, by - 108, 24, 108);
    g.fillStyle = "#9a6430";
    for (let k = 0; k < 3; k++) g.fillRect(tx + k * 9, by - 116, 6, 8);
    g.fillStyle = "#5b3a1a";
    g.fillRect(tx + 8, by - 92, 8, 12);
  }
  // gövde
  g.fillStyle = "#cd8a3f";
  g.fillRect(x, by - 84, 120, 84);
  g.fillStyle = "#9a6430";
  for (let k = 0; k < 6; k++) g.fillRect(x + 4 + k * 20, by - 92, 12, 8);
  // pencereler + kapı
  g.fillStyle = "#5b3a1a";
  g.fillRect(x + 18, by - 66, 12, 16);
  g.fillRect(x + 90, by - 66, 12, 16);
  g.beginPath();
  g.arc(x + 60, by - 26, 17, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(x + 43, by - 26, 34, 26);
  // tepe bayrağı
  g.fillStyle = "#64748b";
  g.fillRect(x + 58, by - 128, 3, 36);
  g.fillStyle = "#facc15";
  g.beginPath();
  g.moveTo(x + 61, by - 128);
  g.lineTo(x + 82, by - 122);
  g.lineTo(x + 61, by - 116);
  g.closePath();
  g.fill();
  // tuğla çizgileri
  g.strokeStyle = "rgba(90,56,22,0.25)";
  g.lineWidth = 1.5;
  for (let k = 1; k < 4; k++) {
    g.beginPath();
    g.moveTo(x, by - 84 + k * 21);
    g.lineTo(x + 120, by - 84 + k * 21);
    g.stroke();
  }
}

function drawStartSign(g: CanvasRenderingContext2D, x: number) {
  g.fillStyle = "#8a5a34";
  g.fillRect(x - 3, GROUND_Y - 34, 6, 34);
  g.fillStyle = "#d9a05b";
  rr(g, x - 26, GROUND_Y - 56, 52, 26, 6);
  g.fill();
  g.strokeStyle = "#8a5a34";
  g.lineWidth = 3;
  rr(g, x - 26, GROUND_Y - 56, 52, 26, 6);
  g.stroke();
  g.fillStyle = "#5b3a1a";
  g.beginPath();
  g.moveTo(x - 12, GROUND_Y - 49);
  g.lineTo(x + 6, GROUND_Y - 49);
  g.lineTo(x + 6, GROUND_Y - 54);
  g.lineTo(x + 16, GROUND_Y - 43);
  g.lineTo(x + 6, GROUND_Y - 32);
  g.lineTo(x + 6, GROUND_Y - 37);
  g.lineTo(x - 12, GROUND_Y - 37);
  g.closePath();
  g.fill();
}

// Sevimli ÇOCUK karakter: büyük kafa, kahverengi saç, turuncu tişört,
// mavi şort, kırmızı spor ayakkabı, yeşil sırt çantası.
function drawPlayerChar(
  g: CanvasRenderingContext2D,
  x: number, y: number, facing: 1 | -1, anim: number,
  grounded: boolean, ghostT: number, time: number,
) {
  if (ghostT > 0 && Math.floor(time * 12) % 2 === 0) return; // hayalet yanıp söner
  g.save();
  g.translate(x + PW / 2, y + PH);
  g.scale(facing, 1);
  const swing = grounded ? Math.sin(anim * 13) * 5 : 0;
  // sırt çantası (arkada)
  g.fillStyle = "#22c55e";
  rr(g, -15, -26, 7, 12, 3);
  g.fill();
  g.strokeStyle = "#15803d";
  g.lineWidth = 1.4;
  rr(g, -15, -26, 7, 12, 3);
  g.stroke();
  // bacaklar (ten) + kırmızı spor ayakkabılar
  g.fillStyle = "#f5c093";
  if (grounded) {
    g.fillRect(-8 + swing * 0.5, -10, 6, 10);
    g.fillRect(2 - swing * 0.5, -10, 6, 10);
  } else {
    g.fillRect(-8, -8, 6, 8);
    g.fillRect(2, -8, 6, 8);
  }
  g.fillStyle = "#ef4444";
  if (grounded) {
    rr(g, -10 + swing * 0.5, -4, 10, 4.5, 2); g.fill();
    rr(g, 0.5 - swing * 0.5, -4, 10, 4.5, 2); g.fill();
  } else {
    rr(g, -10, -3, 10, 4.5, 2); g.fill();
    rr(g, 0.5, -3, 10, 4.5, 2); g.fill();
  }
  // mavi şort
  g.fillStyle = "#3b82f6";
  rr(g, -9, -17, 18, 9, 3);
  g.fill();
  // turuncu tişört + kollar
  g.fillStyle = "#f59e0b";
  rr(g, -10, -28, 20, 13, 4);
  g.fill();
  g.fillRect(-13.5, -27, 4.5, 8);
  g.fillRect(9, -27, 4.5, 8);
  // eller
  g.fillStyle = "#f5c093";
  g.beginPath();
  g.arc(-11.4, -18.2, 2.4, 0, Math.PI * 2);
  g.arc(11.4, -18.2, 2.4, 0, Math.PI * 2);
  g.fill();
  // kafa (büyük — çocuk oranı)
  g.fillStyle = "#ffd9b3";
  g.beginPath();
  g.arc(0, -37, 10, 0, Math.PI * 2);
  g.fill();
  // kahverengi saç: kubbe + perçemler
  g.fillStyle = "#6b4226";
  g.beginPath();
  g.arc(0, -38.5, 10.2, Math.PI, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(-6, -43, 4.4, 0, Math.PI * 2);
  g.arc(0, -45, 4.9, 0, Math.PI * 2);
  g.arc(6, -43, 4.4, 0, Math.PI * 2);
  g.fill();
  // göz + gülümseme + yanak
  g.fillStyle = "#1f2937";
  g.beginPath();
  g.arc(4, -37.5, 1.8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#7c2d12";
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(3, -33.5, 3.2, 0.15, Math.PI * 0.75);
  g.stroke();
  g.fillStyle = "rgba(244,114,182,0.5)";
  g.beginPath();
  g.arc(7.6, -34, 1.7, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

let UID = 1;

// ================= oyun sayfası =================

const PlatformGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const isSuperRef = useRef(isSuper);
  useEffect(() => { isSuperRef.current = isSuper; }, [isSuper]);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controls = useRef({ moveDir: 0 as -1 | 0 | 1, jumpQueued: false, jumpHeld: false, paused: true, over: false });
  const trioRef = useRef<TrioEnt | null>(null); // aktif soru — ses tekrarı için
  const levelRef = useRef(1);

  const [level, setLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(() => getUnlockedLevel());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [progress, setProgress] = useState(0);
  const [question, setQuestion] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [flash, setFlash] = useState(false); // normal modda doğru cevapta ışık
  const [resetTick, setResetTick] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    controls.current.paused = paused || gameOver || won;
    controls.current.over = gameOver || won;
  }, [paused, gameOver, won]);

  // Arapça font geç yüklenirse harf sprite'larını tazele
  useEffect(() => {
    try {
      document.fonts.load('64px "Amiri Quran"', "بَ").then(() => spriteCache.clear());
    } catch { /* ignore */ }
  }, []);

  // Arkaplana geçince otomatik duraklat (mobil/Capacitor)
  useEffect(() => {
    const h = () => { if (document.hidden) setPaused(true); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  const showBanner = useCallback((text: string, tone: "good" | "bad", ms = 1600) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ text, tone });
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  const replay = useCallback(() => {
    const t = trioRef.current;
    if (t && t.announced && !t.resolved && t.target) playItem(t.target);
  }, []);

  const start = useCallback(() => {
    if (gameOver || won || !started) return;
    setPaused(false);
  }, [gameOver, won, started]);

  // Bölüm başlat (bölüm seçiminden veya tekrar/sonraki düğmelerinden)
  const startLevel = useCallback((lv: number) => {
    levelRef.current = lv;
    setLevel(lv);
    setScore(0); setStreak(0); setLives(3);
    setGameOver(false); setWon(false);
    setQuestion(null); setBanner(null); setFlash(false); setProgress(0);
    controls.current = { moveDir: 0, jumpQueued: false, jumpHeld: false, paused: false, over: false };
    trioRef.current = null;
    setStarted(true);
    setPaused(false);
    setResetTick((t) => t + 1);
  }, []);

  const toPicker = useCallback(() => {
    setStarted(false); setPaused(true); setGameOver(false); setWon(false);
    setQuestion(null); setBanner(null); setProgress(0);
    controls.current = { moveDir: 0, jumpQueued: false, jumpHeld: false, paused: true, over: false };
    trioRef.current = null;
    setResetTick((t) => t + 1);
  }, []);

  // ---- ana oyun döngüsü (canvas; dünya durumu React dışında tutulur) ----
  useEffect(() => {
    const box = boxRef.current, canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lv = levelRef.current;
    const conf = levelConf(lv);
    const theme = THEMES[lv - 1];

    const s = {
      x: 80, y: GROUND_Y - PH, vy: 0, grounded: true, facing: 1 as 1 | -1,
      coyote: 0, jumpBuf: 0, ghostT: 0, camX: 0, safeX: 80, anim: 0, time: 0,
    };
    const w: World = {
      solids: [{ x: -240, y: GROUND_Y, w: 1040, oneWay: false }],
      enemies: [], flyers: [], springs: [], trios: [], coins: [], pops: [],
      genX: 800,
    };
    let score = 0, streak = 0, lives = 3, over = false;
    let winning = false, winT = 0, winBurst = 0;
    let standSolid: SolidEnt | null = null;
    let cleanT = 1;
    let dpr = 1, kScale = 1;
    let view = { w: 576, h: VH };

    const resize = () => {
      const cw = box.clientWidth, ch = box.clientHeight;
      if (!cw || !ch) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      kScale = ch / VH;
      view = { w: cw / kScale, h: VH };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    // --- dünya kurulumu yardımcıları ---

    const randGlyph = (): string => {
      const pool = gamePool();
      return pool.length ? pool[Math.floor(Math.random() * pool.length)].emoji || "" : "";
    };

    const addCoinRow = (cx: number, y: number, n: number) => {
      const glyph = randGlyph();
      if (!glyph) return;
      for (let i = 0; i < n; i++) {
        w.coins.push({ id: UID++, x: cx + (i - (n - 1) / 2) * 32, y, glyph, taken: false });
      }
    };

    const addCoinColumn = (cx: number) => {
      const glyph = randGlyph();
      if (!glyph) return;
      for (let i = 0; i < 3; i++) {
        w.coins.push({ id: UID++, x: cx + i * 26, y: GROUND_Y - 120 - i * 48, glyph, taken: false });
      }
    };

    // Soru üçlüsü: bloklar şimdi yerleştirilir, HARFLER görünürken seçilir
    const placeTrio = (baseX: number) => {
      const hs = shuffle([84, 138, 84]); // blok alt kenarının zeminden yüksekliği
      const blocks: BlockEnt[] = hs.map((h, i) => ({
        x: baseX + i * 122,
        y: GROUND_Y - h - BLOCK,
        item: null,
        isTarget: false,
      }));
      w.trios.push({
        id: UID++, target: null, blocks,
        left: baseX, right: baseX + 2 * 122 + BLOCK,
        announced: false, hint: false, resolved: null, doneT: 0,
      });
    };

    const genChunk = (wantQ: boolean): boolean => {
      let x = w.genX;
      if (!wantQ && x > 1150 && Math.random() < conf.gapChance) {
        const gw = conf.gapMin + Math.random() * (conf.gapMax - conf.gapMin);
        // çukur üstüne para yayı — zıplarken toplanır
        const glyph = randGlyph();
        if (glyph) {
          for (let i = 0; i < 4; i++) {
            const k = (i + 0.5) / 4;
            w.coins.push({ id: UID++, x: x + gw * k, y: GROUND_Y - 66 - Math.sin(k * Math.PI) * 34, glyph, taken: false });
          }
        }
        x += gw;
      }
      const len = wantQ ? 480 + Math.random() * 150 : 300 + Math.random() * 340;
      w.solids.push({ x, y: GROUND_Y, w: len, oneWay: false });
      let placed = false;
      if (wantQ) {
        placeTrio(x + 90);
        placed = true;
      } else {
        const r = Math.random();
        if (len >= 250 && r < 0.78) {
          if (conf.movers && r < 0.25) {
            // hareketli platform (aşağı-yukarı süzülür)
            const pw2 = 84 + Math.random() * 36;
            const px = x + 50 + Math.random() * Math.max(1, len - pw2 - 100);
            const baseY = GROUND_Y - 112;
            w.solids.push({
              x: px, y: baseY, w: pw2, oneWay: true,
              mover: { baseY, range: 26 + Math.random() * 16, speed: 1.1 + Math.random() * 0.7, phase: Math.random() * 6.28 },
            });
            addCoinRow(px + pw2 / 2, baseY - 36, 3);
          } else if (r < 0.5 && len >= 330) {
            // merdiven: 2-3 basamak
            const steps = 2 + (Math.random() < 0.5 ? 1 : 0);
            const sx = x + 40 + Math.random() * Math.max(1, len - steps * 95 - 120);
            for (let k = 0; k < steps; k++) {
              w.solids.push({ x: sx + k * 90, y: GROUND_Y - 78 - k * 52, w: 80, oneWay: true });
            }
            addCoinRow(sx + (steps - 1) * 90 + 40, GROUND_Y - 78 - (steps - 1) * 52 - 30, 3);
          } else {
            const pw2 = 90 + Math.random() * 70;
            const px = x + 40 + Math.random() * Math.max(1, len - pw2 - 80);
            const py = GROUND_Y - (78 + Math.random() * 34);
            w.solids.push({ x: px, y: py, w: pw2, oneWay: true });
            if (Math.random() < 0.8) addCoinRow(px + pw2 / 2, py - 28, 3);
          }
        }
        // zıplama yayı + üstüne dikey para dizisi
        if (conf.springs && len >= 240 && Math.random() < 0.34) {
          const spx = x + 60 + Math.random() * Math.max(1, len - 300);
          w.springs.push({ id: UID++, x: spx, y: GROUND_Y, t: 0 });
          addCoinColumn(spx);
        }
        // yerde para sırası
        if (Math.random() < 0.45) addCoinRow(x + len / 2, GROUND_Y - 26, 4);
        // kestaneler
        if (len >= 240 && Math.random() < conf.enemyChance) {
          const m = 26;
          w.enemies.push({
            id: UID++, x: x + len / 2, y: GROUND_Y - EH,
            dir: Math.random() < 0.5 ? -1 : 1,
            minX: x + m, maxX: x + len - m, squashT: 0,
          });
          if (len >= 430 && Math.random() < 0.4) {
            w.enemies.push({ id: UID++, x: x + len * 0.72, y: GROUND_Y - EH, dir: 1, minX: x + len * 0.5, maxX: x + len - m, squashT: 0 });
          }
        }
        // uçan kuş
        if (conf.flyers && len >= 260 && Math.random() < 0.3) {
          const m = 40;
          w.flyers.push({
            id: UID++, x: x + len * 0.4, y: 0,
            baseY: GROUND_Y - 118 - Math.random() * 40,
            dir: 1, minX: x + m, maxX: x + len - m,
            amp: 20 + Math.random() * 14, t: Math.random() * 6, squashT: 0,
          });
        }
      }
      w.genX = x + len;
      return placed;
    };

    // Bölümü baştan sona üret: sorular eşit aralıklı, sonda düzlük+bayrak+kale
    placeTrio(460); // ilk soru başlangıç düzlüğünde hazır
    const qStep = (conf.len - 1600) / Math.max(1, conf.questions - 1);
    const qXs = Array.from({ length: conf.questions }, (_, i) => 900 + i * qStep);
    let qi = 0;
    while (w.genX < conf.len) {
      const wantQ = qi < qXs.length && w.genX >= qXs[qi];
      if (genChunk(wantQ)) qi++;
    }
    w.solids.push({ x: w.genX, y: GROUND_Y, w: 780, oneWay: false });
    const flagX = w.genX + 300;
    const castleX = w.genX + 440;
    w.genX += 780;

    // --- olay yardımcıları ---

    const loseLife = (silent = false) => {
      if (!silent) playFeedback(false);
      lives -= 1;
      setLives(lives);
      if (lives <= 0) { over = true; setGameOver(true); }
    };

    const respawnX = () => {
      const minX = s.camX + 20;
      let best: number | null = null;
      for (const so of w.solids) {
        if (so.oneWay) continue;
        const rx = Math.max(so.x + 12, minX);
        if (rx + PW + 12 <= so.x + so.w && (best === null || rx < best)) best = rx;
      }
      return best ?? s.safeX;
    };

    const spawnConfetti = (x: number, y: number) => {
      for (let i = 0; i < 14; i++) {
        w.pops.push({
          x, y,
          vx: (Math.random() - 0.5) * 220,
          vy: -80 - Math.random() * 160,
          t: 0, life: 0.9, color: CONFETTI[i % CONFETTI.length], grav: true,
        });
      }
    };

    const spawnDust = (x: number, y: number) => {
      for (let i = 0; i < 4; i++) {
        w.pops.push({
          x: x + (Math.random() - 0.5) * 16, y,
          vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 30,
          t: 0, life: 0.4, color: "rgba(148,163,184,0.8)",
        });
      }
    };

    // Doğru cevap ödülü: hedef harften bonus "harf parası" dizisi
    const spawnCoinTrail = (item: ContentItem) => {
      const glyph = item.emoji || "";
      if (!glyph) return;
      for (let i = 0; i < 5; i++) {
        w.coins.push({
          id: UID++,
          x: s.x + 150 + i * 55,
          y: GROUND_Y - 70 - Math.sin((i / 4) * Math.PI) * 55,
          glyph, taken: false,
        });
      }
    };

    // Soru harfleri bloklar görünür olurken SRS'ten seçilir
    const announceTrio = (t: TrioEnt) => {
      t.announced = true;
      const pool = gamePool();
      const target = pool.length >= 3 ? (pickNextGameItem(pool) || pool[0]) : null;
      const wrongs = target ? pickN(pool.filter((p) => p.id !== target.id && p.emoji !== target.emoji), 2) : [];
      if (!target || wrongs.length < 2) {
        t.resolved = { correct: false, missed: true };
        for (const b of t.blocks) b.state = "fade";
        return;
      }
      const items = shuffle([target, ...wrongs]);
      t.blocks.forEach((b, i) => {
        b.item = items[i];
        b.isTarget = items[i].id === target.id;
      });
      t.target = target;
      // ipucu: normal modda her zaman, süper modda yalnız seviye 1
      t.hint = !isSuperRef.current || getGameItemLevel(target) === 1;
      trioRef.current = t;
      setQuestion(target.translit || target.label);
      playItem(target);
    };

    const hurt = () => {
      streak = 0;
      setStreak(0);
      s.ghostT = GHOST_TIME;
      s.vy = -320;
      loseLife();
    };

    const resolveTrio = (t: TrioEnt, b: BlockEnt) => {
      const target = t.target!;
      const correct = b.isTarget;
      t.resolved = { correct };
      t.doneT = 0;
      recordGameAnswer(target, correct, { gameId: "platform" });
      if (correct) {
        playFeedback(true);
        streak += 1;
        setStreak(streak);
        score += 10 + Math.min(streak, 5) * 2;
        setScore(score);
        b.state = "good";
        for (const o of t.blocks) if (o !== b) o.state = "fade";
        if (!isSuperRef.current) { setFlash(true); setTimeout(() => setFlash(false), 450); }
        spawnConfetti(b.x + BLOCK / 2, b.y + BLOCK / 2);
        spawnCoinTrail(target);
      } else {
        playFeedback(false);
        streak = 0;
        setStreak(0);
        score = Math.max(0, score - 5);
        setScore(score);
        for (const o of t.blocks) o.state = o === b ? "bad" : o.isTarget ? "good" : "fade";
        // Yanlış cevaplanan harf, moddan bağımsız tekrar sorulsun
        enqueueRetryItem(target);
        showBanner(`Doğrusu: ${target.translit || target.label}`, "bad", 1800);
        loseLife(true);
      }
    };

    // --- simülasyon adımı ---
    const step = (dt: number) => {
      if (over) return;
      const c = controls.current;
      s.time += dt;

      // hareketli platformlar (üstündeysek bizi de taşır)
      for (const so of w.solids) {
        if (!so.mover) continue;
        const ny = so.mover.baseY + Math.sin(s.time * so.mover.speed + so.mover.phase) * so.mover.range;
        const dy = ny - so.y;
        so.y = ny;
        if (standSolid === so && s.grounded) s.y += dy;
      }

      // bayrağa ulaşınca: kısa kutlama, sonra bölüm tamam
      if (!winning && s.x + PW / 2 >= flagX) {
        winning = true;
        winT = 1.15;
        winBurst = 0;
        playFeedback(true);
        unlockLevel(lv + 1);
        setUnlocked(getUnlockedLevel());
      }
      if (winning) {
        c.moveDir = 0;
        c.jumpQueued = false;
        winT -= dt;
        winBurst -= dt;
        if (winBurst <= 0) {
          winBurst = 0.25;
          spawnConfetti(flagX + (Math.random() - 0.5) * 60, GROUND_Y - 120 - Math.random() * 40);
        }
        if (winT <= 0) {
          over = true;
          setWon(true);
          return;
        }
      }

      // yatay hareket (geri gitmek serbest ama kamera geri dönmez)
      const mv = winning ? 0 : c.moveDir;
      if (mv !== 0) s.facing = mv;
      s.x += mv * RUN_SPEED * dt;
      if (s.x < s.camX + 14) s.x = s.camX + 14;
      s.anim += dt * (mv !== 0 && s.grounded ? 1 : 0.2);

      // zıplama: tampon + coyote — çocuklar için affedici
      if (c.jumpQueued) { c.jumpQueued = false; s.jumpBuf = JUMP_BUFFER; }
      else if (s.jumpBuf > 0) s.jumpBuf -= dt;
      if (!s.grounded) s.coyote = Math.max(0, s.coyote - dt);
      if (s.jumpBuf > 0 && (s.grounded || s.coyote > 0)) {
        s.vy = JUMP_V;
        s.grounded = false;
        s.coyote = 0;
        s.jumpBuf = 0;
        standSolid = null;
      }
      if (!c.jumpHeld && s.vy < JUMP_CUT) s.vy = JUMP_CUT;

      // dikey fizik + tek yönlü iniş (platformlara alttan geçilir)
      const prevFeet = s.y + PH;
      const fallV = s.vy;
      s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
      s.y += s.vy * dt;
      s.grounded = false;
      const wasStand = standSolid;
      standSolid = null;
      if (s.vy >= 0) {
        for (const so of w.solids) {
          if (s.x + PW <= so.x || s.x >= so.x + so.w) continue;
          if (prevFeet <= so.y + (so.mover ? 7 : 3) && s.y + PH >= so.y) {
            s.y = so.y - PH;
            s.vy = 0;
            s.grounded = true;
            standSolid = so;
            if (!so.oneWay) s.safeX = Math.min(Math.max(s.x, so.x + 8), so.x + so.w - PW - 8);
          }
        }
      }
      if (s.grounded) {
        s.coyote = COYOTE;
        if (!wasStand && fallV > 560) spawnDust(s.x + PW / 2, s.y + PH);
      }
      if (s.ghostT > 0) s.ghostT = Math.max(0, s.ghostT - dt);

      // zıplama yayları
      for (const sp of w.springs) {
        if (sp.t > 0) sp.t = Math.max(0, sp.t - dt);
        const topY = sp.y - 16;
        if (s.vy >= 0 && s.x + PW > sp.x - 16 && s.x < sp.x + 16 && prevFeet <= topY + 6 && s.y + PH >= topY - 2) {
          s.vy = SPRING_V;
          s.grounded = false;
          standSolid = null;
          sp.t = 0.35;
          spawnDust(sp.x, topY);
          w.pops.push({ x: sp.x, y: topY - 14, vx: 0, vy: -80, t: 0, life: 0.6, color: "#ef4444", text: "BOING!" });
        }
      }

      // çukura düşme → can kaybı + güvenli yerde yeniden doğ
      if (s.y > VH + 90) {
        loseLife();
        if (!over) {
          s.x = respawnX();
          s.y = GROUND_Y - PH - 80;
          s.vy = 0;
          s.ghostT = GHOST_TIME;
          standSolid = null;
        }
      }

      // kestaneler: devriye + çarpışma (üstten ez / yandan hasar al)
      for (let i = w.enemies.length - 1; i >= 0; i--) {
        const e = w.enemies[i];
        if (e.squashT > 0) {
          e.squashT -= dt;
          if (e.squashT <= 0) w.enemies.splice(i, 1);
          continue;
        }
        e.x += e.dir * ENEMY_SPEED * dt;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x + EW > e.maxX) { e.x = e.maxX - EW; e.dir = -1; }
        if (s.x + PW > e.x + 4 && s.x < e.x + EW - 4 && s.y + PH > e.y && s.y < e.y + EH) {
          if (s.vy > 0 && prevFeet <= e.y + 10) {
            e.squashT = 0.45;
            s.vy = -400;
            score += 5;
            setScore(score);
            w.pops.push({ x: e.x + EW / 2, y: e.y - 8, vx: 0, vy: -70, t: 0, life: 0.7, color: "#92400e", text: "+5" });
          } else if (s.ghostT <= 0) {
            hurt();
          }
        }
      }

      // uçan kuşlar
      for (let i = w.flyers.length - 1; i >= 0; i--) {
        const f = w.flyers[i];
        if (f.squashT > 0) {
          f.squashT -= dt;
          if (f.squashT <= 0) w.flyers.splice(i, 1);
          continue;
        }
        f.t += dt;
        f.x += f.dir * FLYER_SPEED * dt;
        if (f.x < f.minX) { f.x = f.minX; f.dir = 1; }
        if (f.x + FW > f.maxX) { f.x = f.maxX - FW; f.dir = -1; }
        f.y = f.baseY + Math.sin(f.t * 2.2) * f.amp;
        if (s.x + PW > f.x + 3 && s.x < f.x + FW - 3 && s.y + PH > f.y && s.y < f.y + FH) {
          if (s.vy > 0 && prevFeet <= f.y + 9) {
            f.squashT = 0.4;
            s.vy = -420;
            score += 8;
            setScore(score);
            w.pops.push({ x: f.x + FW / 2, y: f.y - 8, vx: 0, vy: -70, t: 0, life: 0.7, color: "#7c3aed", text: "+8" });
          } else if (s.ghostT <= 0) {
            hurt();
          }
        }
      }

      // soru üçlüleri
      for (let i = w.trios.length - 1; i >= 0; i--) {
        const t = w.trios[i];
        if (!t.announced && t.left < s.camX + view.w + 80) announceTrio(t);
        if (!t.resolved) {
          if (t.announced && t.target) {
            for (const b of t.blocks) {
              if (s.x + PW > b.x && s.x < b.x + BLOCK && s.y + PH > b.y && s.y < b.y + BLOCK) {
                resolveTrio(t, b);
                break;
              }
            }
            if (!t.resolved && s.x - t.right > 130) {
              // dokunmadan geçti: cevap sayılmaz, aynı harf sonra tekrar gelir
              t.resolved = { correct: false, missed: true };
              for (const b of t.blocks) b.state = "fade";
              enqueueRetryItem(t.target);
              showBanner("Harfi kaçırdın — tekrar gelecek 🔁", "bad", 1500);
            }
          }
        } else {
          t.doneT += dt;
          if (t.doneT > 1.1) w.trios.splice(i, 1);
        }
      }

      // harf paraları
      for (const cn of w.coins) {
        if (cn.taken) continue;
        if (s.x + PW > cn.x - COIN_R && s.x < cn.x + COIN_R && s.y + PH > cn.y - COIN_R && s.y < cn.y + COIN_R) {
          cn.taken = true;
          score += 2;
          setScore(score);
          w.pops.push({ x: cn.x, y: cn.y - 12, vx: 0, vy: -60, t: 0, life: 0.7, color: "#b45309", text: "+2" });
        }
      }

      // parçacıklar
      for (let i = w.pops.length - 1; i >= 0; i--) {
        const p = w.pops[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.grav) p.vy += 500 * dt;
        if (p.t >= p.life) w.pops.splice(i, 1);
      }

      // kamera + temizlik (dünya baştan üretildi — akış üretimi yok)
      s.camX = Math.max(s.camX, Math.min(s.x - view.w * 0.38, castleX + 220 - view.w));
      cleanT -= dt;
      if (cleanT <= 0) {
        cleanT = 1;
        const cut = s.camX - 280;
        w.solids = w.solids.filter((so) => so.x + so.w > cut);
        w.enemies = w.enemies.filter((e) => e.maxX > cut);
        w.flyers = w.flyers.filter((f) => f.maxX > cut);
        w.springs = w.springs.filter((sp) => sp.x > cut);
        w.coins = w.coins.filter((cn) => !cn.taken && cn.x > cut);
        w.trios = w.trios.filter((t) => t.right > cut - 100);
      }
    };

    // --- çizim ---
    const draw = () => {
      const g = ctx;
      g.setTransform(dpr * kScale, 0, 0, dpr * kScale, 0, 0);
      const grad = g.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, theme.skyTop);
      grad.addColorStop(1, theme.skyBottom);
      g.fillStyle = grad;
      g.fillRect(0, 0, view.w + 2, VH + 2);
      if (theme.stars) drawStars(g, view.w, s.time);
      drawCelestial(g, theme, view.w, s.time);
      if (theme.cloud) drawClouds(g, s.camX, view.w, theme.cloud);
      if (theme.birds) drawBirds(g, view.w, s.time);
      drawHills(g, s.camX, view.w, theme, s.time);

      g.save();
      g.translate(-s.camX, 0);
      const l = s.camX - 70, r = s.camX + view.w + 70;

      for (const so of w.solids) {
        if (so.x + so.w < l || so.x > r) continue;
        if (so.oneWay) drawPlatform(g, so, theme);
        else drawGroundSolid(g, so, theme, s.time);
      }

      // ateşböcekleri (gece teması) — zemin dekorunun üstünde süzülür
      if (theme.fireflies) {
        const i0 = Math.floor(l / 140), i1 = Math.ceil(r / 140);
        for (let i = i0; i <= i1; i++) {
          const fx = i * 140 + hash01(i) * 100;
          const fy = GROUND_Y - 26 - hash01(i * 3) * 90 + Math.sin(s.time * 1.6 + i) * 10;
          const a = 0.3 + 0.7 * Math.abs(Math.sin(s.time * 2.3 + i * 1.7));
          g.globalAlpha = a * 0.35;
          g.fillStyle = "#fde047";
          g.beginPath(); g.arc(fx, fy, 5, 0, Math.PI * 2); g.fill();
          g.globalAlpha = a;
          g.beginPath(); g.arc(fx, fy, 1.8, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      }

      if (150 > l && 150 < r) drawStartSign(g, 150);
      if (castleX + 160 > l && castleX < r) drawCastle(g, castleX);
      if (flagX + 60 > l && flagX - 20 < r) drawFlag(g, flagX, s.time);

      for (const sp of w.springs) {
        if (sp.x + 20 < l || sp.x - 20 > r) continue;
        drawSpring(g, sp);
      }

      for (const cn of w.coins) {
        if (cn.taken || cn.x < l || cn.x > r) continue;
        const bob = Math.sin(s.time * 3 + cn.id) * 2.5;
        const spin = Math.abs(Math.cos(s.time * 3.4 + cn.id * 0.7)) * 0.75 + 0.25;
        g.save();
        g.translate(cn.x, cn.y + bob);
        g.scale(spin, 1);
        g.drawImage(glyphSprite(cn.glyph, "coin"), -COIN_R, -COIN_R, COIN_R * 2, COIN_R * 2);
        g.restore();
      }

      for (const t of w.trios) {
        if (t.right < l || t.left > r) continue;
        for (const b of t.blocks) {
          const bob = t.resolved ? 0 : Math.sin(s.time * 2.6 + b.x * 0.03) * 3;
          let bx = b.x, by = b.y + bob, alpha = 1;
          if (t.resolved) {
            const k = Math.min(1, t.doneT * 1.4);
            if (b.state === "fade") alpha = 1 - k;
            else if (b.state === "good") { by -= k * 34; alpha = 1 - k * 0.55; }
            else if (b.state === "bad") { bx += Math.sin(t.doneT * 34) * 3 * (1 - k); alpha = 1 - k * 0.55; }
          }
          if (alpha <= 0.02) continue;
          // ipucu halkası (sarı, nabız gibi atar)
          if (!t.resolved && t.announced && t.hint && b.isTarget) {
            const pulse = 1 + Math.sin(s.time * 5) * 0.05;
            g.save();
            g.translate(bx + BLOCK / 2, by + BLOCK / 2);
            g.scale(pulse, pulse);
            g.strokeStyle = "rgba(250,204,21,0.95)";
            g.lineWidth = 5;
            rr(g, -BLOCK / 2 - 7, -BLOCK / 2 - 7, BLOCK + 14, BLOCK + 14, 18);
            g.stroke();
            g.restore();
          }
          g.globalAlpha = alpha;
          if (b.state === "good" || b.state === "bad") {
            g.fillStyle = b.state === "good" ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)";
            rr(g, bx - 5, by - 5, BLOCK + 10, BLOCK + 10, 16);
            g.fill();
          }
          const sprite = t.announced && b.item
            ? glyphSprite(b.item.emoji || "?", "block")
            : glyphSprite("?", "mystery");
          g.drawImage(sprite, bx, by, BLOCK, BLOCK);
          g.globalAlpha = 1;
        }
      }

      for (const e of w.enemies) {
        if (e.x + EW < l || e.x > r) continue;
        drawEnemy(g, e, s.time);
      }
      for (const f of w.flyers) {
        if (f.x + FW < l || f.x > r) continue;
        drawFlyer(g, f, s.time);
      }

      drawPlayerChar(g, s.x, s.y, s.facing, s.anim, s.grounded, s.ghostT, s.time);

      for (const p of w.pops) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.text) {
          g.font = "bold 15px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillStyle = p.color;
          g.fillText(p.text, p.x, p.y);
        } else {
          g.fillStyle = p.color;
          g.fillRect(p.x - 3, p.y - 3, 6, 6);
        }
        g.globalAlpha = 1;
      }
      g.restore();

      if (theme.snow) drawSnow(g, view.w, s.time);
    };

    // bölüm ilerleme çubuğu — düşük frekans HUD güncellemesi
    const progId = setInterval(() => {
      setProgress(Math.max(0, Math.min(100, Math.round(((s.x - 80) / (flagX - 80)) * 100))));
    }, 250);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, DT_MAX);
      last = now;
      const c = controls.current;
      if (!c.paused && !c.over) step(dt);
      else if (winning && !over) step(dt); // kutlama akmaya devam etsin
      draw();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(progId);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTick]);

  // klavye (masaüstü)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); controls.current.moveDir = -1; }
      else if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); controls.current.moveDir = 1; }
      else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
        e.preventDefault();
        if (started && paused && !gameOver && !won) { start(); return; }
        if (!e.repeat) { controls.current.jumpQueued = true; controls.current.jumpHeld = true; }
      } else if (e.code === "KeyR") { e.preventDefault(); replay(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") { if (controls.current.moveDir === -1) controls.current.moveDir = 0; }
      else if (e.code === "ArrowRight" || e.code === "KeyD") { if (controls.current.moveDir === 1) controls.current.moveDir = 0; }
      else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") controls.current.jumpHeld = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [paused, gameOver, won, started, start, replay]);

  // basılı tutulan yön butonları (mobil)
  const holdMove = (dir: -1 | 1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      controls.current.moveDir = dir;
    },
    onPointerUp: () => { if (controls.current.moveDir === dir) controls.current.moveDir = 0; },
    onPointerCancel: () => { if (controls.current.moveDir === dir) controls.current.moveDir = 0; },
    onPointerLeave: () => { if (controls.current.moveDir === dir) controls.current.moveDir = 0; },
  });

  const jumpDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (started && paused && !gameOver && !won) { start(); return; }
    controls.current.jumpQueued = true;
    controls.current.jumpHeld = true;
  };
  const jumpUp = () => { controls.current.jumpHeld = false; };

  // sahneye dokunmak da zıplatır (büyük hedef alanı)
  const onCanvasDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (paused || gameOver || won || !started) return;
    controls.current.jumpQueued = true;
    controls.current.jumpHeld = true;
  };
  const onCanvasUp = () => {
    controls.current.jumpHeld = false;
    if (started && paused && !gameOver && !won) start();
  };

  const theme = THEMES[level - 1];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🍄 Harf Macerası" backTo="/oyunlar" centered onReset={toPicker} />

        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Puan</div>
            <div className="text-xl font-extrabold text-success">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-destructive/30 flex flex-col items-center">
            <div className="text-[10px] font-bold text-muted-foreground">Can</div>
            <div className="flex gap-0.5 mt-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart key={i} className={cn("h-4 w-4", i < lives ? "fill-destructive text-destructive" : "text-muted")} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-warning/30">
            <div className="text-[10px] font-bold text-muted-foreground">Seri</div>
            <div className="text-xl font-extrabold text-warning">🔥{streak}</div>
          </div>
        </div>

        {/* bölüm + ilerleme çubuğu */}
        {started && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-muted-foreground whitespace-nowrap">
              Bölüm {level} • {theme.name} {theme.emoji}
            </span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden border border-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-success to-warning transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm">🚩</span>
          </div>
        )}

        {/* SORU — yazılı + sesli */}
        <div className="mb-2 flex items-center justify-center">
          <button
            onClick={replay}
            className="flex items-center gap-3 rounded-2xl bg-card border-2 border-primary/40 px-5 py-2 shadow-card active:scale-95"
          >
            <span className="text-xs font-bold text-muted-foreground">🎯 Hangisi:</span>
            <span className="text-3xl font-extrabold text-primary">{question ?? "—"}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Volume2 className="h-4 w-4" />
            </span>
          </button>
        </div>

        <div
          ref={boxRef}
          onPointerDown={onCanvasDown}
          onPointerUp={onCanvasUp}
          className="relative w-full overflow-hidden rounded-2xl shadow-card border-4 border-warning/40 select-none touch-none bg-sky-200"
          style={{ aspectRatio: "16 / 10", maxHeight: "60vh", margin: "0 auto", contain: "layout paint size" }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* normal modda doğru cevap ışığı */}
          {flash && (
            <div
              className="pointer-events-none absolute inset-0 z-10 animate-fade-in"
              style={{ background: "radial-gradient(circle at 50% 55%, hsl(var(--success)/0.5), transparent 62%)" }}
            />
          )}

          {/* duraklat */}
          {started && !paused && !gameOver && !won && (
            <button
              onClick={() => setPaused(true)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              aria-label="Duraklat"
              className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground shadow-soft"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}

          {/* olay bildirimi */}
          {banner && (
            <div
              className={cn(
                "pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-2xl px-4 py-2 font-extrabold text-white shadow-card animate-bounce-in whitespace-nowrap",
                banner.tone === "good" && "bg-success",
                banner.tone === "bad" && "bg-destructive",
              )}
            >
              {banner.text}
            </div>
          )}

          {/* bölüm seçme ekranı */}
          {!started && !gameOver && !won && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2.5 bg-background/90 p-3">
              <div className="text-lg font-extrabold text-warning">🍄 Bölüm Seç</div>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {THEMES.map((t, i) => {
                  const lv = i + 1;
                  const locked = lv > unlocked;
                  return (
                    <button
                      key={lv}
                      disabled={locked}
                      onClick={() => startLevel(lv)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-2xl border-2 px-1 py-1.5 w-[54px] sm:w-16 transition-bouncy",
                        locked
                          ? "bg-muted/50 border-border opacity-60"
                          : "bg-card border-warning/50 shadow-soft active:scale-95 hover:-translate-y-0.5",
                      )}
                    >
                      <span className="text-xl sm:text-2xl leading-none">{locked ? "🔒" : t.emoji}</span>
                      <span className="text-[11px] font-extrabold text-foreground mt-0.5">{lv}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] font-bold text-muted-foreground text-center leading-relaxed px-4">
                Sesi dinle, doğru harf bloğuna dokun! Bayrağa ulaşınca bölüm biter 🚩<br />
                ◀ ▶ yürü • Zıpla • kestaneleri üstten ez 🌰 • yaylarla uç 🔴
              </div>
            </div>
          )}

          {/* duraklatıldı — sahne görünür kalır */}
          {started && paused && !gameOver && !won && (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <div className="rounded-2xl bg-background/90 px-6 py-4 text-center shadow-card border-2 border-border">
                <div className="text-lg font-extrabold text-foreground mb-1">⏸ Duraklatıldı</div>
                <div className="text-xs font-bold text-muted-foreground">Devam için dokun</div>
              </div>
            </div>
          )}

          {/* bölüm tamamlandı */}
          {won && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/95">
              <div className="text-4xl mb-1">🎉</div>
              <div className="text-2xl font-extrabold text-success mb-1">Bölüm {level} Tamam!</div>
              <div className="text-2xl mb-1">{"⭐".repeat(Math.max(1, lives))}</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">Puan: {score}</div>
              <div className="flex gap-2">
                {level < LEVEL_COUNT ? (
                  <button
                    onClick={() => startLevel(level + 1)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    className="rounded-full bg-success text-success-foreground px-5 py-3 font-extrabold shadow-soft active:scale-95"
                  >
                    Sonraki Bölüm ▶
                  </button>
                ) : (
                  <div className="rounded-full bg-warning text-warning-foreground px-5 py-3 font-extrabold shadow-soft">
                    🏆 Hepsini bitirdin!
                  </div>
                )}
                <button
                  onClick={toPicker}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  className="rounded-full bg-primary text-primary-foreground px-5 py-3 font-extrabold shadow-soft active:scale-95"
                >
                  Bölümler
                </button>
              </div>
            </div>
          )}

          {/* oyun bitti */}
          {gameOver && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/95">
              <div className="text-4xl mb-2">😢</div>
              <div className="text-2xl font-extrabold text-destructive mb-2">Oyun Bitti</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">Puan: {score}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => startLevel(level)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  className="rounded-full bg-primary text-primary-foreground px-5 py-3 font-extrabold shadow-soft active:scale-95"
                >
                  Tekrar Dene
                </button>
                <button
                  onClick={toPicker}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  className="rounded-full bg-muted text-foreground px-5 py-3 font-extrabold shadow-soft active:scale-95 border-2 border-border"
                >
                  Bölümler
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground">
          ◀ ▶ yürü • Zıpla • Doğru harf bloğuna dokun, bayrağa koş! 🚩
        </p>

        <div className="mt-2 flex gap-2">
          <button
            {...holdMove(-1)}
            aria-label="Sola yürü"
            className="flex-1 rounded-2xl bg-primary text-primary-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center touch-none select-none"
          >
            <ArrowLeft className="h-7 w-7" />
          </button>
          <button
            {...holdMove(1)}
            aria-label="Sağa yürü"
            className="flex-1 rounded-2xl bg-primary text-primary-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center touch-none select-none"
          >
            <ArrowRight className="h-7 w-7" />
          </button>
          <button
            onPointerDown={jumpDown}
            onPointerUp={jumpUp}
            onPointerCancel={jumpUp}
            onPointerLeave={jumpUp}
            aria-label="Zıpla"
            className="flex-[1.4] rounded-2xl bg-info text-info-foreground py-5 font-extrabold shadow-soft active:scale-95 flex items-center justify-center gap-1 touch-none select-none"
          >
            <ArrowUp className="h-7 w-7" /> Zıpla
          </button>
        </div>

        {started && paused && !gameOver && !won && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-full bg-success text-success-foreground px-6 py-2.5 font-extrabold shadow-soft active:scale-95"
            >
              <Play className="h-5 w-5" /> Devam Et
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PlatformGame;
