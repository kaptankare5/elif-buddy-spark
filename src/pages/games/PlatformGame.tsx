// 🕌 "Elif Ba Macerası" — 2D yandan kaydırmalı platform macera oyunu.
//
// 10 BÖLÜM: her bölüm farklı temalı (çayır, orman, sahil, çöl, gün batımı,
// kar, gece, şeker, uzay, gökkuşağı), soldan sağa koşulur ve bölüm sonundaki
// CAMİYE ulaşınca biter (kubbe + minareler + kutlama). Bölüm ilerledikçe
// çukur/canavar artar; zıplama yayı, hareketli platform, merdiven eklenir.
// İlerleme localStorage'da tutulur; bir bölümü bitirince sonraki açılır.
//
// CANAVARLAR (şiddetsiz tasarım — bilinçli tercih):
// 4 tür: yürüyen kestane, zıplayan kurbağa, dikey süzülen baloncuk, uçan kuş.
// Yok etme/öldürme YOK: üstüne basmak zarar vermez (oyuncu seker, canavar
// kısa süre sersemler); yandan dokunursan can gidersin. Doğru cevap ödülü
// "NUR" aktifken dokunduğun canavar GÜVERCİNE DÖNÜŞÜP özgürce uçar gider —
// kimse zarar görmez, çocuk yine de güçlü hisseder.
//
// Para/altın yerine HARF toplanır: sesli + yazılı soru hedef harfi verir,
// yolda 3 harf bloğu belirir; doğru bloğa dokununca puan + seri + ÖDÜL
// (+1 can / Nur / mıknatıs / 2X puan / harf yağmuru) — soruları cazip kılar.
// Yanlışta CAN GİTMEZ (öğrenme hatası oyunu bitirmez): puan düşer, doğru
// blok yeşil gösterilir ve harf tekrar sorulur. Sorular bloklar GÖRÜNÜRKEN
// SRS'ten seçilir; cevaplar recordGameAnswer'dan geçer (süper modda hepsi,
// normal modda 3'te 1); ipucu halkası süper modda yalnız seviye 1'de.
// Mobil (Capacitor) öncelikli: büyük basılı-tut butonları, pointer olayları,
// dpr'a duyarlı tek <canvas>, arka planda otomatik durur, DT_MAX kelepçesi.
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback, playItem, playSfx } from "@/lib/audio";
import { gamePool, pickN, shuffle } from "./_shared";
import { enqueueRetryItem, getGameItemLevel, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { isTestUnlockActive } from "@/lib/testUnlock";
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
const WALKER_SPEED = 55;
const FLYER_SPEED = 70;
const DT_MAX = 0.05;          // sekme arkaplandan dönünce ışınlanmayı önler
const PW = 26, PH = 36;       // oyuncu çarpışma kutusu
const COYOTE = 0.1, JUMP_BUFFER = 0.12;
const GHOST_TIME = 2.0;       // hasar sonrası dokunulmazlık
const BLOCK = 54;             // harf bloğu kenarı
const COIN_R = 13;
const PLAT_H = 16;
const LEVEL_COUNT = 10;
const MAX_LIVES = 5;          // sorulardan +1 can kazanılabilir
const NUR_TIME = 10;          // ✨ Nur: canavarlar güvercine dönüşür
const MAG_TIME = 10;          // 🧲 mıknatıs: harf paraları oyuncuya akar
const X2_TIME = 12;           // ⭐ 2X puan
const FREED_DUR = 1.0;        // güvercine dönüşüp uçma animasyonu

// canavar çarpışma kutuları (tür bazlı)
type MonsterKind = "walker" | "hopper" | "floater" | "flyer";
const MW: Record<MonsterKind, number> = { walker: 30, hopper: 26, floater: 26, flyer: 26 };
const MH: Record<MonsterKind, number> = { walker: 24, hopper: 22, floater: 26, flyer: 20 };

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
  pit: string;         // yeraltı/uçurum içi rengi (çukurlar gökyüzü göstermez)
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
  { name: "Çayır", emoji: "🌼", skyTop: "#7ec3f0", skyBottom: "#eaf8ff", hillA: "#8fd889", hillB: "#a7e3a0", soil: "#c07a35", pit: "#4a2c12", grassA: "#5ec46a", grassB: "#3f9d45", tree: "tree", treeLeaf: "#4cae5b", trunk: "#8a5a34", celestial: "sun", cloud: "#ffffff", flower1: "#f472b6", flower2: "#facc15", birds: true },
  { name: "Orman", emoji: "🌲", skyTop: "#74b9e8", skyBottom: "#dff2fd", hillA: "#6fbf73", hillB: "#8fd889", soil: "#8a5a2c", pit: "#3b2410", grassA: "#4caf50", grassB: "#357a38", tree: "pine", treeLeaf: "#2f855a", trunk: "#6b4226", celestial: "sun", cloud: "#ffffff", flower1: "#fb7185", flower2: "#a3e635", birds: true },
  { name: "Sahil", emoji: "🏖️", skyTop: "#67c7f5", skyBottom: "#f3fbff", hillA: "#7dd3fc", hillB: "#a5e7ff", soil: "#d8ab60", pit: "#5d4322", grassA: "#f2d489", grassB: "#e0b96b", tree: "palm", treeLeaf: "#3fae5f", trunk: "#a9713d", celestial: "sun", cloud: "#ffffff", flower1: "#fda4af", flower2: "#fef08a", birds: true },
  { name: "Çöl", emoji: "🌵", skyTop: "#f7b267", skyBottom: "#ffe8c7", hillA: "#e8c07d", hillB: "#f2d49b", soil: "#c9945a", pit: "#5f3f1e", grassA: "#eec97f", grassB: "#d9a95f", tree: "cactus", treeLeaf: "#3f9d45", trunk: "#3f9d45", celestial: "sun", cloud: "#fff7ed", flower1: "#f87171", flower2: "#fbbf24", birds: true },
  { name: "Gün Batımı", emoji: "🌇", skyTop: "#8b5cf6", skyBottom: "#fb923c", hillA: "#6d28d9", hillB: "#8b5cf6", soil: "#7c4a24", pit: "#35200f", grassA: "#4d9e57", grassB: "#3b7f44", tree: "tree", treeLeaf: "#2f6b4f", trunk: "#573418", celestial: "sun", cloud: "#ffe4e6", flower1: "#fb7185", flower2: "#fdba74", birds: true },
  { name: "Kar", emoji: "❄️", skyTop: "#b8def5", skyBottom: "#f0faff", hillA: "#e6f3fb", hillB: "#ffffff", soil: "#8fa5ba", pit: "#3d4f63", grassA: "#ffffff", grassB: "#dcedf8", tree: "snowtree", treeLeaf: "#2f855a", trunk: "#6b4226", celestial: "sun", cloud: "#ffffff", flower1: "#93c5fd", flower2: "#e0f2fe", snow: true },
  { name: "Gece", emoji: "🌙", skyTop: "#1e293b", skyBottom: "#3b5578", hillA: "#14532d", hillB: "#166534", soil: "#5e3d1d", pit: "#1c1206", grassA: "#3f7d4a", grassB: "#2f5e38", tree: "tree", treeLeaf: "#1f7a44", trunk: "#3f2a14", celestial: "moon", cloud: "rgba(148,163,184,0.55)", flower1: "#a78bfa", flower2: "#f0abfc", stars: true, fireflies: true },
  { name: "Şeker", emoji: "🍭", skyTop: "#fbc7e4", skyBottom: "#fff0f7", hillA: "#f9a8d4", hillB: "#fbcfe8", soil: "#8d5b41", pit: "#41241a", grassA: "#7fe3c3", grassB: "#4cc9a6", tree: "candy", treeLeaf: "#f472b6", trunk: "#fefce8", celestial: "none", cloud: "#ffffff", flower1: "#f472b6", flower2: "#38bdf8", birds: true },
  { name: "Uzay", emoji: "🪐", skyTop: "#241b4d", skyBottom: "#4c3a8c", hillA: "#5b4a9e", hillB: "#7263b8", soil: "#565073", pit: "#241f38", grassA: "#9d94c4", grassB: "#7a71a8", tree: "none", treeLeaf: "#67e8f9", trunk: "#67e8f9", celestial: "planet", cloud: null, flower1: "#67e8f9", flower2: "#c084fc", stars: true },
  { name: "Gökkuşağı", emoji: "🌈", skyTop: "#7ec3f0", skyBottom: "#eaf8ff", hillA: "#86efac", hillB: "#fde68a", soil: "#c07a35", pit: "#4a2c12", grassA: "#5ec46a", grassB: "#3f9d45", tree: "tree", treeLeaf: "#4cae5b", trunk: "#8a5a34", celestial: "rainbow", cloud: "#ffffff", flower1: "#f43f5e", flower2: "#facc15", birds: true },
];

