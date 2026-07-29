// 🌳 "Harf Bahçem" — büyüyen bahçe meta-oyunu.
//
// DAVRANIŞ BİLİMİ (yatırım/sünk-maliyet kancasının ETİK sürümü): çocuk
// çalıştıkça KENDİNE ait kalıcı bir dünya büyür → yarın geri gelme motivasyonu
// (koleksiyon mekaniği). Zorlama/korku yok; sadece "benim bahçem gelişiyor"
// gururu. Bahçe TAMAMEN mevcut SRS verisinden TÜRETİLİR (ayrı kayıt yok,
// desenkron olamaz): her ustalaşılan (L4) öğe bir çiçek açar, tomurcuklanan
// (L3) öğe bir filiz olur, biten her konu bir ağaç diker. Kelebek/kuş/çeşme
// gibi canlılık toplam ustalıkla; güneş/gökkuşağı günlük seriyle artar.
//
// Canvas sahnesi: gündüz/gece gökyüzü (cihaz saatine göre), yumuşak animasyon,
// dpr'a duyarlı, arka planda otomatik durur. Platform oyunuyla aynı çocuk
// karakteri (süreklilik + sıcaklık).
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getAllTopics } from "@/data/subjects";
import { getTopicSrs, useSrsTick } from "@/data/srs";
import { getStreak, STREAK_EVENT } from "@/lib/streak";
import { cn } from "@/lib/utils";

// ---- sabitler ----
const VH = 360;
const GROUND_Y = 232;      // çim üst çizgisi
const SEEN_KEY = "elifba-garden-seen-v1";

// konu → çiçek rengi (hue). Sıra elifbaTopics ile aynı.
const TOPIC_HUES = [340, 28, 200, 130, 275, 190, 95, 45, 305, 160];

interface Flower { x: number; d: number; hue: number; kind: "flower" | "bud"; seed: number }
interface TreeEnt { x: number; hue: number; seed: number }
interface Garden {
  flowers: Flower[];
  trees: TreeEnt[];
  mastered: number;    // toplam L4
  budding: number;     // toplam L3
  topics: { title: string; emoji: string; hue: number; mastered: number; total: number; done: boolean }[];
}

