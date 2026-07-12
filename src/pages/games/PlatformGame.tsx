// 🍄 "Harf Macerası" — Mario tarzı 2D yandan kaydırmalı platform oyunu.
//
// Para/altın yerine HARF toplanır: sesli + yazılı soru hedef harfi verir,
// ileride 3 harf bloğu belirir; oyuncu koşup zıplayarak DOĞRU bloğa dokunur.
// Doğru: puan + seri + hedef harften bonus "harf parası" dizisi. Yanlış: can
// ve puan kaybı + doğru blok yeşil gösterilir ve harf tekrar sorulur.
// Cevaplar SRS ilerlemesine işlenir (süper modda hepsi sayılır, normal modda
// gameProgress 3'te 1 sayar); ipucu halkası süper modda yalnız seviye 1'de.
// Mobil (Capacitor) öncelikli: büyük basılı-tut butonları (◀ ▶ Ⓐ), pointer
// olayları, dpr'a duyarlı tek <canvas>, arka plana geçince otomatik durur,
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
const MAX_FALL = 950;
const RUN_SPEED = 200;
const ENEMY_SPEED = 55;
const DT_MAX = 0.05;          // sekme arkaplandan dönünce ışınlanmayı önler
const PW = 26, PH = 36;       // oyuncu çarpışma kutusu
const EW = 30, EH = 24;       // düşman (kestane) kutusu
const COYOTE = 0.1, JUMP_BUFFER = 0.12;
const GHOST_TIME = 2.0;       // hasar sonrası dokunulmazlık
const BLOCK = 54;             // harf bloğu kenarı
const COIN_R = 13;
const QGAP = 780;             // iki soru üçlüsü arası min mesafe
const PLAT_H = 16;

const FONT_STACK = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif';
const CONFETTI = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

// ---- tipler ----
interface SolidEnt { x: number; y: number; w: number; oneWay: boolean }
interface EnemyEnt { id: number; x: number; y: number; dir: 1 | -1; minX: number; maxX: number; squashT: number }
interface BlockEnt { x: number; y: number; item: ContentItem; isTarget: boolean; state?: "good" | "bad" | "fade" }
interface TrioEnt {
  id: number;
  target: ContentItem;
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
  trios: TrioEnt[];
  coins: CoinEnt[];
  pops: Pop[];
  genX: number;
  nextQX: number;
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
// dil); para = altın madalyon. Harf gerçek piksel sınırları ölçülerek
// SIĞDIRILIR (derin çanaklı harfler kesilmez) — SubwayGame.boardTexture gibi.
const spriteCache = new Map<string, HTMLCanvasElement>();
function glyphSprite(glyph: string, kind: "block" | "coin"): HTMLCanvasElement {
  const key = kind + ":" + glyph;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const px = kind === "block" ? BLOCK * 2 : COIN_R * 4;
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
  const base = px * 0.62;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `${base}px ${FONT_STACK}`;
  const m = g.measureText(glyph);
  const asc = m.actualBoundingBoxAscent || base * 0.75;
  const desc = m.actualBoundingBoxDescent || base * 0.25;
  const wpx = Math.max((m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0), m.width, 1);
  const pad = kind === "block" ? px * 0.14 : px * 0.2;
  const scale = Math.min((px - pad * 2) / (asc + desc), (px - pad * 2) / wpx, 1.4);
  const size = Math.floor(base * scale);
  g.font = `${size}px ${FONT_STACK}`;
  const m2 = g.measureText(glyph);
  const a2 = m2.actualBoundingBoxAscent || size * 0.75;
  const d2 = m2.actualBoundingBoxDescent || size * 0.25;
  g.fillStyle = kind === "block" ? "#065f46" : "#7c2d12";
  g.fillText(glyph, px / 2, (px - (a2 + d2)) / 2 + a2);
  spriteCache.set(key, c);
  return c;
}

// ---- sahne çizimleri ----

function drawClouds(g: CanvasRenderingContext2D, camX: number, vw: number) {
  const f = 0.2, spacing = 260;
  const off = camX * f;
  const i0 = Math.floor((off - 160) / spacing);
  const i1 = Math.ceil((off + vw + 160) / spacing);
  g.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = i0; i <= i1; i++) {
    const x = i * spacing + hash01(i) * 120 - off;
    const y = 36 + hash01(i * 3 + 1) * 70;
    const sc = 0.7 + hash01(i * 7 + 2) * 0.8;
    g.beginPath();
    g.arc(x, y, 16 * sc, 0, Math.PI * 2);
    g.arc(x + 15 * sc, y + 4 * sc, 11 * sc, 0, Math.PI * 2);
    g.arc(x - 15 * sc, y + 4 * sc, 10 * sc, 0, Math.PI * 2);
    g.fill();
  }
}