// Bölüm zorluk ayarı — seviye arttıkça uzar, canavar türü çeşitlenir
function levelConf(lv: number) {
  const kinds: MonsterKind[] = ["walker"];
  if (lv >= 2) kinds.push("hopper");
  if (lv >= 3) kinds.push("floater");
  if (lv >= 4) kinds.push("flyer");
  return {
    len: 2900 + lv * 380,
    monsterKinds: kinds,
    springs: lv >= 2,
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
interface MonsterEnt {
  id: number;
  kind: MonsterKind;
  x: number;
  y: number;
  dir: 1 | -1;
  minX: number;
  maxX: number;
  homeX: number;      // floater: yatay salınım merkezi
  baseY: number;      // floater/flyer: dikey salınım merkezi
  amp: number;
  t: number;
  vy: number;         // hopper
  grounded: boolean;  // hopper
  hopT: number;       // hopper: bir sonraki zıplamaya kalan süre
  groundY: number;    // üzerinde durduğu zeminin üst yüzeyi (teraslar için)
  calmT: number;      // üstüne basılınca sersemleme (zarar yok)
  freedT: number;     // Nur ile güvercine dönüşüp uçma (yok etme değil)
  golden?: boolean;   // 🌟 nadir ALTIN güvercin (~%3) — kozmetik sürpriz, bonus puan
}
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
interface CoinEnt { id: number; x: number; y: number; glyph: string; taken: boolean; heart?: boolean }
interface Pop { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; text?: string; grav?: boolean }
interface World {
  solids: SolidEnt[];
  monsters: MonsterEnt[];
  springs: SpringEnt[];
  trios: TrioEnt[];
  coins: CoinEnt[];
  pops: Pop[];
  cliffs: { x: number; w: number }[];   // geniş uçurumlar (görsel kaya duvarı + tabela)
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

function drawHills(g: CanvasRenderingContext2D, camX: number, vw: number, th: Theme) {
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

// ---- canavarlar (sevimli, şiddetsiz) ----

// Nur ile dönüşen güvercin — yukarı süzülüp kaybolur (kimse zarar görmez).
// golden=true: nadir ALTIN güvercin — altın tüyler + parıltı izi (kozmetik).
function drawDove(g: CanvasRenderingContext2D, x: number, y: number, dir: number, k: number, time: number, golden = false) {
  const dx = x + k * 46 * dir;
  const dy = y - k * 82;
  g.save();
  g.globalAlpha = Math.max(0, 1 - k * 0.85);
  g.translate(dx, dy);
  g.scale(dir, 1);
  // ilk anda ışık parlaması
  if (k < 0.25) {
    g.globalAlpha = (0.25 - k) * 3;
    g.fillStyle = "#fde047";
    g.beginPath(); g.arc(0, 0, (golden ? 26 : 20) * (1 - k), 0, Math.PI * 2); g.fill();
    g.globalAlpha = Math.max(0, 1 - k * 0.85);
  }
  // altın güvercin: arkasında süzülen parıltı izi
  if (golden) {
    g.fillStyle = "#fde047";
    for (let i = 1; i <= 4; i++) {
      const a = time * 7 + i * 1.7;
      g.globalAlpha = Math.max(0, (1 - k * 0.85) * (0.5 - i * 0.1));
      g.beginPath();
      g.arc(-10 - i * 7, Math.sin(a) * 4 + i * 3, 2.6 - i * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = Math.max(0, 1 - k * 0.85);
  }
  const body = golden ? "#fcd34d" : "#ffffff";
  const wing = golden ? "#fbbf24" : "#f1f5f9";
  // gövde + kuyruk
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, 0, 10, 6.2, -0.15, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-9, 0);
  g.lineTo(-16, -4);
  g.lineTo(-15, 3);
  g.closePath();
  g.fill();
  // baş + gaga + göz
  g.beginPath(); g.arc(9, -4, 4.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = golden ? "#d97706" : "#f59e0b";
  g.beginPath();
  g.moveTo(12.5, -4.5); g.lineTo(16.5, -3.4); g.lineTo(12.5, -2.2);
  g.closePath(); g.fill();
  g.fillStyle = "#1f2937";
  g.beginPath(); g.arc(10, -4.6, 1, 0, Math.PI * 2); g.fill();
  // çırpan kanat
  const wf = Math.sin(time * 18) * 0.9;
  g.fillStyle = wing;
  g.save();
  g.translate(-1, -2);
  g.rotate(-0.5 + wf * 0.55);
  g.beginPath();
  g.ellipse(0, -7, 11, 4.6, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.restore();
}

// sersemleme yıldızları (üstüne basılınca — zarar görmez, kısa süre şaşkın)
function drawDizzyStars(g: CanvasRenderingContext2D, cx: number, cy: number, time: number) {
  g.fillStyle = "#fde047";
  for (let k = 0; k < 2; k++) {
    const a = time * 6 + k * Math.PI;
    g.beginPath();
    g.arc(cx + Math.cos(a) * 12, cy + Math.sin(a) * 3 - 4, 2.4, 0, Math.PI * 2);
    g.fill();
  }
}

function drawMonster(g: CanvasRenderingContext2D, m: MonsterEnt, time: number) {
  if (m.freedT > 0) {
    drawDove(g, m.x + MW[m.kind] / 2, m.y + MH[m.kind] / 2, m.dir, 1 - m.freedT / FREED_DUR, time, m.golden);
    return;
  }
  const w = MW[m.kind], h = MH[m.kind];
  const calm = m.calmT > 0;
  switch (m.kind) {
    case "walker": {
      g.save();
      g.translate(m.x + w / 2, m.y + h);
      g.scale(1, calm ? 0.8 : 1);
      g.fillStyle = "#92400e";
      g.beginPath();
      g.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.fill();
      const step = calm ? 0 : Math.sin(time * 10 + m.id) * 3;
      g.fillStyle = "#451a03";
      g.beginPath();
      g.ellipse(-8 + step, -2, 6, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(8 - step, -2, 6, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(-5, -h / 2 - 3, 3.4, 0, Math.PI * 2);
      g.arc(5, -h / 2 - 3, 3.4, 0, Math.PI * 2);
      g.fill();
      if (calm) {
        // şaşkın kapalı gözler
        g.strokeStyle = "#1f2937";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-7, -h / 2 - 3); g.lineTo(-3, -h / 2 - 3);
        g.moveTo(3, -h / 2 - 3); g.lineTo(7, -h / 2 - 3);
        g.stroke();
      } else {
        g.fillStyle = "#1f2937";
        g.beginPath();
        g.arc(-4.4 + m.dir, -h / 2 - 3, 1.5, 0, Math.PI * 2);
        g.arc(5.6 + m.dir, -h / 2 - 3, 1.5, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      break;
    }
    case "hopper": {
      // zıplayan kurbağa: yerdeyken çömelir, havada gerilir
      const stretch = !m.grounded ? 1.14 : m.hopT < 0.16 ? 0.68 : 1 - Math.abs(Math.sin(time * 3 + m.id)) * 0.05;
      g.save();
      g.translate(m.x + w / 2, m.y + h);
      g.scale(1, calm ? 0.75 : stretch);
      g.fillStyle = "#4ade80";
      rr(g, -w / 2, -h, w, h, 9);
      g.fill();
      g.fillStyle = "#bbf7d0";
      g.beginPath();
      g.ellipse(0, -h * 0.32, w * 0.3, h * 0.26, 0, 0, Math.PI * 2);
      g.fill();
      // arka bacaklar
      g.fillStyle = "#22c55e";
      g.beginPath();
      g.ellipse(-w / 2 + 2, -3, 5.5, 3.4, 0, 0, Math.PI * 2);
      g.ellipse(w / 2 - 2, -3, 5.5, 3.4, 0, 0, Math.PI * 2);
      g.fill();
      // patlak gözler
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(-6, -h + 1, 4, 0, Math.PI * 2);
      g.arc(6, -h + 1, 4, 0, Math.PI * 2);
      g.fill();
      if (calm) {
        g.strokeStyle = "#14532d";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-8, -h + 1); g.lineTo(-4, -h + 1);
        g.moveTo(4, -h + 1); g.lineTo(8, -h + 1);
        g.stroke();
      } else {
        g.fillStyle = "#14532d";
        g.beginPath();
        g.arc(-5.4 + m.dir * 1.2, -h + 1, 1.7, 0, Math.PI * 2);
        g.arc(6.6 + m.dir * 1.2, -h + 1, 1.7, 0, Math.PI * 2);
        g.fill();
      }
      // ağız
      g.strokeStyle = "#14532d";
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(0, -h * 0.42, 3.4, 0.3, Math.PI - 0.3);
      g.stroke();
      g.restore();
      break;
    }
    case "floater": {
      // dikey süzülen baloncuk: yuvarlak, tepe püsküllü, minik kanatlı
      g.save();
      g.translate(m.x + w / 2, m.y + h / 2);
      if (calm) g.scale(1, 0.8);
      // minik kanatlar
      const wf = Math.sin(time * 12 + m.id) * 0.8;
      g.fillStyle = "#a5f3fc";
      for (const sd of [-1, 1]) {
        g.save();
        g.translate(sd * (w / 2 - 1), -2);
        g.rotate(sd * (0.5 + wf * 0.4));
        g.beginPath();
        g.ellipse(sd * 5, 0, 7, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // gövde
      g.fillStyle = "#22d3ee";
      g.beginPath();
      g.arc(0, 0, w / 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#cffafe";
      g.beginPath();
      g.ellipse(0, 4, w * 0.3, h * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      // tepe püskülleri
      g.fillStyle = "#0891b2";
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.arc(k * 5.5, -w / 2 + 1.5, 2.6, 0, Math.PI * 2);
        g.fill();
      }
      // gözler
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(-4.6, -2, 3.6, 0, Math.PI * 2);
      g.arc(4.6, -2, 3.6, 0, Math.PI * 2);
      g.fill();
      if (calm) {
        g.strokeStyle = "#164e63";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-7, -2); g.lineTo(-2.5, -2);
        g.moveTo(2.5, -2); g.lineTo(7, -2);
        g.stroke();
      } else {
        g.fillStyle = "#164e63";
        g.beginPath();
        g.arc(-4, -2 + Math.sin(time * 1.5) * 1, 1.6, 0, Math.PI * 2);
        g.arc(5.2, -2 + Math.sin(time * 1.5) * 1, 1.6, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      break;
    }
    case "flyer": {
      g.save();
      g.translate(m.x + w / 2, m.y + h / 2);
      g.scale(m.dir, calm ? 0.75 : 1);
      g.fillStyle = "#7c3aed";
      g.beginPath();
      g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c4b5fd";
      g.beginPath();
      g.ellipse(1, 3, w / 3, h / 3.2, 0, 0, Math.PI * 2);
      g.fill();
      const wf = Math.sin(time * 13 + m.id) * 0.9;
      g.fillStyle = "#a78bfa";
      g.save();
      g.translate(-2, -2);
      g.rotate(wf * 0.6 - 0.3);
      g.beginPath();
      g.ellipse(0, -6, 9, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = "#f59e0b";
      g.beginPath();
      g.moveTo(w / 2 - 2, -2);
      g.lineTo(w / 2 + 6, 1);
      g.lineTo(w / 2 - 2, 4);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(5, -3, 3, 0, Math.PI * 2); g.fill();
      if (calm) {
        g.strokeStyle = "#1f2937";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(3.4, -3); g.lineTo(7, -3);
        g.stroke();
      } else {
        g.fillStyle = "#1f2937";
        g.beginPath(); g.arc(6, -3, 1.4, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      break;
    }
  }
  if (calm) drawDizzyStars(g, m.x + w / 2, m.y - 4, time);
}

// ---- bölüm sonu: cami + minareler ----

function drawCrescent(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, rot = -0.5) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, 0, r, 0.55, Math.PI * 2 - 0.55, false);
  g.arc(r * 0.45, 0, r * 0.68, Math.PI * 2 - 0.95, 0.95, true);
  g.closePath();
  g.fill();
  g.restore();
}

function drawMinaret(g: CanvasRenderingContext2D, x: number, baseY: number) {
  // gövde
  g.fillStyle = "#f6ead2";
  g.fillRect(x - 7, baseY - 128, 14, 128);
  g.fillStyle = "#e3d0ac";
  g.fillRect(x - 7, baseY - 128, 4, 128);
  // şerefe (balkon)
  g.fillStyle = "#d9bf93";
  rr(g, x - 12, baseY - 92, 24, 8, 3);
  g.fill();
  g.fillStyle = "#b89b6c";
  for (let k = -1; k <= 1; k++) g.fillRect(x + k * 8 - 1, baseY - 86, 2, 5);
  // petek (üst daralan bölüm)
  g.fillStyle = "#f6ead2";
  g.fillRect(x - 5, baseY - 148, 10, 20);
  // külah (koni)
  g.fillStyle = "#2ea394";
  g.beginPath();
  g.moveTo(x - 9, baseY - 148);
  g.lineTo(x + 9, baseY - 148);
  g.lineTo(x, baseY - 176);
  g.closePath();
  g.fill();
  // alem + hilal
  g.fillStyle = "#d4a017";
  g.fillRect(x - 1, baseY - 186, 2, 10);
  drawCrescent(g, x, baseY - 189, 5, "#d4a017", -0.4);
}

function drawMosque(g: CanvasRenderingContext2D, x: number, time: number) {
  const by = GROUND_Y;
  const bw = 170;   // ana gövde genişliği
  // minareler (iki yanda)
  drawMinaret(g, x - 26, by);
  drawMinaret(g, x + bw + 26, by);
  // ana gövde
  g.fillStyle = "#f6ead2";
  rr(g, x, by - 78, bw, 78, 6);
  g.fill();
  // gövde süs bandı
  g.fillStyle = "#e8d7b4";
  g.fillRect(x, by - 78, bw, 8);
  // büyük kubbe
  g.fillStyle = "#2ea394";
  g.beginPath();
  g.arc(x + bw / 2, by - 76, 52, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3fc0ae";
  g.beginPath();
  g.arc(x + bw / 2 - 14, by - 78, 40, Math.PI + 0.35, Math.PI * 1.6);
  g.lineTo(x + bw / 2 - 14, by - 78);
  g.closePath();
  g.fill();
  // kubbe alemi + hilal
  g.fillStyle = "#d4a017";
  g.fillRect(x + bw / 2 - 1.5, by - 140, 3, 14);
  drawCrescent(g, x + bw / 2, by - 145, 6.5, "#d4a017", -0.4);
  // küçük yan kubbeler
  for (const sx of [x + 26, x + bw - 26]) {
    g.fillStyle = "#2ea394";
    g.beginPath();
    g.arc(sx, by - 78, 18, Math.PI, Math.PI * 2);
    g.fill();
  }
  // kemerli pencereler
  g.fillStyle = "#8a6b3f";
  for (const wx of [x + 30, x + bw - 30]) {
    g.beginPath();
    g.arc(wx, by - 42, 8, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(wx - 8, by - 42, 16, 22);
  }
  g.fillStyle = "#fde68a";
  for (const wx of [x + 30, x + bw - 30]) {
    g.beginPath();
    g.arc(wx, by - 42, 5.5, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(wx - 5.5, by - 42, 11, 19);
  }
  // ana kapı (sivri kemer) — hedef burası, hafifçe parlar
  const glow = 0.55 + Math.sin(time * 3) * 0.2;
  g.fillStyle = "#7a5b32";
  g.beginPath();
  g.arc(x + bw / 2, by - 34, 17, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(x + bw / 2 - 17, by - 34, 34, 34);
  g.fillStyle = `rgba(253,230,138,${glow})`;
  g.beginPath();
  g.arc(x + bw / 2, by - 32, 12.5, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(x + bw / 2 - 12.5, by - 32, 25, 32);
  g.fillStyle = "#7a5b32";
  g.fillRect(x + bw / 2 - 1, by - 30, 2, 30);
  // basamaklar
  g.fillStyle = "#d9c49a";
  rr(g, x + bw / 2 - 26, by - 5, 52, 5, 2);
  g.fill();
}

// Uçurum: kenarlarda ışık alan kaya duvarları + dipte siluet kayalar +
// solda uyarı tabelası (yeraltı katmanının üstüne çizilir)
function drawCliff(g: CanvasRenderingContext2D, x: number, w: number) {
  g.fillStyle = "rgba(196,132,72,0.35)";
  g.beginPath();
  g.moveTo(x, GROUND_Y);
  g.lineTo(x + 13, GROUND_Y + 34);
  g.lineTo(x + 7, VH + 20);
  g.lineTo(x, VH + 20);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(x + w, GROUND_Y);
  g.lineTo(x + w - 13, GROUND_Y + 34);
  g.lineTo(x + w - 7, VH + 20);
  g.lineTo(x + w, VH + 20);
  g.closePath();
  g.fill();
  // dipte sivri siluet kayalar
  g.fillStyle = "#0c0703";
  const n = Math.max(2, Math.floor(w / 22));
  for (let i = 0; i < n; i++) {
    const rx = x + 6 + (i + 0.5) * ((w - 12) / n);
    const rh = 16 + hash01(x + i) * 14;
    g.beginPath();
    g.moveTo(rx - 8, VH + 4);
    g.lineTo(rx + 8, VH + 4);
    g.lineTo(rx, VH + 4 - rh);
    g.closePath();
    g.fill();
  }
  // uyarı tabelası (sol kenarda)
  const sx = x - 16;
  g.fillStyle = "#8a5a34";
  g.fillRect(sx - 2, GROUND_Y - 26, 4, 26);
  g.fillStyle = "#facc15";
  g.beginPath();
  g.moveTo(sx - 12, GROUND_Y - 26);
  g.lineTo(sx + 12, GROUND_Y - 26);
  g.lineTo(sx, GROUND_Y - 46);
  g.closePath();
  g.fill();
  g.strokeStyle = "#92400e";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#92400e";
  g.fillRect(sx - 1.5, GROUND_Y - 41, 3, 8.5);
  g.beginPath();
  g.arc(sx, GROUND_Y - 30.5, 1.7, 0, Math.PI * 2);
  g.fill();
}

// Gizli kapı: kemerli tahta kapı; saklıyken önünde çalı + ara sıra pırıltı
function drawSecretDoor(g: CanvasRenderingContext2D, x: number, time: number, hidden: boolean) {
  const by = GROUND_Y;
  g.fillStyle = "#6b4226";
  g.beginPath();
  g.arc(x + 15, by - 30, 15, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(x, by - 30, 30, 30);
  g.fillStyle = "#8a5a34";
  g.beginPath();
  g.arc(x + 15, by - 30, 11, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(x + 4, by - 30, 22, 26);
  // kapı tahta çizgileri + topuz
  g.strokeStyle = "#5b3a1a";
  g.lineWidth = 1.6;
  for (let k = -1; k <= 1; k++) {
    g.beginPath();
    g.moveTo(x + 15 + k * 7, by - 38 + Math.abs(k) * 4);
    g.lineTo(x + 15 + k * 7, by - 4);
    g.stroke();
  }
  g.fillStyle = "#d4a017";
  g.beginPath();
  g.arc(x + 23, by - 16, 2.2, 0, Math.PI * 2);
  g.fill();
  if (hidden) {
    // önünde çalı — kapıyı yarı gizler
    g.fillStyle = "#3f9d45";
    g.beginPath();
    g.arc(x + 4, by, 10, Math.PI, Math.PI * 2);
    g.arc(x + 17, by, 12, Math.PI, Math.PI * 2);
    g.arc(x + 29, by, 9, Math.PI, Math.PI * 2);
    g.fill();
    // ara sıra göz kırpan pırıltı — meraklı çocuğa ipucu
    const tw = Math.sin(time * 2.4);
    if (tw > 0.82) {
      g.globalAlpha = (tw - 0.82) / 0.18;
      g.fillStyle = "#fde047";
      g.beginPath();
      g.arc(x + 15, by - 40, 3, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  } else {
    // çıkış kapısı: üstünde yeşil ok
    g.fillStyle = "#22c55e";
    g.beginPath();
    g.moveTo(x + 15, by - 56);
    g.lineTo(x + 24, by - 66);
    g.lineTo(x + 6, by - 66);
    g.closePath();
    g.fill();
  }
}

// Can kalbi (bonus bahçede) — nabız gibi atar
function drawHeartPickup(g: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const k = 1 + Math.sin(time * 5) * 0.12;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  const grad = g.createRadialGradient(0, 0, 2, 0, 0, 18);
  grad.addColorStop(0, "rgba(244,63,94,0.4)");
  grad.addColorStop(1, "rgba(244,63,94,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ef4444";
  g.beginPath();
  g.arc(-4.5, -3, 5.5, 0, Math.PI * 2);
  g.arc(4.5, -3, 5.5, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-9.6, -0.6);
  g.lineTo(0, 11);
  g.lineTo(9.6, -0.6);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.beginPath();
  g.arc(-4.5, -4.5, 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
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
  grounded: boolean, ghostT: number, nurT: number, time: number,
) {
  // Nur halesi — altın ışık (dokunulan canavarlar güvercine dönüşür)
  if (nurT > 0) {
    const cx = x + PW / 2, cy = y + PH / 2;
    const pr = 30 + Math.sin(time * 6) * 3;
    const grad = g.createRadialGradient(cx, cy, 6, cx, cy, pr);
    grad.addColorStop(0, "rgba(253,224,71,0.5)");
    grad.addColorStop(1, "rgba(253,224,71,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, pr, 0, Math.PI * 2);
    g.fill();
    // dönen ışık zerreleri
    g.fillStyle = "#fde047";
    for (let k = 0; k < 3; k++) {
      const a = time * 3 + (k / 3) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * 24, cy + Math.sin(a) * 16, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }
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
  const [banner, setBanner] = useState<{ text: string; tone: "good" | "bad" | "power" } | null>(null);
  const [pu, setPu] = useState<{ nur: number; mag: number; x2: number }>({ nur: 0, mag: 0, x2: 0 });
  const [flash, setFlash] = useState(false); // normal modda doğru cevapta ışık
  const [resetTick, setResetTick] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 🌟 Bu koşuda bulunan altın güvercinler (kozmetik sürpriz)
  const goldenRef = useRef(0);
  const [goldenRun, setGoldenRun] = useState(0);


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

  const showBanner = useCallback((text: string, tone: "good" | "bad" | "power", ms = 1600) => {
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
    setPu({ nur: 0, mag: 0, x2: 0 });
    goldenRef.current = 0; setGoldenRun(0);
    controls.current = { moveDir: 0, jumpQueued: false, jumpHeld: false, paused: false, over: false };
    trioRef.current = null;
    setStarted(true);
    setPaused(false);
    setResetTick((t) => t + 1);
  }, []);

  const toPicker = useCallback(() => {
    setStarted(false); setPaused(true); setGameOver(false); setWon(false);
    setQuestion(null); setBanner(null); setProgress(0);
    setPu({ nur: 0, mag: 0, x2: 0 });
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
      nurT: 0, magT: 0, x2T: 0,
    };
    const w: World = {
      solids: [{ x: -240, y: GROUND_Y, w: 1040, oneWay: false }],
      monsters: [], springs: [], trios: [], coins: [], pops: [], cliffs: [],
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

    const spawnMonster = (kind: MonsterKind, rx0: number, rx1: number, groundY = GROUND_Y) => {
      const cx = (rx0 + rx1) / 2;
      const base: MonsterEnt = {
        id: UID++, kind, x: cx, y: groundY - MH[kind],
        dir: Math.random() < 0.5 ? -1 : 1,
        minX: rx0, maxX: rx1, homeX: cx,
        baseY: groundY - MH[kind], amp: 0, t: Math.random() * 6,
        vy: 0, grounded: true, hopT: 0.5 + Math.random() * 0.6,
        groundY, calmT: 0, freedT: 0,
      };
      if (kind === "floater") {
        base.baseY = groundY - 104 - Math.random() * 30;
        base.amp = 42 + Math.random() * 20;
        base.y = base.baseY;
      } else if (kind === "flyer") {
        base.baseY = groundY - 118 - Math.random() * 36;
        base.amp = 20 + Math.random() * 14;
        base.y = base.baseY;
      }
      w.monsters.push(base);
    };

    // Soru üçlüsü: bloklar şimdi yerleştirilir, HARFLER görünürken seçilir
    const placeTrioAt = (pos: { x: number; y: number }[]) => {
      const blocks: BlockEnt[] = pos.map((p) => ({ x: p.x, y: p.y, item: null, isTarget: false }));
      w.trios.push({
        id: UID++, target: null, blocks,
        left: Math.min(...pos.map((p) => p.x)),
        right: Math.max(...pos.map((p) => p.x)) + BLOCK,
        announced: false, hint: false, resolved: null, doneT: 0,
      });
    };
    const placeTrio = (baseX: number) => {
      const hs = shuffle([84, 138, 84]); // blok alt kenarının zeminden yüksekliği
      placeTrioAt(hs.map((h, i) => ({ x: baseX + i * 122, y: GROUND_Y - h - BLOCK })));
    };

    // ---- dünya inşa tuğlaları ----
    const ground = (x: number, wd: number, y = GROUND_Y) => {
      w.solids.push({ x, y, w: wd, oneWay: false });
      return x + wd;
    };
    const plat = (x: number, wd: number, y: number, mover = false) => {
      if (mover) {
        w.solids.push({
          x, y, w: wd, oneWay: true,
          mover: { baseY: y, range: 26 + Math.random() * 16, speed: 1.1 + Math.random() * 0.6, phase: Math.random() * 6.28 },
        });
      } else {
        w.solids.push({ x, y, w: wd, oneWay: true });
      }
    };
    // çukur: genişse uçurum görseli; üstünde yol gösteren para yayı
    const gap = (x: number, wd: number, coinH = 66) => {
      if (wd >= 90) w.cliffs.push({ x, w: wd });
      const glyph = randGlyph();
      if (glyph) {
        for (let i = 0; i < 4; i++) {
          const k = (i + 0.5) / 4;
          w.coins.push({ id: UID++, x: x + wd * k, y: GROUND_Y - coinH - Math.sin(k * Math.PI) * 40, glyph, taken: false });
        }
      }
      return x + wd;
    };
    const springAt = (x: number) => {
      w.springs.push({ id: UID++, x, y: GROUND_Y, t: 0 });
    };
    const kindPick = () => conf.monsterKinds[Math.floor(Math.random() * conf.monsterKinds.length)];

    // ---- DESEN KÜTÜPHANESİ ----
    // Klasik platform oyunlarının kanıtlanmış bölüm tasarım KALIPLARINDAN
    // esinlenildi (kademeli teraslar, ada atlamaları, piramit tepeler, yay
    // uçuşları, hareketli feribotlar, ritim çukurları, canavar koridorları,
    // çift katlı yollar, bölüm sonu merdiveni). Kalıplar mekaniktir — telifli
    // grafik/karakter/isim kopyalanmadı; tüm çizimler özgün.
    interface Pattern { minLv: number; build: (x: number) => number }
    const PATTERNS: Pattern[] = [
      // teraslar: kademeli yükselen zemin, tepede paralar + bekçi canavar
      { minLv: 1, build: (x) => {
        let cx = ground(x, 110);
        cx = ground(cx, 105, GROUND_Y - 44);
        addCoinRow(cx - 52, GROUND_Y - 44 - 26, 2);
        cx = ground(cx, 125, GROUND_Y - 88);
        addCoinRow(cx - 62, GROUND_Y - 88 - 26, 3);
        if (lv >= 2) spawnMonster("walker", cx - 118, cx - 6, GROUND_Y - 88);
        cx = ground(cx, 105, GROUND_Y - 44);
        return ground(cx, 110);
      } },
      // canavar koridoru: düzlükte 2-3 karışık canavar, üstte para hattı
      { minLv: 1, build: (x) => {
        const wd = 430 + Math.random() * 90;
        const e = ground(x, wd);
        spawnMonster(kindPick(), x + 30, x + wd * 0.55);
        spawnMonster(kindPick(), x + wd * 0.45, x + wd - 30);
        if (lv >= 4) spawnMonster(kindPick(), x + wd * 0.3, x + wd * 0.85);
        addCoinRow(x + wd / 2, GROUND_Y - 96, 5); // canavarların üstünden zıpla-topla
        return e;
      } },
      // ritim çukurları: kısa zemin + çukur ×2-3 (para yayları yol gösterir)
      { minLv: 1, build: (x) => {
        let cx = ground(x, 130);
        const n = lv >= 4 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          cx = gap(cx, 64 + Math.random() * 22 + Math.min(20, lv * 2));
          cx = ground(cx, 112 + Math.random() * 50);
        }
        return cx;
      } },
      // çift katlı yol: altta canavarlar, üstte paralı uzun platform (seçim!)
      { minLv: 2, build: (x) => {
        const wd = 400;
        const e = ground(x, wd);
        plat(x + 70, 250, GROUND_Y - 108);
        addCoinRow(x + 195, GROUND_Y - 108 - 28, 5);
        spawnMonster(kindPick(), x + 40, x + wd - 40);
        if (lv >= 5) spawnMonster(kindPick(), x + wd * 0.5, x + wd - 30);
        return e;
      } },
      // yay uçuşu: yaya bas, büyük uçurumun üzerinden uç (para sütunu)
      { minLv: 2, build: (x) => {
        let cx = ground(x, 170);
        springAt(cx - 60);
        addCoinColumn(cx - 60);
        cx = gap(cx, 120 + Math.min(40, lv * 5), 96);
        return ground(cx, 150);
      } },
      // ada atlamaları: geniş uçurumda 3 küçük ada + üstte devriye kuşu
      { minLv: 2, build: (x) => {
        let cx = ground(x, 130);
        for (let i = 0; i < 3; i++) {
          cx = gap(cx, 60 + Math.random() * 16, 60);
          cx = ground(cx, 100 + Math.random() * 30);
        }
        if (conf.monsterKinds.includes("flyer")) spawnMonster("flyer", x + 150, cx - 40);
        cx = gap(cx, 66, 60);
        return ground(cx, 140);
      } },
      // merdiven + tepe atlayışı: basamaklarla çık, tepedeki boşluğu atla, in
      { minLv: 3, build: (x) => {
        let cx = ground(x, 110);
        cx = ground(cx, 95, GROUND_Y - 44);
        cx = ground(cx, 95, GROUND_Y - 88);
        addCoinRow(cx - 48, GROUND_Y - 88 - 26, 2);
        const glyph = randGlyph();
        if (glyph) {
          for (let i = 0; i < 3; i++) {
            w.coins.push({ id: UID++, x: cx + 16 + i * 30, y: GROUND_Y - 88 - 58, glyph, taken: false });
          }
        }
        cx += 92; // tepe boşluğu — düşersen aşağısı yok
        cx = ground(cx, 95, GROUND_Y - 88);
        cx = ground(cx, 95, GROUND_Y - 44);
        return ground(cx, 110);
      } },
      // hareketli feribot: dev uçurumu süzülen platformla geç (zamanlama!)
      { minLv: 3, build: (x) => {
        let cx = ground(x, 150);
        const gw = 170 + Math.min(50, lv * 6);
        plat(cx + gw * 0.5 - 45, 90, GROUND_Y - 96, true);
        cx = gap(cx, gw, 120);
        return ground(cx, 150);
      } },
      // piramit: kademeli tepe, zirvede para tacı + bekçi baloncuk
      { minLv: 4, build: (x) => {
        let cx = ground(x, 100);
        cx = ground(cx, 85, GROUND_Y - 44);
        cx = ground(cx, 85, GROUND_Y - 88);
        cx = ground(cx, 100, GROUND_Y - 132);
        addCoinRow(cx - 50, GROUND_Y - 132 - 28, 3);
        if (conf.monsterKinds.includes("floater")) spawnMonster("floater", cx - 92, cx - 8);
        cx = ground(cx, 85, GROUND_Y - 88);
        cx = ground(cx, 85, GROUND_Y - 44);
        return ground(cx, 100);
      } },
    ];

    // ---- soru arenaları: sorular da desenlerin içinde ----
    const qaClassic = (x: number) => {
      const e = ground(x, 520);
      placeTrio(x + 90);
      return e;
    };
    // adalar arenası: her blok kendi adasının üstünde — zıpla, seç
    const qaIslands = (x: number) => {
      let cx = ground(x, 140);
      const pos: { x: number; y: number }[] = [];
      for (let i = 0; i < 3; i++) {
        pos.push({ x: cx + 75 - BLOCK / 2, y: GROUND_Y - 84 - BLOCK });
        cx = ground(cx, 150);
        if (i < 2) cx = gap(cx, 58, 56);
      }
      placeTrioAt(pos);
      return ground(cx, 140);
    };

    // ---- bölümü desenlerden kur: soru arenaları araya serpiştirilir,
    // desen çantası (bag) tekrarları önler, aralara nefes düzlükleri girer ----
    placeTrio(460); // ilk soru başlangıç düzlüğünde hazır
    const qStep = (conf.len - 1600) / Math.max(1, conf.questions - 1);
    const qXs = Array.from({ length: conf.questions }, (_, i) => 900 + i * qStep);
    let qi = 0;
    let bag: Pattern[] = [];
    const nextPattern = () => {
      if (!bag.length) bag = shuffle(PATTERNS.filter((p) => p.minLv <= lv));
      return bag.pop()!;
    };
    let bx = 800;
    let lastWasQ = false;
    while (bx < conf.len) {
      if (!lastWasQ && qi < qXs.length && bx >= qXs[qi]) {
        bx = lv >= 4 && Math.random() < 0.5 ? qaIslands(bx) : qaClassic(bx);
        qi++;
        lastWasQ = true;
      } else {
        bx = nextPattern().build(bx);
        lastWasQ = false;
      }
      // bağlantı düzlüğü: kısa nefes — bazen para, bazen canavar, bazen yay
      const cw = 130 + Math.random() * 110;
      if (Math.random() < 0.5) addCoinRow(bx + cw / 2, GROUND_Y - 26, 3);
      else if (Math.random() < 0.45) spawnMonster(kindPick(), bx + 24, bx + cw - 24);
      if (conf.springs && Math.random() < 0.18) {
        springAt(bx + cw / 2);
        addCoinColumn(bx + cw / 2);
      }
      bx = ground(bx, cw);
    }
    // final: kutlama merdiveni (paralı basamaklar) → cami avlusuna atla
    bx = ground(bx, 120);
    bx = ground(bx, 90, GROUND_Y - 44);
    addCoinRow(bx - 45, GROUND_Y - 44 - 26, 2);
    bx = ground(bx, 90, GROUND_Y - 88);
    addCoinRow(bx - 45, GROUND_Y - 88 - 26, 3);
    bx = ground(bx, 110, GROUND_Y - 132);
    addCoinRow(bx - 55, GROUND_Y - 132 - 28, 3);
    w.genX = bx;
    w.solids.push({ x: w.genX, y: GROUND_Y, w: 860, oneWay: false });
    const mosqueX = w.genX + 300;          // cami sol kenarı
    const finishX = mosqueX + 85;          // cami kapısı — hedef
    w.genX += 860;

    // GİZLİ KAPI + bonus bahçe (2, 5 ve 8. bölümlerde): kapı bir çalının
    // arkasında saklıdır; giren çocuk cami arkasındaki gizli bahçeye ışınlanır
    // (bol harf parası + can kalbi), çıkış kapısıyla kaldığı yere döner.
    const bonusX = mosqueX + 520;
    const bonusExitX = bonusX + 660;
    let doorX: number | null = null;
    if (lv % 3 === 2) {
      const cands = w.solids.filter((so) => !so.oneWay && so.y === GROUND_Y && so.x > 1000 && so.x + so.w < conf.len && so.w >= 300);
      if (cands.length) {
        const so = cands[Math.floor(cands.length / 2)];
        doorX = so.x + so.w - 96;
        w.solids.push({ x: bonusX - 60, y: GROUND_Y, w: 820, oneWay: false });
        addCoinRow(bonusX + 120, GROUND_Y - 26, 5);
        addCoinRow(bonusX + 290, GROUND_Y - 84, 4);
        addCoinRow(bonusX + 460, GROUND_Y - 26, 5);
        w.springs.push({ id: UID++, x: bonusX + 380, y: GROUND_Y, t: 0 });
        addCoinColumn(bonusX + 380);
        w.coins.push({ id: UID++, x: bonusX + 210, y: GROUND_Y - 48, glyph: "", taken: false, heart: true });
      }
    }
    let bonusActive = false;
    let doorCd = 0;
    let doorStandT = 0; // kapı önünde durma süresi — gizli kapı böyle açılır

    // --- olay yardımcıları ---

    const loseLife = (silent = false) => {
      if (!silent) playFeedback(false);
      lives -= 1;
      setLives(lives);
      if (lives <= 0) { over = true; setGameOver(true); }
    };

    const respawnX = () => {
      // yalnız DÜZ zemine (GROUND_Y) doğar — teras üstüne/içine doğmasın
      const minX = s.camX + 20;
      let best: number | null = null;
      for (const so of w.solids) {
        if (so.oneWay || so.y !== GROUND_Y) continue;
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

    const spawnSparkles = (x: number, y: number) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        w.pops.push({
          x, y,
          vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40,
          t: 0, life: 0.55, color: "#fde047",
        });
      }
    };

    // Doğru cevap ödülü: hedef harften bonus "harf parası" dizisi
    const spawnCoinTrail = (item: ContentItem, n: number) => {
      const glyph = item.emoji || "";
      if (!glyph) return;
      for (let i = 0; i < n; i++) {
        w.coins.push({
          id: UID++,
          x: s.x + 150 + i * 52,
          y: GROUND_Y - 70 - Math.sin(((i % 5) / 4) * Math.PI) * 55,
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

    // Doğru cevap ödülü — DEĞİŞKEN ORANLI (variable-ratio): her doğruda DEĞİL,
    // ortalama ~her 3-4 doğruda bir SÜRPRİZ büyük ödül (kalp / Nur / mıknatıs /
    // 2X). Tahmin edilemezlik dopamini canlı tutar; her seferinde ödül vermek
    // dopamini köreltir (Skinner değişken oran). Sürpriz olmayan doğrular küçük
    // ama tatmin edici harf yağmuru alır (banner yok — büyük ödül değerli kalsın).
    // Seri ısındıkça sürpriz şansı hafif artar → "alev aldın" hissi (kararlılığı
    // ödüllendirir). Yanlış cevap CAN GÖTÜRMEZ.
    const grantReward = (target: ContentItem) => {
      const anyPower = s.nurT > 0 || s.magT > 0 || s.x2T > 0;
      const bigChance = Math.min(0.5, 0.25 + Math.max(0, streak - 3) * 0.05);
      if (anyPower || Math.random() >= bigChance) {
        spawnCoinTrail(target, anyPower ? 6 : 3); // küçük ödül, sessiz
        return;
      }
      const r2 = Math.random();
      if (lives < MAX_LIVES && r2 < 0.4) {
        lives += 1;
        setLives(lives);
        showBanner("❤️ +1 Can! Süpersin!", "good", 1700);
      } else {
        const r3 = Math.random();
        if (r3 < 0.34) {
          s.nurT = NUR_TIME;
          showBanner("✨ NUR! Dokunduğun canavar güvercin olur 🕊️", "power", 2200);
        } else if (r3 < 0.67) {
          s.magT = MAG_TIME;
          showBanner("🧲 MIKNATIS! Harfler sana gelir", "power", 1800);
        } else {
          s.x2T = X2_TIME;
          showBanner("⭐ 2X PUAN!", "power", 1600);
        }
      }
      spawnCoinTrail(target, 6);
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
        score += (10 + Math.min(streak, 5) * 2) * (s.x2T > 0 ? 2 : 1);
        setScore(score);
        b.state = "good";
        for (const o of t.blocks) if (o !== b) o.state = "fade";
        if (!isSuperRef.current) { setFlash(true); setTimeout(() => setFlash(false), 450); }
        spawnConfetti(b.x + BLOCK / 2, b.y + BLOCK / 2);
        grantReward(target);
      } else {
        playFeedback(false);
        streak = 0;
        setStreak(0);
        score = Math.max(0, score - 5);
        setScore(score);
        for (const o of t.blocks) o.state = o === b ? "bad" : o.isTarget ? "good" : "fade";
        // Yanlış cevaplanan harf, moddan bağımsız tekrar sorulsun
        enqueueRetryItem(target);
        showBanner(`Doğrusu: ${target.translit || target.label} — tekrar gelecek`, "bad", 1800);
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

      // cami kapısına ulaşınca: kısa kutlama, sonra bölüm tamam
      if (!winning && !bonusActive && s.x + PW / 2 >= finishX) {
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
          spawnConfetti(mosqueX + 85 + (Math.random() - 0.5) * 90, GROUND_Y - 130 - Math.random() * 40);
        }
        if (winT <= 0) {
          over = true;
          setWon(true);
          return;
        }
      }

      // güç zamanlayıcıları
      if (s.nurT > 0) s.nurT = Math.max(0, s.nurT - dt);
      if (s.magT > 0) s.magT = Math.max(0, s.magT - dt);
      if (s.x2T > 0) s.x2T = Math.max(0, s.x2T - dt);

      // yatay hareket (geri gitmek serbest ama kamera geri dönmez)
      const mv = winning ? 0 : c.moveDir;
      if (mv !== 0) s.facing = mv;
      s.x += mv * RUN_SPEED * dt;
      if (s.x < s.camX + 14) s.x = s.camX + 14;
      // yükseltilmiş zeminlerin (teras/piramit) YAN YÜZLERİ katıdır —
      // içinden yürünmez, üstüne zıplayarak çıkılır (klasik platform kuralı)
      for (const so of w.solids) {
        if (so.oneWay || so.y >= GROUND_Y) continue;
        if (s.y + PH <= so.y + 6) continue;                 // üstündeyiz
        if (s.x + PW <= so.x || s.x >= so.x + so.w) continue;
        s.x = s.x + PW / 2 < so.x + so.w / 2 ? so.x - PW : so.x + so.w;
      }
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

      // gizli kapı: önünde kısa süre DURAN çocuk bonus bahçeye ışınlanır
      // (üzerinden koşup geçmek tetiklemez — kapı gerçekten "gizli" kalır);
      // çıkış kapısına dokunmak kaldığı yere döndürür.
      if (doorCd > 0) doorCd -= dt;
      if (doorX !== null && doorCd <= 0 && s.grounded) {
        const atDoor = s.x + PW > doorX - 6 && s.x < doorX + 38 && s.y + PH > GROUND_Y - 46;
        if (!bonusActive && atDoor && mv === 0) {
          doorStandT += dt;
          if (doorStandT > 0.12 && Math.random() < dt * 8) spawnSparkles(doorX + 16, GROUND_Y - 30);
        } else if (!bonusActive) {
          doorStandT = 0;
        }
        if (!bonusActive && doorStandT >= 0.4) {
          bonusActive = true;
          doorCd = 1;
          doorStandT = 0;
          spawnSparkles(doorX + 16, GROUND_Y - 24);
          s.x = bonusX + 20;
          s.y = GROUND_Y - PH;
          s.vy = 0;
          s.camX = bonusX - 70;
          s.ghostT = 0.6;
          showBanner("🚪 Gizli bahçeyi buldun!", "power", 1900);
        } else if (bonusActive && s.x + PW > bonusExitX + 4 && s.x < bonusExitX + 30) {
          bonusActive = false;
          doorCd = 1;
          s.x = doorX + 62;
          s.y = GROUND_Y - PH;
          s.vy = 0;
          s.camX = Math.max(0, s.x - view.w * 0.45);
          s.ghostT = 0.6;
          showBanner("Maceraya devam! 🏃", "good", 1400);
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

      // canavarlar: tür bazlı hareket + şiddetsiz çarpışma
      for (let i = w.monsters.length - 1; i >= 0; i--) {
        const m = w.monsters[i];
        if (m.freedT > 0) {
          // güvercin olarak uçup gidiyor — çarpışmaz
          m.freedT -= dt;
          if (m.freedT <= 0) w.monsters.splice(i, 1);
          continue;
        }
        if (m.calmT > 0) m.calmT = Math.max(0, m.calmT - dt);
        m.t += dt;
        const mw = MW[m.kind], mh = MH[m.kind];
        if (m.calmT <= 0) {
          switch (m.kind) {
            case "walker":
              m.x += m.dir * WALKER_SPEED * dt;
              if (m.x < m.minX) { m.x = m.minX; m.dir = 1; }
              if (m.x + mw > m.maxX) { m.x = m.maxX - mw; m.dir = -1; }
              break;
            case "hopper": {
              if (m.grounded) {
                m.hopT -= dt;
                if (m.hopT <= 0) {
                  m.grounded = false;
                  m.vy = -470;
                  if (m.x <= m.minX + 2) m.dir = 1;
                  else if (m.x + mw >= m.maxX - 2) m.dir = -1;
                  else if (Math.random() < 0.3) m.dir = Math.random() < 0.5 ? -1 : 1;
                }
              } else {
                m.vy += GRAVITY * 0.72 * dt;
                m.y += m.vy * dt;
                m.x += m.dir * 118 * dt;
                if (m.x < m.minX) { m.x = m.minX; m.dir = 1; }
                if (m.x + mw > m.maxX) { m.x = m.maxX - mw; m.dir = -1; }
                const gy = m.groundY - mh;
                if (m.y >= gy) {
                  m.y = gy;
                  m.vy = 0;
                  m.grounded = true;
                  m.hopT = 0.45 + Math.random() * 0.6;
                }
              }
              break;
            }
            case "floater":
              m.y = m.baseY + Math.sin(m.t * 1.5) * m.amp;
              m.x = m.homeX + Math.sin(m.t * 0.7) * 16;
              break;
            case "flyer":
              m.x += m.dir * FLYER_SPEED * dt;
              if (m.x < m.minX) { m.x = m.minX; m.dir = 1; }
              if (m.x + mw > m.maxX) { m.x = m.maxX - mw; m.dir = -1; }
              m.y = m.baseY + Math.sin(m.t * 2.2) * m.amp;
              break;
          }
        }
        // çarpışma
        if (s.x + PW > m.x + 3 && s.x < m.x + mw - 3 && s.y + PH > m.y && s.y < m.y + mh) {
          if (s.nurT > 0) {
            // NUR: canavar güvercine dönüşüp özgürce uçar — kimse zarar görmez
            m.freedT = FREED_DUR;
            playSfx("dove");
            // 🌟 Nadir ALTIN güvercin (%3): kozmetik sürpriz + bonus puan.
            // "Acaba bugün çıkar mı?" merakı — kazanma şartı yine doğru oyun.
            m.golden = Math.random() < 0.03;
            const gain = m.golden ? 25 : 5;
            score += gain * (s.x2T > 0 ? 2 : 1);
            setScore(score);
            if (m.golden) {
              goldenRef.current += 1;
              setGoldenRun(goldenRef.current);
              try {
                const k = "elifba-golden-doves-v1";
                localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || "0", 10) + 1));
              } catch { /* ignore */ }
              spawnSparkles(m.x + mw / 2, m.y + mh / 2);
              spawnSparkles(m.x + mw / 2, m.y);
            }
            spawnSparkles(m.x + mw / 2, m.y + mh / 2);
            w.pops.push({
              x: m.x + mw / 2, y: m.y - 10, vx: 0, vy: -70, t: 0, life: m.golden ? 1.2 : 0.8,
              color: m.golden ? "#d97706" : "#0891b2", text: m.golden ? "✨🕊️ ALTIN +25" : "🕊️ +5",
            });
          } else if (s.vy > 0 && prevFeet <= m.y + 9) {
            // üstüne basmak zarar vermez: oyuncu seker, canavar sersemler
            s.vy = -430;
            s.grounded = false;
            m.calmT = 1.1;
            spawnDust(m.x + mw / 2, m.y);
          } else if (s.ghostT <= 0 && m.calmT <= 0) {
            hurt();
          }
        }
      }

      // soru üçlüleri
      for (let i = w.trios.length - 1; i >= 0; i--) {
        const t = w.trios[i];
        if (!bonusActive && !t.announced && t.left < s.camX + view.w + 80) announceTrio(t);
        // bonus bahçedeyken soru etkileşimi durur — ışınlanma "kaçırdın"
        // saymaz, banner ezilmez; dönünce soru kaldığı yerden devam eder
        if (!t.resolved && !bonusActive) {
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

      // harf paraları (+ mıknatıs çekimi)
      for (const cn of w.coins) {
        if (cn.taken) continue;
        if (s.magT > 0) {
          const dx = s.x + PW / 2 - cn.x, dy = s.y + PH / 2 - cn.y;
          if (dx * dx + dy * dy < 150 * 150) {
            const k = Math.min(1, dt * 5);
            cn.x += dx * k;
            cn.y += dy * k;
          }
        }
        if (s.x + PW > cn.x - COIN_R && s.x < cn.x + COIN_R && s.y + PH > cn.y - COIN_R && s.y < cn.y + COIN_R) {
          cn.taken = true;
          if (cn.heart) {
            if (lives < MAX_LIVES) { lives += 1; setLives(lives); }
            playFeedback(true);
            showBanner("❤️ +1 Can!", "good", 1400);
            spawnSparkles(cn.x, cn.y);
          } else {
            const v = 2 * (s.x2T > 0 ? 2 : 1);
            score += v;
            setScore(score);
            w.pops.push({ x: cn.x, y: cn.y - 12, vx: 0, vy: -60, t: 0, life: 0.7, color: "#b45309", text: `+${v}` });
          }
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
      const camMax = bonusActive ? bonusX + 830 - view.w : mosqueX + 300 - view.w;
      s.camX = Math.max(s.camX, Math.min(s.x - view.w * 0.38, camMax));
      cleanT -= dt;
      if (cleanT <= 0 && !bonusActive) {
        // bonus bahçedeyken temizlik yapılmaz — dönüş noktası korunur
        cleanT = 1;
        const cut = s.camX - 280;
        w.solids = w.solids.filter((so) => so.x + so.w > cut);
        w.monsters = w.monsters.filter((m) => m.maxX > cut);
        w.springs = w.springs.filter((sp) => sp.x > cut || sp.x >= bonusX - 60);
        w.coins = w.coins.filter((cn) => !cn.taken && (cn.x > cut || cn.x >= bonusX - 60));
        w.trios = w.trios.filter((t) => t.right > cut - 100);
      }
    };

    // --- çizim ---
    const draw = () => {
      const g = ctx;
      const testActive = isTestUnlockActive(); // test modunda blok seviyesi göster
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
      drawHills(g, s.camX, view.w, theme);

      g.save();
      g.translate(-s.camX, 0);
      const l = s.camX - 70, r = s.camX + view.w + 70;

      // YERALTI KATMANI: zemin çizgisinin altı her yerde koyu kaya — çukur ve
      // uçurumlar gökyüzünü/tepe yarım dairelerini değil mağara karanlığını
      // gösterir; zemin parçaları bunun üstüne çizilir.
      const ug = g.createLinearGradient(0, GROUND_Y, 0, VH + 40);
      ug.addColorStop(0, theme.pit);
      ug.addColorStop(1, "#120b04");
      g.fillStyle = ug;
      g.fillRect(l, GROUND_Y, r - l, VH - GROUND_Y + 40);
      // yeraltı kaya dokusu (deterministik)
      g.fillStyle = "rgba(0,0,0,0.28)";
      for (let i = Math.floor(l / 46); i <= Math.ceil(r / 46); i++) {
        const rx = i * 46 + hash01(i * 3) * 30;
        const ry = GROUND_Y + 16 + hash01(i * 7) * (VH - GROUND_Y - 20);
        g.fillRect(rx, ry, 7, 4);
      }

      for (const so of w.solids) {
        if (so.x + so.w < l || so.x > r) continue;
        if (so.oneWay) drawPlatform(g, so, theme);
        else drawGroundSolid(g, so, theme, s.time);
      }

      // uçurum duvarları + uyarı tabelaları
      for (const cf of w.cliffs) {
        if (cf.x + cf.w < l || cf.x > r) continue;
        drawCliff(g, cf.x, cf.w);
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
      if (mosqueX + 240 > l && mosqueX - 60 < r) drawMosque(g, mosqueX, s.time);
      if (doorX !== null) {
        if (doorX + 40 > l && doorX - 10 < r) drawSecretDoor(g, doorX, s.time, true);
        if (bonusExitX + 40 > l && bonusExitX - 10 < r) drawSecretDoor(g, bonusExitX, s.time, false);
      }

      for (const sp of w.springs) {
        if (sp.x + 20 < l || sp.x - 20 > r) continue;
        drawSpring(g, sp);
      }

      for (const cn of w.coins) {
        if (cn.taken || cn.x < l || cn.x > r) continue;
        const bob = Math.sin(s.time * 3 + cn.id) * 2.5;
        if (cn.heart) {
          drawHeartPickup(g, cn.x, cn.y + bob, s.time);
          continue;
        }
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
          // TEST MODU: bloğun köşesinde SRS seviyesi (elle doğrulama)
          if (testActive && t.announced && b.item) {
            const lv = getGameItemLevel(b.item);
            g.fillStyle = ["#94a3b8", "#ef4444", "#f59e0b", "#eab308", "#22c55e"][Math.min(4, lv)];
            g.fillRect(bx + BLOCK - 16, by, 16, 13);
            g.fillStyle = "#000";
            g.font = "bold 10px system-ui, sans-serif";
            g.textAlign = "center";
            g.fillText(`L${lv}`, bx + BLOCK - 8, by + 10);
          }
          g.globalAlpha = 1;
        }
      }

      for (const m of w.monsters) {
        if (m.x + MW[m.kind] < l - 60 || m.x > r + 60) continue;
        drawMonster(g, m, s.time);
      }

      drawPlayerChar(g, s.x, s.y, s.facing, s.anim, s.grounded, s.ghostT, s.nurT, s.time);

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

    // bölüm ilerlemesi + güç rozetleri — düşük frekans HUD güncellemesi
    const progId = setInterval(() => {
      const effX = bonusActive && doorX !== null ? doorX : s.x; // bonusta çubuk donar
      setProgress(Math.max(0, Math.min(100, Math.round(((effX - 80) / (finishX - 80)) * 100))));
      setPu((prev) => {
        if (prev.nur === s.nurT && prev.mag === s.magT && prev.x2 === s.x2T) return prev;
        return { nur: s.nurT, mag: s.magT, x2: s.x2T };
      });
    }, 250);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // dt her iki yönde kelepçeli: rAF zaman damgası kurulumdaki
      // performance.now()'dan ÖNCE olabilir (negatif dt) — negatif yerçekimi
      // oyuncuyu zeminden tünelleyip düşürüyordu (başlangıçta 1 can kaybı).
      const dt = Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
      last = now;
      const c = controls.current;
      if (!c.paused && !c.over) step(dt);
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
        <PageHeader title="🕌 Elif Ba Macerası" backTo="/oyunlar" centered onReset={toPicker} />

        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Puan</div>
            <div className="text-xl font-extrabold text-success">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-destructive/30 flex flex-col items-center">
            <div className="text-[10px] font-bold text-muted-foreground">Can</div>
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <Heart key={i} className={cn("h-3.5 w-3.5", i < lives ? "fill-destructive text-destructive" : "text-muted")} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-warning/30">
            <div className="text-[10px] font-bold text-muted-foreground">Seri</div>
            <div className="text-xl font-extrabold text-warning">🔥{streak}</div>
          </div>
        </div>

        {/* bölüm + ilerleme çubuğu (hedef: cami) */}
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
            <span className="text-sm">🕌</span>

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

          {/* güç rozetleri */}
          <div className="pointer-events-none absolute top-2 right-2 z-20 flex flex-col gap-1 items-end">
            {pu.nur > 0 && (
              <span className="rounded-full bg-warning/90 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-soft">✨ Nur {Math.ceil(pu.nur)}s</span>
            )}
            {pu.mag > 0 && (
              <span className="rounded-full bg-info/90 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-soft">🧲 {Math.ceil(pu.mag)}s</span>
            )}
            {pu.x2 > 0 && (
              <span className="rounded-full bg-primary/90 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-soft">⭐2X {Math.ceil(pu.x2)}s</span>
            )}
          </div>

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
                banner.tone === "power" && "bg-gradient-to-r from-indigo-500 to-fuchsia-500",
              )}
            >
              {banner.text}
            </div>
          )}

          {/* bölüm seçme ekranı */}
          {!started && !gameOver && !won && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2.5 bg-background/90 p-3">
              <div className="text-lg font-extrabold text-warning">🕌 Bölüm Seç</div>
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
                          ? "bg-muted/50 border-border text-muted-foreground"
                          : "bg-card border-warning/50 shadow-soft active:scale-95 hover:-translate-y-0.5",
                      )}
                    >
                      <span className="text-xl sm:text-2xl leading-none">{locked ? "🔒" : t.emoji}</span>
                      <span className={cn("text-[11px] font-extrabold mt-0.5", locked ? "text-muted-foreground" : "text-foreground")}>{lv}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] font-bold text-muted-foreground text-center leading-relaxed px-4">
                Sesi dinle, doğru harf bloğuna dokun — ödül kazan! 🎁 (can, Nur, mıknatıs...)<br />
                ✨ Nur varken dokunduğun canavar güvercin olup uçar 🕊️ • Gizli kapıları ara 🚪<br />
                ◀ ▶ yürü • Zıpla • Uçurumlara dikkat ⚠️ • Camiye ulaşınca bölüm biter 🕌
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
              <div className="text-4xl mb-1">🕌</div>
              <div className="text-2xl font-extrabold text-success mb-1">Bölüm {level} Tamam!</div>
              <div className="text-2xl mb-1">{"⭐".repeat(Math.max(1, Math.min(3, lives)))}</div>
              <div className="text-sm font-bold text-muted-foreground mb-2">Camiye ulaştın! Puan: {score}</div>
              {/* 🌟 nadir altın güvercin bulunduysa kutla */}
              {goldenRun > 0 && (
                <div className="mb-2 rounded-xl bg-gradient-gold px-3 py-1.5 text-xs font-extrabold text-gold-foreground shadow-soft animate-pop">
                  ✨🕊️ ALTIN GÜVERCİN buldun! ×{goldenRun}
                </div>
              )}
              {/* yüksek notada bitiş — bahçe teşviki */}
              <div className="mb-4 rounded-xl bg-success/10 border-2 border-success/30 px-3 py-1.5 text-xs font-extrabold text-success">🌸 Bahçende yeni çiçekler açtı!</div>
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
          ◀ ▶ yürü • Zıpla • Doğru harfe dokun, ödül kazan, camiye koş! 🕌
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