function hash01(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// SRS'ten bahçeyi türet
function buildGarden(): Garden {
  const topics = getAllTopics().filter((t) => !t.noPractice && t.items.length > 0);
  const flowers: Flower[] = [];
  const trees: TreeEnt[] = [];
  const topicStats: Garden["topics"] = [];
  let mastered = 0, budding = 0;
  topics.forEach((t, ti) => {
    const hue = TOPIC_HUES[ti % TOPIC_HUES.length];
    const srs = getTopicSrs("quiz", t.id);
    let tm = 0;
    for (const it of t.items) {
      const lvl = srs[it.id]?.level ?? 1;
      const seed = strHash(it.id);
      if (lvl >= 4) {
        flowers.push({ x: seed, d: hash01(seed * 991 + ti), hue, kind: "flower", seed });
        mastered++; tm++;
      } else if (lvl === 3) {
        flowers.push({ x: seed, d: hash01(seed * 991 + ti), hue, kind: "bud", seed });
        budding++;
      }
    }
    const done = tm === t.items.length && t.items.length > 0;
    if (done) trees.push({ x: (ti + 0.5) / topics.length, hue, seed: strHash(t.id) });
    topicStats.push({ title: t.title, emoji: t.emoji, hue, mastered: tm, total: t.items.length, done });
  });
  // arkadan öne çiz (derinlik)
  flowers.sort((a, b) => a.d - b.d);
  return { flowers, trees, mastered, budding, topics: topicStats };
}

type Phase = "morning" | "noon" | "evening" | "night";
function timePhase(): Phase {
  const h = new Date().getHours();
  if (h < 7) return "night";
  if (h < 11) return "morning";
  if (h < 17) return "noon";
  if (h < 20) return "evening";
  return "night";
}
const SKY: Record<Phase, [string, string]> = {
  morning: ["#8ecbf0", "#fde9c8"],
  noon: ["#5db4ee", "#d7f0ff"],
  evening: ["#7a5cc0", "#fbb36b"],
  night: ["#1e2b4d", "#3d5580"],
};

// ---- çizim yardımcıları ----
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

function drawFlower(g: CanvasRenderingContext2D, x: number, y: number, sc: number, hue: number, t: number, seed: number, bloom: number) {
  const sway = Math.sin(t * 1.6 + seed * 20) * 0.12;
  g.save();
  g.translate(x, y);
  g.rotate(sway);
  g.scale(sc * bloom, sc * bloom);
  // sap
  g.strokeStyle = "#3f9d45";
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -14); g.stroke();
  // yaprak
  g.fillStyle = "#4caf50";
  g.beginPath(); g.ellipse(3, -6, 3.2, 1.8, -0.6, 0, Math.PI * 2); g.fill();
  // taç yaprakları — büyük ve konu renginde (renk baskın olsun)
  const petals = 5;
  g.fillStyle = `hsl(${hue} 80% 60%)`;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + t * 0.2;
    g.beginPath();
    g.ellipse(Math.cos(a) * 5, -18 + Math.sin(a) * 5, 5, 3.4, a, 0, Math.PI * 2);
    g.fill();
  }
  // koyu ton iç halka (derinlik)
  g.fillStyle = `hsl(${hue} 72% 48%)`;
  g.beginPath(); g.arc(0, -18, 3.2, 0, Math.PI * 2); g.fill();
  // küçük merkez
  g.fillStyle = "#fde047";
  g.beginPath(); g.arc(0, -18, 1.7, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawBud(g: CanvasRenderingContext2D, x: number, y: number, sc: number, hue: number, t: number, seed: number) {
  const sway = Math.sin(t * 1.6 + seed * 20) * 0.12;
  g.save();
  g.translate(x, y);
  g.rotate(sway);
  g.scale(sc, sc);
  g.strokeStyle = "#3f9d45";
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -10); g.stroke();
  // yaprakçıklar
  g.fillStyle = "#4caf50";
  g.beginPath(); g.ellipse(-2.5, -6, 2.4, 1.4, 0.6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(2.5, -6, 2.4, 1.4, -0.6, 0, Math.PI * 2); g.fill();
  // tomurcuk
  g.fillStyle = `hsl(${hue} 55% 58%)`;
  g.beginPath(); g.ellipse(0, -12.5, 2.6, 3.6, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawTree(g: CanvasRenderingContext2D, x: number, baseY: number, sc: number, hue: number) {
  g.save();
  g.translate(x, baseY);
  g.scale(sc, sc);
  g.fillStyle = "#8a5a34";
  g.fillRect(-4, -34, 8, 34);
  const leaf = `hsl(${(hue + 90) % 360} 45% 46%)`;
  g.fillStyle = leaf;
  g.beginPath();
  g.arc(0, -44, 17, 0, Math.PI * 2);
  g.arc(-13, -36, 11, 0, Math.PI * 2);
  g.arc(13, -36, 11, 0, Math.PI * 2);
  g.fill();
  // birkaç meyve/çiçek (konu rengiyle)
  g.fillStyle = `hsl(${hue} 80% 62%)`;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7;
    g.beginPath(); g.arc(Math.cos(a) * 12, -42 + Math.sin(a) * 10, 2.4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawButterfly(g: CanvasRenderingContext2D, x: number, y: number, t: number, hue: number, seed: number) {
  const flap = Math.abs(Math.sin(t * 8 + seed * 10));
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 2 + seed) * 0.2);
  g.fillStyle = `hsl(${hue} 80% 65%)`;
  for (const sd of [-1, 1]) {
    g.save();
    g.scale(sd, 1);
    g.beginPath();
    g.ellipse(3 + flap * 2, -2, 3.4 - flap, 4.2, -0.4, 0, Math.PI * 2);
    g.ellipse(3 + flap * 2, 3, 2.6 - flap * 0.6, 3, 0.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = "#3b2a1a";
  g.beginPath(); g.ellipse(0, 0, 1, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// Platform oyunuyla aynı çocuk (küçük, süreklilik)
function drawKid(g: CanvasRenderingContext2D, x: number, baseY: number, sc: number, t: number) {
  g.save();
  g.translate(x, baseY);
  g.scale(sc, sc);
  const bob = Math.sin(t * 2) * 0.6;
  g.translate(0, bob);
  // bacaklar + ayakkabı
  g.fillStyle = "#f5c093"; g.fillRect(-6, -10, 5, 10); g.fillRect(1, -10, 5, 10);
  g.fillStyle = "#ef4444"; rr(g, -8, -4, 9, 4, 2); g.fill(); rr(g, 0, -4, 9, 4, 2); g.fill();
  g.fillStyle = "#3b82f6"; rr(g, -8, -17, 16, 9, 3); g.fill();       // şort
  g.fillStyle = "#f59e0b"; rr(g, -9, -28, 18, 13, 4); g.fill();      // tişört
  g.fillRect(-12, -27, 4, 8); g.fillRect(8, -27, 4, 8);
  g.fillStyle = "#ffd9b3"; g.beginPath(); g.arc(0, -35, 9, 0, Math.PI * 2); g.fill(); // kafa
  g.fillStyle = "#6b4226"; g.beginPath(); g.arc(0, -36.5, 9.2, Math.PI, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(-5, -41, 4, 0, Math.PI * 2); g.arc(0, -43, 4.4, 0, Math.PI * 2); g.arc(5, -41, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1f2937"; g.beginPath(); g.arc(3.5, -35.5, 1.6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#7c2d12"; g.lineWidth = 1.3; g.beginPath(); g.arc(2.5, -32, 2.8, 0.15, Math.PI * 0.7); g.stroke();
  // sulama kabı (elinde)
  g.fillStyle = "#38bdf8"; rr(g, 9, -20, 8, 7, 2); g.fill();
  g.fillRect(16, -19, 4, 2);
  g.restore();
}

const Bahce = () => {
  useSrsTick("quiz");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gardenRef = useRef<Garden>(buildGarden());
  const [garden, setGarden] = useState<Garden>(gardenRef.current);
  const [streak, setStreak] = useState(() => getStreak());
  const [newBloom, setNewBloom] = useState(0);
  const bloomStartRef = useRef<Record<number, number>>({}); // yeni açan çiçek indeks→başlangıç zamanı

  // SRS/streak değişince bahçeyi tazele
  useEffect(() => {
    const refresh = () => {
      const g = buildGarden();
      gardenRef.current = g;
      setGarden(g);
      setStreak(getStreak());
    };
    window.addEventListener("elifba-srs-quiz-updated", refresh);
    window.addEventListener("elifba-progress-updated", refresh);
    window.addEventListener(STREAK_EVENT, refresh);
    return () => {
      window.removeEventListener("elifba-srs-quiz-updated", refresh);
      window.removeEventListener("elifba-progress-updated", refresh);
      window.removeEventListener(STREAK_EVENT, refresh);
    };
  }, []);

  // "son ziyaretten beri yeni açan çiçek" kutlaması
  useEffect(() => {
    let prev = 0;
    try { prev = parseInt(localStorage.getItem(SEEN_KEY) || "0", 10) || 0; } catch { /* ignore */ }
    const now = gardenRef.current.mastered;
    if (now > prev) setNewBloom(now - prev);
    try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
  }, []);

  const phase = timePhase();

  // canvas render döngüsü
  const draw = useCallback(() => {
    const box = boxRef.current, canvas = canvasRef.current;
    if (!box || !canvas) return () => {};
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let dpr = 1, kScale = 1, view = { w: 576, h: VH };
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

    let raf = 0, last = performance.now(), time = 0;
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((nowMs - last) / 1000, 0.05);
      last = nowMs;
      if (!document.hidden) time += dt;
      const g = ctx;
      const G = gardenRef.current;
      const st = getStreak();
      g.setTransform(dpr * kScale, 0, 0, dpr * kScale, 0, 0);

      // gökyüzü
      const [c0, c1] = SKY[phase];
      const grad = g.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, c0); grad.addColorStop(1, c1);
      g.fillStyle = grad; g.fillRect(0, 0, view.w + 2, VH + 2);

      // yıldızlar (gece)
      if (phase === "night") {
        for (let i = 0; i < 40; i++) {
          const sx = hash01(i * 13) * view.w, sy = hash01(i * 29) * (GROUND_Y - 40);
          g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.3 + i));
          g.fillStyle = "#fef9c3"; g.fillRect(sx, sy, 1.6, 1.6);
        }
        g.globalAlpha = 1;
      }

      // güneş/ay — seri arttıkça güneş büyür ve ışınları hızlanır
      const streakBoost = Math.min(1, st.count / 14);
      const cx = view.w - 56, cy = 50;
      if (phase === "night") {
        g.fillStyle = "#fef3c7"; g.beginPath(); g.arc(cx, cy, 18, 0, Math.PI * 2); g.fill();
        g.fillStyle = SKY.night[0]; g.beginPath(); g.arc(cx + 6, cy - 4, 15, 0, Math.PI * 2); g.fill();
      } else {
        const R = 16 + streakBoost * 8;
        g.save(); g.translate(cx, cy); g.rotate(time * (0.1 + streakBoost * 0.3));
        g.strokeStyle = "rgba(253,224,71,0.75)"; g.lineWidth = 3;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          g.beginPath(); g.moveTo(Math.cos(a) * (R + 4), Math.sin(a) * (R + 4)); g.lineTo(Math.cos(a) * (R + 12), Math.sin(a) * (R + 12)); g.stroke();
        }
        g.restore();
        g.fillStyle = "#fde047"; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      }

      // gökkuşağı (yüksek seri ödülü)
      if (st.count >= 7) {
        const cols = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
        for (let k = 0; k < cols.length; k++) {
          g.strokeStyle = cols[k]; g.lineWidth = 5; g.globalAlpha = 0.5;
          g.beginPath(); g.arc(view.w * 0.32, GROUND_Y + 20, 120 - k * 5, Math.PI, Math.PI * 2); g.stroke();
        }
        g.globalAlpha = 1;
      }

      // bulutlar
      g.fillStyle = phase === "night" ? "rgba(148,163,184,0.4)" : "rgba(255,255,255,0.9)";
      for (let i = 0; i < 4; i++) {
        const bx = ((hash01(i * 7) * view.w + time * (6 + i * 3)) % (view.w + 100)) - 50;
        const by = 26 + hash01(i * 3 + 1) * 46, s = 0.7 + hash01(i * 5) * 0.6;
        g.beginPath();
        g.arc(bx, by, 15 * s, 0, Math.PI * 2); g.arc(bx + 14 * s, by + 4 * s, 11 * s, 0, Math.PI * 2); g.arc(bx - 14 * s, by + 4 * s, 10 * s, 0, Math.PI * 2);
        g.fill();
      }

      // tepeler
      for (let i = 0; i < 4; i++) {
        const hx = (i / 3) * view.w + hash01(i) * 60;
        g.fillStyle = i % 2 ? "#8fd889" : "#a7e3a0";
        g.beginPath(); g.arc(hx, GROUND_Y + 6, 60 + hash01(i * 2) * 40, Math.PI, Math.PI * 2); g.fill();
      }

      // çim
      const gg = g.createLinearGradient(0, GROUND_Y, 0, VH);
      gg.addColorStop(0, "#63c56d"); gg.addColorStop(1, "#3f9d45");
      g.fillStyle = gg; g.fillRect(0, GROUND_Y, view.w + 2, VH - GROUND_Y + 2);

      // ambiyans dekoru: çim öbekleri + minik kır çiçekleri (ilerlemeden
      // bağımsız — az çiçekli bahçe bile canlı/davetkâr görünsün)
      const meadowH = VH - (GROUND_Y + 14);
      for (let i = 0; i < 46; i++) {
        const gx = hash01(i * 5.3) * view.w;
        const gy = GROUND_Y + 14 + hash01(i * 9.1) * meadowH;
        const sc2 = 0.6 + (gy - GROUND_Y) / meadowH * 0.8;
        const sw = Math.sin(time * 1.4 + i) * 1.2;
        g.strokeStyle = "rgba(47,120,60,0.55)"; g.lineWidth = 1.4 * sc2;
        for (let k = -1; k <= 1; k++) {
          g.beginPath(); g.moveTo(gx, gy);
          g.quadraticCurveTo(gx + k * 2 + sw, gy - 4 * sc2, gx + k * 3.5 + sw, gy - 8 * sc2); g.stroke();
        }
      }
      for (let i = 0; i < 16; i++) {
        const wx = hash01(i * 7.7 + 3) * view.w;
        const wy = GROUND_Y + 16 + hash01(i * 4.2 + 1) * meadowH;
        const sc2 = 0.5 + (wy - GROUND_Y) / meadowH * 0.6;
        g.fillStyle = "rgba(255,255,255,0.9)";
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(wx + Math.cos(a) * 2.2 * sc2, wy + Math.sin(a) * 2.2 * sc2, 1.5 * sc2, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#fde047"; g.beginPath(); g.arc(wx, wy, 1.3 * sc2, 0, Math.PI * 2); g.fill();
      }

      // ağaçlar (biten konular) — arkada
      for (const tr of G.trees) drawTree(g, tr.x * (view.w - 40) + 20, GROUND_Y + 14, 0.9, tr.hue);

      // çiçekler + filizler (arkadan öne)
      const meadowTop = GROUND_Y + 18, meadowBot = VH - 6;
      G.flowers.forEach((f, idx) => {
        const fx = 18 + f.x * (view.w - 36);
        const fy = meadowTop + f.d * (meadowBot - meadowTop);
        const sc = 0.62 + f.d * 0.75;
        if (f.kind === "bud") { drawBud(g, fx, fy, sc, f.hue, time, f.seed); return; }
        // yeni açanlar için açılma animasyonu (0→1)
        let bloom = 1;
        const startIdx = G.flowers.length - newBloom;
        if (newBloom > 0 && idx >= startIdx) {
          const key = idx;
          if (bloomStartRef.current[key] === undefined) bloomStartRef.current[key] = time + (idx - startIdx) * 0.25;
          const el = time - bloomStartRef.current[key];
          bloom = el < 0 ? 0 : Math.min(1, el * 1.6);
          if (bloom < 1) {
            g.fillStyle = "rgba(253,224,71,0.5)";
            g.beginPath(); g.arc(fx, fy - 18 * sc, 10 * (1 - bloom), 0, Math.PI * 2); g.fill();
          }
        }
        drawFlower(g, fx, fy, sc, f.hue, time, f.seed, bloom);
      });

      // kelebekler (ustalıkla artar, en çok 8)
      const nB = Math.min(8, Math.floor(G.mastered / 6));
      for (let i = 0; i < nB; i++) {
        const px = (view.w * 0.5) + Math.sin(time * 0.6 + i * 2) * (view.w * 0.42);
        const py = GROUND_Y - 4 + Math.sin(time * 1.1 + i * 3) * 26 - (i % 3) * 8;
        drawButterfly(g, px, py, time, TOPIC_HUES[i % TOPIC_HUES.length], i + 1);
      }

      // çocuk — ön planda, sadece en az 1 çiçek varsa
      if (G.mastered + G.budding > 0) drawKid(g, view.w * 0.16, VH - 8, 1.05, time);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [phase, newBloom]);

  useEffect(() => draw(), [draw]);

  const totalItems = garden.topics.reduce((a, t) => a + t.total, 0);
  const pct = totalItems ? Math.round((garden.mastered / totalItems) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-success/10 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🌳 Harf Bahçem" backTo="/" centered />

        {/* özet şerit */}
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">🌸 Açan Çiçek</div>
            <div className="text-xl font-extrabold text-success">{garden.mastered}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-topic-doga/40">
            <div className="text-[10px] font-bold text-muted-foreground">🌳 Ağaç</div>
            <div className="text-xl font-extrabold text-topic-doga">{garden.trees.length}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-warning/30">
            <div className="text-[10px] font-bold text-muted-foreground">🔥 Seri</div>
            <div className="text-xl font-extrabold text-warning">{streak.count}</div>
          </div>
        </div>

        <div
          ref={boxRef}
          className="relative w-full overflow-hidden rounded-2xl shadow-card border-4 border-success/40 bg-sky-200"
          style={{ aspectRatio: "16 / 10", maxHeight: "58vh", margin: "0 auto", contain: "layout paint size" }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {newBloom > 0 && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-2xl bg-success px-4 py-2 font-extrabold text-white shadow-card animate-bounce-in whitespace-nowrap">
              🌸 Bahçende {newBloom} yeni çiçek açtı!
            </div>
          )}

          {garden.mastered + garden.budding === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70 text-center px-6">
              <div className="text-4xl mb-2">🌱</div>
              <div className="text-base font-extrabold text-success mb-1">Bahçen seni bekliyor</div>
              <div className="text-xs font-bold text-muted-foreground leading-relaxed">
                Bir harfi ustalaşınca ilk çiçeğin açacak! Alıştırma yap, bahçeni büyüt. 🌸
              </div>
            </div>
          )}
        </div>

        {/* genel ilerleme */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] font-extrabold text-muted-foreground whitespace-nowrap">Bahçe %{pct} doldu</span>
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden border border-border">
            <div className="h-full rounded-full bg-gradient-to-r from-success to-warning transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm">🌷</span>
        </div>

        {/* konu tarhları (renk lejantı + ilerleme) */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {garden.topics.map((t) => (
            <div key={t.title} className={cn("flex items-center gap-2 rounded-xl bg-card p-2 shadow-soft border-2", t.done ? "border-success/50" : "border-border/40")}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${t.hue} 78% 62%)` }}>
                <span className="text-xs">{t.done ? "🌳" : "🌸"}</span>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-extrabold text-foreground truncate">{t.emoji} {t.title.replace(/^\d+\.\s*/, "")}</div>
                <div className="text-[10px] font-bold text-muted-foreground">{t.mastered}/{t.total} çiçek</div>
              </div>
              {t.done && <span className="text-[10px] font-extrabold text-success">✓</span>}
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground leading-relaxed">
          Her ustalaştığın harf bir çiçek açar 🌸 · Biten konu bir ağaç olur 🌳 · Her gün gel, bahçeni büyüt!
        </p>
      </main>
    </div>
  );
};

export default Bahce;