function drawHills(g: CanvasRenderingContext2D, camX: number, vw: number) {
  const f = 0.4, spacing = 300;
  const off = camX * f;
  const i0 = Math.floor((off - 240) / spacing);
  const i1 = Math.ceil((off + vw + 240) / spacing);
  for (let i = i0; i <= i1; i++) {
    const x = i * spacing + hash01(i * 5) * 140 - off;
    const r = 60 + hash01(i * 2 + 1) * 70;
    g.fillStyle = i % 2 ? "#a7e3a0" : "#8fd889";
    g.beginPath();
    g.arc(x, GROUND_Y + 4, r, Math.PI, Math.PI * 2);
    g.fill();
  }
}

function drawBush(g: CanvasRenderingContext2D, x: number, baseY: number, sc: number) {
  g.fillStyle = "#3f9d45";
  g.beginPath();
  g.arc(x, baseY, 11 * sc, Math.PI, Math.PI * 2);
  g.arc(x + 12 * sc, baseY, 8 * sc, Math.PI, Math.PI * 2);
  g.arc(x - 12 * sc, baseY, 8 * sc, Math.PI, Math.PI * 2);
  g.fill();
}

function drawGroundSolid(g: CanvasRenderingContext2D, so: SolidEnt) {
  g.fillStyle = "#c07a35";
  g.fillRect(so.x, so.y, so.w, VH - so.y + 40);
  g.fillStyle = "#3f9d45";
  g.fillRect(so.x, so.y, so.w, 12);
  g.fillStyle = "#5ec46a";
  g.fillRect(so.x, so.y, so.w, 6);
  // toprak benekleri (deterministik — her karede aynı yerde)
  g.fillStyle = "rgba(0,0,0,0.08)";
  const n = Math.floor(so.w / 42);
  for (let i = 0; i < n; i++) {
    const dx = so.x + 8 + ((i * 42 + hash01(so.x + i) * 26) % Math.max(1, so.w - 16));
    const dy = so.y + 20 + hash01(so.x * 3 + i) * (VH - so.y - 26);
    g.fillRect(dx, dy, 5, 3);
  }
  // çalılar
  if (so.w > 220) {
    const bn = 1 + Math.floor(hash01(so.x) * 2);
    for (let i = 0; i < bn; i++) {
      const bx = so.x + 30 + hash01(so.x + i * 7 + 3) * (so.w - 60);
      drawBush(g, bx, so.y + 1, 0.9 + hash01(so.x + i) * 0.5);
    }
  }
}

function drawPlatform(g: CanvasRenderingContext2D, so: SolidEnt) {
  rr(g, so.x, so.y, so.w, PLAT_H, 8);
  g.fillStyle = "#8b5a2b";
  g.fill();
  rr(g, so.x, so.y, so.w, 8, 6);
  g.fillStyle = "#5ec46a";
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
  // gözler + kızgın kaşlar
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

function drawPlayerChar(
  g: CanvasRenderingContext2D,
  x: number, y: number, facing: 1 | -1, anim: number,
  grounded: boolean, ghostT: number, time: number,
) {
  if (ghostT > 0 && Math.floor(time * 12) % 2 === 0) return; // hayalet yanıp söner
  g.save();
  g.translate(x + PW / 2, y + PH);
  g.scale(facing, 1);
  const swing = grounded ? Math.sin(anim * 13) * 5 : 4;
  // bacaklar + ayakkabılar
  g.fillStyle = "#1d4ed8";
  g.fillRect(-9 + swing * 0.5, -13, 8, 13);
  g.fillRect(1 - swing * 0.5, -13, 8, 13);
  g.fillStyle = "#7c2d12";
  g.fillRect(-11 + swing * 0.5, -4, 11, 4);
  g.fillRect(0 - swing * 0.5, -4, 11, 4);
  // gövde (tulum) + kollar
  rr(g, -10, -27, 20, 16, 5);
  g.fillStyle = "#2563eb";
  g.fill();
  g.fillStyle = "#ef4444";
  g.fillRect(-14, -27, 5, 10);
  g.fillRect(9, -27, 5, 10);
  // kafa + göz
  g.fillStyle = "#ffd9b3";
  g.beginPath();
  g.arc(0, -31, 8.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1f2937";
  g.beginPath();
  g.arc(3.5, -32, 1.6, 0, Math.PI * 2);
  g.fill();
  // kırmızı şapka + siperlik
  g.fillStyle = "#dc2626";
  g.beginPath();
  g.arc(0, -34, 8.8, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(-2, -37.4, 12.5, 3.6);
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

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [flash, setFlash] = useState(false); // normal modda doğru cevapta ışık
  const [resetTick, setResetTick] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    controls.current.paused = paused || gameOver;
    controls.current.over = gameOver;
  }, [paused, gameOver]);

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
    if (t && !t.resolved) playItem(t.target);
  }, []);

  const start = useCallback(() => {
    if (gameOver) return;
    setStarted(true);
    setPaused(false);
  }, [gameOver]);

  const reset = useCallback(() => {
    setScore(0); setStreak(0); setLives(3);
    setGameOver(false); setPaused(true); setStarted(false);
    setQuestion(null); setBanner(null); setFlash(false);
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

    const s = {
      x: 80, y: GROUND_Y - PH, vy: 0, grounded: true, facing: 1 as 1 | -1,
      coyote: 0, jumpBuf: 0, ghostT: 0, camX: 0, safeX: 80, anim: 0, time: 0,
    };
    const w: World = {
      solids: [{ x: -240, y: GROUND_Y, w: 1040, oneWay: false }],
      enemies: [], trios: [], coins: [], pops: [],
      genX: 800, nextQX: 420,
    };
    let score = 0, streak = 0, lives = 3, over = false;
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

    // --- yardımcılar ---

    const loseLife = (silent = false) => {
      if (!silent) playFeedback(false);
      lives -= 1;
      setLives(lives);
      if (lives <= 0) { over = true; setGameOver(true); }
    };

    const respawnX = () => {
      // Kameranın önünde, üzerinde yer olan ilk zemin parçası
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

    const placeTrio = (baseX: number): boolean => {
      const pool = gamePool();
      if (pool.length < 3) return false;
      const target = pickNextGameItem(pool) || pool[0];
      const wrongs = pickN(pool.filter((p) => p.id !== target.id && p.emoji !== target.emoji), 2);
      if (wrongs.length < 2) return false;
      const items = shuffle([target, ...wrongs]);
      const hs = shuffle([84, 138, 84]); // blok alt kenarının zeminden yüksekliği
      const blocks: BlockEnt[] = items.map((it, i) => ({
        x: baseX + i * 122,
        y: GROUND_Y - hs[i] - BLOCK,
        item: it,
        isTarget: it.id === target.id,
      }));
      w.trios.push({
        id: UID++, target, blocks,
        left: baseX, right: baseX + 2 * 122 + BLOCK,
        announced: false, hint: false, resolved: null, doneT: 0,
      });
      return true;
    };

    const genChunk = () => {
      let x = w.genX;
      // zıplanabilir çukur (menzil ~130px; ilk metrelerde çukur yok)
      if (x > 1100 && Math.random() < 0.42) {
        x += 62 + Math.random() * (34 + Math.min(28, score * 0.35));
      }
      const len = 340 + Math.random() * 360;
      w.solids.push({ x, y: GROUND_Y, w: len, oneWay: false });

      const wantQ = !w.trios.some((t) => !t.resolved) && x >= w.nextQX && len >= 440;
      if (wantQ && placeTrio(x + 80)) {
        w.nextQX = x + len + QGAP;
      } else {
        // platform + üstünde harf paraları
        if (len >= 240 && Math.random() < 0.7) {
          const pw2 = 90 + Math.random() * 70;
          const px = x + 40 + Math.random() * Math.max(1, len - pw2 - 80);
          const py = GROUND_Y - (78 + Math.random() * 30);
          w.solids.push({ x: px, y: py, w: pw2, oneWay: true });
          if (Math.random() < 0.75) {
            const pool = gamePool();
            const glyph = pool.length ? pool[Math.floor(Math.random() * pool.length)].emoji || "" : "";
            if (glyph) {
              for (let i = 0; i < 3; i++) {
                w.coins.push({ id: UID++, x: px + pw2 / 2 + (i - 1) * 34, y: py - 28, glyph, taken: false });
              }
            }
          }
        }
        // kestane (düşman) — skorla sıklaşır
        if (len >= 260 && Math.random() < 0.35 + Math.min(0.3, score * 0.004)) {
          const m = 30;
          w.enemies.push({
            id: UID++, x: x + len / 2, y: GROUND_Y - EH,
            dir: Math.random() < 0.5 ? -1 : 1,
            minX: x + m, maxX: x + len - m, squashT: 0,
          });
        }
      }
      w.genX = x + len;
    };

    // İlk soru başlangıç zemininde hazır bekler
    placeTrio(460);
    w.nextQX = 800 + QGAP;

    const hurt = () => {
      streak = 0;
      setStreak(0);
      s.ghostT = GHOST_TIME;
      s.vy = -320;
      loseLife();
    };

    const resolveTrio = (t: TrioEnt, b: BlockEnt) => {
      const correct = b.isTarget;
      t.resolved = { correct };
      t.doneT = 0;
      recordGameAnswer(t.target, correct, { gameId: "platform" });
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
        spawnCoinTrail(t.target);
      } else {
        playFeedback(false);
        streak = 0;
        setStreak(0);
        score = Math.max(0, score - 5);
        setScore(score);
        for (const o of t.blocks) o.state = o === b ? "bad" : o.isTarget ? "good" : "fade";
        // Yanlış cevaplanan harf, moddan bağımsız tekrar sorulsun
        enqueueRetryItem(t.target);
        showBanner(`Doğrusu: ${t.target.translit || t.target.label}`, "bad", 1800);
        loseLife(true);
      }
    };

    // --- simülasyon adımı ---
    const step = (dt: number) => {
      if (over) return;
      const c = controls.current;
      s.time += dt;

      // yatay hareket (geri gitmek serbest ama kamera geri dönmez)
      const mv = c.moveDir;
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
      }
      if (!c.jumpHeld && s.vy < JUMP_CUT) s.vy = JUMP_CUT;

      // dikey fizik + tek yönlü iniş (platformlara alttan geçilir)
      const prevFeet = s.y + PH;
      s.vy = Math.min(s.vy + GRAVITY * dt, MAX_FALL);
      s.y += s.vy * dt;
      s.grounded = false;
      if (s.vy >= 0) {
        for (const so of w.solids) {
          if (s.x + PW <= so.x || s.x >= so.x + so.w) continue;
          if (prevFeet <= so.y + 3 && s.y + PH >= so.y) {
            s.y = so.y - PH;
            s.vy = 0;
            s.grounded = true;
            if (!so.oneWay) s.safeX = Math.min(Math.max(s.x, so.x + 8), so.x + so.w - PW - 8);
          }
        }
      }
      if (s.grounded) s.coyote = COYOTE;
      if (s.ghostT > 0) s.ghostT = Math.max(0, s.ghostT - dt);

      // çukura düşme → can kaybı + güvenli yerde yeniden doğ
      if (s.y > VH + 90) {
        loseLife();
        if (!over) {
          s.x = respawnX();
          s.y = GROUND_Y - PH - 80;
          s.vy = 0;
          s.ghostT = GHOST_TIME;
        }
      }

      // düşmanlar: devriye + çarpışma (üstten ez / yandan hasar al)
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

      // soru üçlüleri
      for (let i = w.trios.length - 1; i >= 0; i--) {
        const t = w.trios[i];
        if (!t.announced && t.left < s.camX + view.w + 80) {
          t.announced = true;
          // ipucu: normal modda her zaman, süper modda yalnız seviye 1
          t.hint = !isSuperRef.current || getGameItemLevel(t.target) === 1;
          trioRef.current = t;
          setQuestion(t.target.translit || t.target.label);
          playItem(t.target);
        }
        if (!t.resolved) {
          for (const b of t.blocks) {
            if (s.x + PW > b.x && s.x < b.x + BLOCK && s.y + PH > b.y && s.y < b.y + BLOCK) {
              resolveTrio(t, b);
              break;
            }
          }
          if (!t.resolved && s.x - t.right > 130) {
            // dokunmadan geçti: cevap sayılmaz, aynı harf kısa sürede tekrar gelir
            t.resolved = { correct: false, missed: true };
            for (const b of t.blocks) b.state = "fade";
            enqueueRetryItem(t.target);
            showBanner("Harfi kaçırdın — tekrar gelecek 🔁", "bad", 1500);
            w.nextQX = s.x + 320;
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

      // kamera + dünya üretimi + temizlik
      s.camX = Math.max(s.camX, s.x - view.w * 0.38);
      while (w.genX < s.camX + view.w * 2.2) genChunk();
      cleanT -= dt;
      if (cleanT <= 0) {
        cleanT = 1;
        const cut = s.camX - 260;
        w.solids = w.solids.filter((so) => so.x + so.w > cut);
        w.enemies = w.enemies.filter((e) => e.maxX > cut);
        w.coins = w.coins.filter((cn) => !cn.taken && cn.x > cut);
        w.trios = w.trios.filter((t) => t.right > cut - 100);
      }
    };

    // --- çizim ---
    const draw = () => {
      const g = ctx;
      g.setTransform(dpr * kScale, 0, 0, dpr * kScale, 0, 0);
      const grad = g.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, "#8ed0f5");
      grad.addColorStop(1, "#e8f7ff");
      g.fillStyle = grad;
      g.fillRect(0, 0, view.w + 2, VH + 2);
      drawClouds(g, s.camX, view.w);
      drawHills(g, s.camX, view.w);

      g.save();
      g.translate(-s.camX, 0);
      const l = s.camX - 60, r = s.camX + view.w + 60;

      for (const so of w.solids) {
        if (so.x + so.w < l || so.x > r) continue;
        if (so.oneWay) drawPlatform(g, so);
        else drawGroundSolid(g, so);
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
          g.drawImage(glyphSprite(b.item.emoji || "?", "block"), bx, by, BLOCK, BLOCK);
          g.globalAlpha = 1;
        }
      }

      for (const e of w.enemies) {
        if (e.x + EW < l || e.x > r) continue;
        drawEnemy(g, e, s.time);
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
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, DT_MAX);
      last = now;
      const c = controls.current;
      if (!c.paused && !c.over) step(dt);
      draw();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
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
        if (paused && !gameOver) { start(); return; }
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
  }, [paused, gameOver, start, replay]);

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
    if (paused && !gameOver) { start(); return; }
    controls.current.jumpQueued = true;
    controls.current.jumpHeld = true;
  };
  const jumpUp = () => { controls.current.jumpHeld = false; };

  // sahneye dokunmak da zıplatır (büyük hedef alanı)
  const onCanvasDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (paused || gameOver) return;
    controls.current.jumpQueued = true;
    controls.current.jumpHeld = true;
  };
  const onCanvasUp = () => {
    controls.current.jumpHeld = false;
    if (paused && !gameOver) start();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🍄 Harf Macerası" backTo="/oyunlar" centered onReset={reset} />

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
          {!paused && !gameOver && (
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

          {/* başlangıç — ilk açılışta tam talimat */}
          {paused && !started && !gameOver && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/85">
              <div className="text-5xl mb-2">🍄</div>
              <div className="text-xl font-extrabold text-warning mb-1">Hazır mısın?</div>
              <div className="text-sm font-bold text-muted-foreground text-center px-6 leading-relaxed">
                Sesi dinle, doğru harf bloğuna dokun!<br />
                ◀ ▶ yürü • Ⓐ zıpla • harf paraları topla 🪙<br />
                Kestaneleri üstlerine zıplayarak ez 🌰<br />
                <span className="text-warning">Başlamak için dokun</span>
              </div>
            </div>
          )}

          {/* duraklatıldı — sahne görünür kalır */}
          {paused && started && !gameOver && (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <div className="rounded-2xl bg-background/90 px-6 py-4 text-center shadow-card border-2 border-border">
                <div className="text-lg font-extrabold text-foreground mb-1">⏸ Duraklatıldı</div>
                <div className="text-xs font-bold text-muted-foreground">Devam için dokun</div>
              </div>
            </div>
          )}

          {/* oyun bitti */}
          {gameOver && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/95">
              <div className="text-4xl mb-2">😢</div>
              <div className="text-2xl font-extrabold text-destructive mb-2">Oyun Bitti</div>
              <div className="text-sm font-bold text-muted-foreground mb-4">Puan: {score}</div>
              <button
                onClick={reset}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-extrabold shadow-soft active:scale-95"
              >
                Tekrar Oyna
              </button>
            </div>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground">
          ◀ ▶ yürü • Ⓐ zıpla • Doğru harf bloğuna dokun, harf paraları topla!
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

        {paused && !gameOver && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-full bg-success text-success-foreground px-6 py-2.5 font-extrabold shadow-soft active:scale-95"
            >
              <Play className="h-5 w-5" /> {started ? "Devam Et" : "Başla"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PlatformGame;
