// 🎉 ELİFBÂ PARTİSİ — 3B engel parkuru (Fall Guys tarzı), botlarla yarış.
//
// OYUN: çocuk 5 botla birlikte 3B bir parkurda BİTİŞE varmaya çalışır.
// Yolda Fall Guys engelleri vardır: dönen ÇEKİÇLER, sallanan SARKAÇLAR,
// yerden geçen DÖNEN ÇUBUK (zıplayarak atlanır), yana kayan SİLİNDİRLER,
// yavaşlatan ÇAMUR havuzları. Sonda taç 👑 vardır.
//
// EĞİTİCİ KATMAN: parkurun arasına SORU KAPILARI serpilir (Fall Guys'ın
// "Door Dash" bölümünün öğretici hâli). Ses "Elif" der, önde üç kapı belirir,
// çocuk doğru harfin kapısından geçmelidir:
//   • doğru kapı  → 🚀 hız + sırayla 🕸️ ağ / ⭐ süper zıplama kozu
//   • yanlış kapı → 💦 çamur (yavaşlar; kimse elenmez, çocuk oyundan atılmaz)
//
// TEKRAR SİSTEMİ KORUNUR: kapı hedefi pickNextGameItem'dan, şıklar pickWrongs
// (karışan harfler) ile kurulur, cevap recordGameAnswer'a chosenId/shownIds
// ile yazılır, yanlışta telafi kuyruğa girer ve yarış bitince açılır.
//
// ŞİDDETSİZ: çekiç kimseyi "öldürmez" — değen karakter takla atıp geri kayar,
// canı gitmez, elenmez. Ağ atmak rakibi yalnızca yavaşlatır.
//
// NEDEN R3F DEĞİL DÜZ three.js: parkur her karede mutasyona uğrayan ~40 hareketli
// gövde (çekiç kolları, sarkaçlar, 6 yarışmacı, çarpışmalar). Bunları React
// ağacına bağlamak her kare için gereksiz reconcile demek olurdu; sahne bir kez
// kurulur, döngü imperative çalışır, React yalnız HUD'u çizer.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { ArrowLeft, ArrowRight, Volume2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { gamePool, pickWrongs, shuffle } from "./_shared";
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { playItem, playFeedback, playSfx } from "@/lib/audio";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { gardenTease } from "@/lib/sessionEnd";
import type { ContentItem } from "@/data/types";

// ---- parkur sabitleri (birim ≈ 1 metre) ----
const TRACK_LEN = 470;         // uzun parkur: kapılar arasına bol engel sığsın
const ROAD_HALF = 9;           // geniş yol — engeller büyüdü, kaçacak yer lazım
const BASE_SPEED = 11.5;       // birim/sn
const BOOST_SPEED = 17;
const MUD_SPEED = 4.6;
const HIT_SPEED = 3.2;         // çekiç yedikten sonraki toparlanma hızı
const STEER = 8.5;             // yana hız
const GRAVITY = 30;
const JUMP_V = 12.4;           // tepe ≈ 2.6 birim — çubuk için rahat pay
const JUMP_CLEAR = 1.5;        // bu yükseklikten sonra dönen çubuk değmez
const BOOST_TIME = 3.5;
const MUD_TIME = 1.8;
const NET_TIME = 2.2;
const HIT_TIME = 1.0;          // takla süresi
const SUPER_JUMP_MUL = 1.45;   // ⭐ kozu: daha yükseğe
const RACERS = 6;
const DT_MAX = 0.05;
const FINISH_Z = TRACK_LEN;

const BOT_NAMES = ["Zeynep", "Yusuf", "Ayşe", "Ömer", "Elif"];
const BOT_COLORS = [0xf59e0b, 0xef4444, 0x8b5cf6, 0x06b6d4, 0xec4899];
const PLAYER_COLOR = 0x22c55e;

// ================= Arapça harf dokusu =================
// Harf gerçek piksel sınırları ölçülerek panoya SIĞDIRILIR: derin çanaklı
// harfler (ج ح خ ع غ) kesilmez, ufak harfler panoyu doldurur.
const FONT_STACK = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif';
const texCache = new Map<string, THREE.CanvasTexture>();
function letterTexture(text: string): THREE.CanvasTexture {
  const hit = texCache.get(text);
  if (hit) return hit;
  const cW = 512, cH = 512;
  const c = document.createElement("canvas");
  c.width = cW; c.height = cH;
  const g = c.getContext("2d")!;
  g.direction = "rtl";
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, cW, cH);
  const base = 320;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `${base}px ${FONT_STACK}`;
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent || base * 0.75;
  const desc = m.actualBoundingBoxDescent || base * 0.25;
  const w = Math.max((m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0), m.width, 1);
  const pad = 60;
  const scale = Math.min((cH - pad * 2) / (asc + desc), (cW - pad * 2) / w, 1.6);
  const size = Math.floor(base * scale);
  g.font = `${size}px ${FONT_STACK}`;
  const m2 = g.measureText(text);
  const asc2 = m2.actualBoundingBoxAscent || size * 0.75;
  const desc2 = m2.actualBoundingBoxDescent || size * 0.25;
  g.fillStyle = "#065f46";
  g.fillText(text, cW / 2, (cH - (asc2 + desc2)) / 2 + asc2);
  const t = new THREE.CanvasTexture(c);
  texCache.set(text, t);
  return t;
}

/**
 * Karakter yüzü — tek bir şeffaf doku olarak gövdenin önüne yapıştırılır.
 * 3B primitiflerle (küre göz + küre bebek) yapılan yüz cansız duruyordu;
 * çizilmiş yüz hem çok daha sevimli hem de tek çizim çağrısı.
 */
const faceTexture = (() => {
  let cached: THREE.CanvasTexture | null = null;
  return () => {
    if (cached) return cached;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const g = c.getContext("2d")!;
    // yanak allığı
    g.fillStyle = "rgba(255,120,160,0.42)";
    g.beginPath(); g.ellipse(52, 158, 26, 17, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(204, 158, 26, 17, 0, 0, Math.PI * 2); g.fill();
    // gözler (büyük, parlak — çocuk oyunlarının "sevimli" formülü)
    for (const ex of [88, 168]) {
      g.fillStyle = "#ffffff";
      g.beginPath(); g.ellipse(ex, 108, 30, 34, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1f2937";
      g.beginPath(); g.ellipse(ex + 3, 114, 16, 19, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(ex - 4, 104, 7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ex + 10, 122, 3.4, 0, Math.PI * 2); g.fill();
    }
    // gülümseme
    g.strokeStyle = "#1f2937";
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.arc(128, 158, 30, 0.18 * Math.PI, 0.82 * Math.PI);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    cached = t;
    return t;
  };
})();

/** İsim etiketi dokusu (botların üstünde uçan tabela) */
function nameTexture(name: string, color: string): THREE.CanvasTexture {
  const key = `n:${name}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.beginPath();
  const r = 22;
  g.moveTo(r, 4); g.arcTo(252, 4, 252, 60, r); g.arcTo(252, 60, 4, 60, r);
  g.arcTo(4, 60, 4, 4, r); g.arcTo(4, 4, 252, 4, r); g.closePath(); g.fill();
  g.fillStyle = color;
  g.font = "700 34px system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(name, 128, 34);
  const t = new THREE.CanvasTexture(c);
  texCache.set(key, t);
  return t;
}

// ================= tipler =================
type Phase = "intro" | "race" | "finish";

/** Parkur engelleri — hepsi z ekseninde sıralı, çarpışması basit geometri */
type Obstacle =
  /** Dönen çekiç: direkte dönen kol, ucunda kafa. Kafaya değersen takla. */
  | { kind: "hammer"; z: number; x: number; t: number; sp: number; arm: number; head: THREE.Object3D }
  /** Sallanan sarkaç top: yandan yana savrulur. */
  | { kind: "pendulum"; z: number; x: number; t: number; sp: number; amp: number; head: THREE.Object3D }
  /** Yerden geçen dönen çubuk: ZIPLAyarak atlanır (alçak). */
  | { kind: "spinner"; z: number; t: number; sp: number; len: number; bar: THREE.Object3D }
  /** Yana kayan silindir: kaçmak için şerit değiştirilir. */
  | { kind: "roller"; z: number; t: number; sp: number; span: number; body: THREE.Object3D }
  /** Çamur havuzu: içindeyken yavaşlarsın (öldürmez). */
  | { kind: "mud"; z: number; x: number; w: number; d: number };

interface Gate {
  z: number;
  target: ContentItem;
  options: ContentItem[];   // 3 şık, soldan sağa
  done: boolean;
  botDone: Set<number>;
  panels: THREE.Mesh[];     // şık panoları (doğru/yanlış renklendirmesi için)
  group: THREE.Group;       // geçildikten sonra gizlenir (kamerayı kapatmasın)
}

interface Racer {
  id: number;
  name: string;
  isPlayer: boolean;
  z: number;              // parkur boyunca ilerleme
  x: number;              // -ROAD_HALF..ROAD_HALF
  y: number;              // zıplama yüksekliği (ayak seviyesi 0)
  vy: number;
  boostT: number;
  mudT: number;
  netT: number;
  hitT: number;           // takla süresi
  skill: number;          // 0..1 — bot kapı/engel becerisi
  targetX: number;
  homeX: number;
  gateChoice: number | null;
  finished: number | null;
  hop: number;
  group: THREE.Group;
  body: THREE.Group;      // gövde + yüz + şapka (birlikte eğilir/takla atar)
  legs: [THREE.Object3D, THREE.Object3D];
  arms: [THREE.Object3D, THREE.Object3D];
}

const PartyGame = () => {
  const navigate = useNavigate();
  useLockBodyScroll();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [hud, setHud] = useState({ place: 1, pct: 0, nets: 0, jumps: 0, correct: 0, wrong: 0 });
  const [prompt, setPrompt] = useState<ContentItem | null>(null);
  const [flash, setFlash] = useState<{ k: number; text: string; good: boolean } | null>(null);
  const [result, setResult] = useState<{ place: number; correct: number; wrong: number } | null>(null);
  const teaseRef = useRef(gardenTease());

  useRemedyOnGameOver(phase === "finish");

  // --- oyun durumu: render döngüsünde mutasyon; React state yalnız HUD ---
  const racersRef = useRef<Racer[]>([]);
  const gatesRef = useRef<Gate[]>([]);
  const obsRef = useRef<Obstacle[]>([]);
  const netsRef = useRef<{ mesh: THREE.Object3D; x: number; z: number; from: number }[]>([]);
  const ctrlRef = useRef({ dir: 0 as -1 | 0 | 1, jump: false, useNet: false, useJump: false, running: false });
  const netCountRef = useRef(0);
  const jumpCountRef = useRef(0);
  const statsRef = useRef({ correct: 0, wrong: 0 });
  const flashK = useRef(0);
  const promptIdRef = useRef<string | null>(null);
  const [raceKey, setRaceKey] = useState(0);   // her yarışta sahne baştan kurulsun

  const showFlash = (text: string, good: boolean) => {
    flashK.current += 1;
    setFlash({ k: flashK.current, text, good });
    setTimeout(() => setFlash(null), 1200);
  };

  const start = useCallback(() => {
    setRaceKey((k) => k + 1);
    setResult(null);
    setPrompt(null);
    promptIdRef.current = null;
    setHud({ place: 1, pct: 0, nets: 0, jumps: 0, correct: 0, wrong: 0 });
    setPhase("race");
    wrapRef.current?.requestFullscreen?.().catch(() => { /* izin yoksa sorun değil */ });
  }, []);

  // ================= sahne + oyun döngüsü =================
  useEffect(() => {
    if (phase !== "race") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ad9ff);
    // Sis uzakta başlasın: yakın başlayınca soru kapıları daha okunmadan
    // gökyüzüne karışıyordu, çocuk harfi seçemiyordu.
    scene.fog = new THREE.Fog(0x9ad9ff, 110, 260);

    // Dikey ekran → geniş dikey FOV: ileriyi de yolun genişliğini de görsün
    const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe3ff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(-14, 30, 12);
    scene.add(sun);

    const disposables: { dispose(): void }[] = [];
    const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => { disposables.push(x); return x; };

    // ---------- yol ----------
    // Fall Guys pastel şeritleri: her 20 birimde renk değişir → hız hissi.
    const roadGeo = track(new THREE.BoxGeometry(ROAD_HALF * 2, 1, 20));
    const STRIPES = [0xffd6ec, 0xd9f7ff, 0xfff2c9, 0xd8ffe6];
    for (let i = 0; i < Math.ceil((TRACK_LEN + 60) / 20); i++) {
      const m = new THREE.Mesh(roadGeo, track(new THREE.MeshLambertMaterial({ color: STRIPES[i % STRIPES.length] })));
      m.position.set(0, -0.5, -20 + i * 20 + 10);
      scene.add(m);
    }
    // yumuşak kenar duvarları (çocuk yoldan düşmez — Fall Guys'taki şişme bariyer)
    const wallGeo = track(new THREE.BoxGeometry(0.9, 1.6, TRACK_LEN + 80));
    const wallMat = track(new THREE.MeshLambertMaterial({ color: 0xff8fc4 }));
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(s * (ROAD_HALF + 0.45), 0.4, TRACK_LEN / 2 - 10);
      scene.add(w);
    }

    // ---------- parti dekoru ----------
    // Çıplak yol + boş gökyüzü "parti" hissi vermiyordu: yol kenarına balon
    // kuleleri, arkaya pastel tepeler. Hepsi çarpışmasız, sadece atmosfer.
    const balloonGeo = track(new THREE.SphereGeometry(0.9, 12, 10));
    const BALLOON_COLORS = [0xf472b6, 0xfbbf24, 0x60a5fa, 0xa78bfa, 0x4ade80];
    const balloonMats = BALLOON_COLORS.map((c) => track(new THREE.MeshLambertMaterial({ color: c })));
    const stringMat = track(new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
    const decor: { mesh: THREE.Object3D; base: number; ph: number }[] = [];
    // Balonlar yoldan UZAK ve YÜKSEKTE durmalı: yola yakın olunca çocuk
    // onları da engel sanıp gereksiz yere kaçıyor.
    const BAL_X = ROAD_HALF + 5.5;
    for (let z = 10; z < TRACK_LEN + 20; z += 16) {
      for (const s of [-1, 1]) {
        const k = Math.floor(z / 16) % BALLOON_COLORS.length;
        const b = new THREE.Mesh(balloonGeo, balloonMats[(k + (s > 0 ? 2 : 0)) % balloonMats.length]);
        const base = 6.5 + ((z / 16) % 3) * 1.1;
        b.position.set(s * BAL_X, base, z);
        b.scale.y = 1.25;
        scene.add(b);
        decor.push({ mesh: b, base, ph: z * 0.7 });
        const str = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, base, 6)), stringMat);
        str.position.set(s * BAL_X, base / 2, z);
        scene.add(str);
      }
    }
    // arka planda pastel tepeler (derinlik hissi)
    const hillGeo = track(new THREE.SphereGeometry(16, 14, 10));
    const hillMat = track(new THREE.MeshLambertMaterial({ color: 0xbbf7d0 }));
    for (let i = 0; i < 10; i++) {
      const hMesh = new THREE.Mesh(hillGeo, hillMat);
      hMesh.position.set((i % 2 ? -1 : 1) * (24 + (i % 3) * 9), -7, 30 + i * 34);
      hMesh.scale.set(1, 0.55 + (i % 3) * 0.15, 1);
      scene.add(hMesh);
    }

    // ---------- engeller ----------
    const obstacles: Obstacle[] = [];
    const hammerHeadGeo = track(new THREE.BoxGeometry(4.8, 3.2, 2.4));
    const hammerArmGeo = track(new THREE.BoxGeometry(0.5, 0.5, 7.0));
    const ballGeo = track(new THREE.SphereGeometry(2.0, 20, 16));
    const barGeo = track(new THREE.BoxGeometry(17, 0.8, 0.8));
    const rollerGeo = track(new THREE.CylinderGeometry(1.1, 1.1, 8.5, 14));
    const postGeo = track(new THREE.CylinderGeometry(0.38, 0.38, 5.0, 10));
    const matHammer = track(new THREE.MeshLambertMaterial({ color: 0xf97316 }));
    const matBall = track(new THREE.MeshLambertMaterial({ color: 0x8b5cf6 }));
    const matBar = track(new THREE.MeshLambertMaterial({ color: 0x0ea5e9 }));
    const matRoll = track(new THREE.MeshLambertMaterial({ color: 0xfacc15 }));
    const matPost = track(new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
    const matMud = track(new THREE.MeshLambertMaterial({ color: 0x8b5e3c, transparent: true, opacity: 0.92 }));

    const addHammer = (z: number, x: number, sp: number, t0: number) => {
      // Direk SABİTTİR — pivotun çocuğu olursa çekiçle birlikte döner ve
      // ekranın ortasında dönen dev bir sütun gibi görünür.
      const post = new THREE.Mesh(postGeo, matPost);
      post.position.set(x, 2.3, z);
      scene.add(post);
      const pivot = new THREE.Group();
      pivot.position.set(x, 2.6, z);
      const arm = new THREE.Mesh(hammerArmGeo, matPost);
      arm.position.set(0, 0, 3.5);
      pivot.add(arm);
      const head = new THREE.Mesh(hammerHeadGeo, matHammer);
      head.position.set(0, 0, 6.9);
      pivot.add(head);
      // Düz turuncu kutu "duvar" gibi duruyordu; iki uçtaki koyu bant onu
      // ÇEKİÇ olarak okutuyor ve dönerken hangi yöne savurduğu belli oluyor.
      for (const s of [-1, 1]) {
        const band = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.55, 3.35, 2.55)),
          track(new THREE.MeshLambertMaterial({ color: 0xc2410c })),
        );
        band.position.set(s * 2.1, 0, 6.9);
        pivot.add(band);
      }
      scene.add(pivot);
      obstacles.push({ kind: "hammer", z, x, t: t0, sp, arm: 6.9, head: pivot });
    };
    const addPendulum = (z: number, x: number, sp: number, amp: number, t0: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 8.4, z);
      const rope = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.11, 6.4, 8)), matPost);
      rope.position.y = -3.2;
      pivot.add(rope);
      const ball = new THREE.Mesh(ballGeo, matBall);
      ball.position.y = -6.4;
      pivot.add(ball);
      scene.add(pivot);
      obstacles.push({ kind: "pendulum", z, x, t: t0, sp, amp, head: pivot });
    };
    const addSpinner = (z: number, sp: number, t0: number) => {
      const g = new THREE.Group();
      g.position.set(0, 0.9, z);
      const bar = new THREE.Mesh(barGeo, matBar);
      g.add(bar);
      const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 0.6, 1.8, 12)), matPost);
      cap.position.y = -0.5;
      g.add(cap);
      scene.add(g);
      obstacles.push({ kind: "spinner", z, t: t0, sp, len: 8.5, bar: g });
    };
    const addRoller = (z: number, sp: number, span: number, t0: number) => {
      const m = new THREE.Mesh(rollerGeo, matRoll);
      m.rotation.z = Math.PI / 2;
      m.position.set(0, 1.1, z);
      scene.add(m);
      obstacles.push({ kind: "roller", z, t: t0, sp, span, body: m });
    };
    const addMud = (z: number, x: number, w: number, d: number) => {
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, 0.14, d)), matMud);
      m.position.set(x, 0.06, z);
      scene.add(m);
      obstacles.push({ kind: "mud", z, x, w, d });
    };

    // ---------- soru kapıları ----------
    const pool = gamePool();
    const gates: Gate[] = [];
    const panelGeo = track(new THREE.PlaneGeometry(5, 5));
    const doorFrameGeo = track(new THREE.BoxGeometry(0.6, 6.6, 0.6));
    const gateTopGeo = track(new THREE.BoxGeometry(ROAD_HALF * 2, 0.7, 0.7));
    const matFrame = track(new THREE.MeshLambertMaterial({ color: 0x0f766e }));
    const addGate = (z: number) => {
      if (pool.length < 3) return;
      const target = pickNextGameItem(pool) || pool[0];
      const wrongs = pickWrongs(pool, target, 2);
      if (wrongs.length < 2) return;
      const options = shuffle([target, ...wrongs]);
      const panels: THREE.Mesh[] = [];
      const g = new THREE.Group();
      g.position.z = z;
      const top = new THREE.Mesh(gateTopGeo, matFrame);
      top.position.y = 6.6;
      g.add(top);
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(doorFrameGeo, matFrame);
        post.position.set(-ROAD_HALF + (i / 3) * ROAD_HALF * 2, 3.3, 0);
        g.add(post);
      }
      for (let i = 0; i < 3; i++) {
        const px = -ROAD_HALF + (i + 0.5) * (ROAD_HALF * 2 / 3);
        const mat = track(new THREE.MeshBasicMaterial({
          map: letterTexture(options[i].emoji ?? "؟"),
          transparent: true, side: THREE.DoubleSide,
        }));
        const p = new THREE.Mesh(panelGeo, mat);
        p.position.set(px, 3.1, 0);
        g.add(p);
        panels.push(p);
      }
      scene.add(g);
      gates.push({ z, target, options, done: false, botDone: new Set(), panels, group: g });
    };

    // ---------- parkur dizilimi ----------
    // Ritim: UZUN engel bölümü → soru kapısı → uzun engel bölümü …
    // Kapılar seyrek (≈110 birim ≈ 10 sn arayla): oyun "sürekli soru soran
    // test" gibi hissettirmesin, arada bol bol engel oyunu oynansın. Toplam
    // 4 kapı; SRS ölçümü için yeterli, çocuk için yormayacak kadar az.
    addHammer(38, -4.0, 1.4, 0);
    addHammer(56, 3.6, -1.6, 1.1);
    addSpinner(74, 1.9, 0);
    addMud(92, -4.2, 7, 7);
    addRoller(104, 1.5, 7.0, 0);
    addGate(120);

    addPendulum(140, -4.2, 1.8, 5.6, 0);
    addPendulum(154, 4.2, -1.6, 5.6, 1.4);
    addSpinner(170, 2.2, 0.5);
    addHammer(186, 0, 1.8, 0.6);
    addMud(202, 4.0, 7.5, 7);
    addRoller(216, -1.7, 7.4, 1.2);
    addGate(232);

    addHammer(252, -4.2, 2.0, 0);
    addHammer(266, 4.2, -2.0, 0.9);
    addSpinner(282, 2.5, 0.3);
    addPendulum(298, 0, 2.1, 6.4, 0);
    addMud(314, -3.0, 7, 7);
    addRoller(328, 2.0, 7.2, 0);
    addGate(344);

    addSpinner(364, -2.6, 0.8);
    addHammer(380, 3.8, 2.2, 0);
    addPendulum(396, -3.8, 2.3, 6.0, 0);
    addRoller(412, 1.8, 7.6, 0.4);
    addGate(428);

    addSpinner(448, 2.8, 0);

    obsRef.current = obstacles;
    gatesRef.current = gates;

    // ---------- bitiş: taç + damalı çizgi ----------
    const finishG = new THREE.Group();
    finishG.position.z = FINISH_Z;
    for (let i = 0; i < 13; i++) {
      const q = new THREE.Mesh(
        track(new THREE.BoxGeometry(ROAD_HALF * 2 / 13, 0.06, 1.4)),
        track(new THREE.MeshLambertMaterial({ color: i % 2 ? 0x111827 : 0xffffff })),
      );
      q.position.set(-ROAD_HALF + (i + 0.5) * (ROAD_HALF * 2 / 13), 0.05, 0);
      finishG.add(q);
    }
    const crownCv = document.createElement("canvas");
    crownCv.width = 256; crownCv.height = 256;
    const cg = crownCv.getContext("2d")!;
    cg.font = "200px serif"; cg.textAlign = "center"; cg.textBaseline = "middle";
    cg.fillText("👑", 128, 138);
    const crown = new THREE.Mesh(
      track(new THREE.PlaneGeometry(4, 4)),
      track(new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(crownCv), transparent: true })),
    );
    crown.position.set(0, 4.4, 0.2);
    finishG.add(crown);
    scene.add(finishG);

    // ---------- yarışmacılar ----------
    // Fall Guys "fasulye" karakteri: kapsül gövde + çizilmiş sevimli yüz +
    // sallanan kollar/bacaklar + kostüm şapkası. Kollar ve bacaklar ayrı
    // düğümlerde tutulur ki koşarken zıt fazda sallansınlar.
    const bodyGeo = track(new THREE.CapsuleGeometry(0.75, 1.05, 6, 16));
    const limbGeo = track(new THREE.CapsuleGeometry(0.21, 0.42, 5, 10));
    const legGeo = track(new THREE.CapsuleGeometry(0.23, 0.3, 5, 10));
    const footGeo = track(new THREE.SphereGeometry(0.28, 10, 8));
    const faceGeo = track(new THREE.PlaneGeometry(1.15, 1.15));
    // Bere (yarım küre) — koni + torus "kavanoz kapağı" gibi duruyordu;
    // yarım küre bere hem daha sevimli hem gövdeden net ayrılıyor.
    const hatGeo = track(new THREE.SphereGeometry(0.66, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52));
    const hatBrimGeo = track(new THREE.TorusGeometry(0.63, 0.11, 8, 18));
    const shadowGeo = track(new THREE.CircleGeometry(0.8, 18));
    const shadowMat = track(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
    const faceMat = track(new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true }));
    const skinMat = track(new THREE.MeshLambertMaterial({ color: 0xfde68a }));

    const makeRacer = (id: number, name: string, color: number, isPlayer: boolean, homeX: number): Racer => {
      const group = new THREE.Group();
      const mat = track(new THREE.MeshLambertMaterial({ color }));

      // gövde (yüz + şapka onunla birlikte eğilir)
      const body = new THREE.Group();
      body.position.y = 1.25;
      const torso = new THREE.Mesh(bodyGeo, mat);
      body.add(torso);
      // Yüz düzlemi gövdenin DIŞINDA dursun: kapsülün içine gömülünce
      // arkadan bakıldığında gözler/ağız gövdeden sızıyordu.
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(0, 0.28, 0.79);
      body.add(face);
      // Alt yarı koyu = "şort": kamera hep ARKADAN baktığı için karakterin
      // sevimliliği yüzden değil siluetten okunmalı (kostüm + şapka + kuyruk).
      const shorts = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.76, 16, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48)),
        track(new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.62) })),
      );
      shorts.position.y = -0.5;
      shorts.scale.set(1.02, 1.0, 1.02);
      body.add(shorts);
      // kuyruk ponponu (arkadan görünen tek "sevimli" detay)
      const tail = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.22, 10, 8)),
        track(new THREE.MeshLambertMaterial({ color: 0xfffbeb })),
      );
      tail.position.set(0, -0.35, -0.78);
      body.add(tail);
      // Bere gövdenin tepesine oturur (kapsül üstü ≈ 1.28); kenar bandı ve
      // ponpon kontrast renkte ki arkadan bakınca "kostüm" olarak okunsun.
      const trimMat = track(new THREE.MeshLambertMaterial({ color: 0xfffbeb }));
      const hat = new THREE.Mesh(hatGeo, mat);
      hat.position.y = 1.12;
      body.add(hat);
      const brim = new THREE.Mesh(hatBrimGeo, trimMat);
      brim.rotation.x = Math.PI / 2;
      brim.position.y = 1.14;
      body.add(brim);
      const pom = new THREE.Mesh(track(new THREE.SphereGeometry(0.23, 10, 8)), trimMat);
      pom.position.y = 1.82;
      body.add(pom);
      group.add(body);

      // kollar
      const arms: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        const a = new THREE.Group();
        a.position.set(s * 0.82, 1.5, 0);
        const limb = new THREE.Mesh(limbGeo, skinMat);
        limb.position.y = -0.38;
        limb.rotation.z = s * 0.18;
        a.add(limb);
        group.add(a);
        arms.push(a);
      }
      // bacaklar (ayakkabılı)
      const legs: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        const l = new THREE.Group();
        l.position.set(s * 0.3, 0.58, 0);
        const limb = new THREE.Mesh(legGeo, skinMat);
        limb.position.y = -0.22;
        l.add(limb);
        const foot = new THREE.Mesh(footGeo, mat);
        foot.scale.set(1, 0.62, 1.35);
        foot.position.set(0, -0.48, 0.1);
        l.add(foot);
        group.add(l);
        legs.push(l);
      }

      const sh = new THREE.Mesh(shadowGeo, shadowMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.03;
      group.add(sh);
      // depthTest AÇIK: kapalıyken etiketler duvarların/karakterlerin önüne
      // basılıp ekranı kaplıyordu. Küçük ve yüksekte dursunlar.
      const tag = new THREE.Sprite(track(new THREE.SpriteMaterial({
        map: nameTexture(name, isPlayer ? "#065f46" : "#334155"),
        transparent: true,
      })));
      tag.scale.set(1.9, 0.47, 1);
      tag.position.y = isPlayer ? 4.3 : 3.5;
      group.add(tag);
      if (isPlayer) {
        // Kalabalıkta çocuk kendi karakterini anında bulsun: başının hemen
        // üstünde zıplayan yeşil ok. Ok ile kafa arasındaki boşluk küçük
        // olmalı, yoksa ok havada bağımsız bir nesne gibi duruyor; isim
        // tabelası da okun ÜSTÜNE alınır ki birbirini örtmesinler.
        const arrow = new THREE.Mesh(
          track(new THREE.ConeGeometry(0.42, 0.85, 4)),
          track(new THREE.MeshBasicMaterial({ color: 0x16a34a })),
        );
        arrow.rotation.x = Math.PI;
        arrow.position.y = 3.35;
        arrow.name = "marker";
        group.add(arrow);
      }
      scene.add(group);
      return {
        id, name, isPlayer, z: 0, x: homeX, y: 0, vy: 0,
        boostT: 0, mudT: 0, netT: 0, hitT: 0,
        skill: isPlayer ? 1 : 0.55 + Math.random() * 0.3,
        targetX: homeX, homeX, gateChoice: null, finished: null,
        hop: Math.random() * 6, group, body,
        legs: legs as [THREE.Object3D, THREE.Object3D],
        arms: arms as [THREE.Object3D, THREE.Object3D],
      };
    };

    const racers: Racer[] = [makeRacer(0, "Sen", PLAYER_COLOR, true, 0)];
    // Botlara ayrı seyir şeritleri: ORTA ŞERİT oyuncunun — bot oraya park
    // ederse çocuk kendi karakterini bulamıyor (üst üste biniyorlar).
    const BOT_LANES = [-7.4, -4.4, 4.4, 7.4, -2.6];
    for (let i = 0; i < RACERS - 1; i++) {
      racers.push(makeRacer(i + 1, BOT_NAMES[i], BOT_COLORS[i], false, BOT_LANES[i]));
      racers[i + 1].z = -1.6 - 1.1 * i;   // başlangıç ızgarası: oyuncunun hafif gerisinde
    }
    racersRef.current = racers;
    netCountRef.current = 0;
    jumpCountRef.current = 0;
    statsRef.current = { correct: 0, wrong: 0 };
    netsRef.current = [];

    const netGeo = track(new THREE.SphereGeometry(0.45, 10, 8));
    const netMat = track(new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }));

    // ---------- yeniden boyutlandırma ----------
    const resize = () => {
      const w = wrap.clientWidth || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // ---------- yardımcılar ----------
    const player = racers[0];
    const laneOf = (x: number) => Math.max(0, Math.min(2, Math.floor(((x + ROAD_HALF) / (ROAD_HALF * 2)) * 3)));
    const laneX = (i: number) => -ROAD_HALF + (i + 0.5) * (ROAD_HALF * 2 / 3);

    /** Çekiç/sarkaç/çubuk vurdu mu? Vurulan takla atar, geri kayar. */
    const knock = (r: Racer, push: number) => {
      if (r.hitT > 0) return;
      r.hitT = HIT_TIME;
      r.z = Math.max(0, r.z - push);
      r.vy = 5.5;
      r.y = Math.max(r.y, 0.1);
      r.boostT = 0;
      if (r.isPlayer) { playSfx("stomp"); showFlash("💫 Takla attın!", false); }
    };

    /** Engelin şu anki tehlike merkezleri (dünya koordinatı) */
    const hazardOf = (o: Obstacle): { x: number; z: number; r: number; low: boolean } | null => {
      if (o.kind === "hammer") {
        const a = o.t * o.sp;
        return { x: o.x + Math.sin(a) * o.arm, z: o.z + Math.cos(a) * o.arm, r: 2.7, low: false };
      }
      if (o.kind === "pendulum") {
        return { x: o.x + Math.sin(o.t * o.sp) * o.amp, z: o.z, r: 2.4, low: false };
      }
      if (o.kind === "spinner") {
        return { x: 0, z: o.z, r: 0, low: true };   // bar hep yolu keser → zıpla
      }
      if (o.kind === "roller") {
        return { x: Math.sin(o.t * o.sp) * o.span, z: o.z, r: 2.3, low: false };
      }
      return null;
    };

    const collide = (r: Racer, dt: number) => {
      let inMud = false;
      for (const o of obsRef.current) {
        if (Math.abs(o.z - r.z) > 9) continue;
        if (o.kind === "mud") {
          if (Math.abs(r.x - o.x) < o.w / 2 && Math.abs(r.z - o.z) < o.d / 2 && r.y < 0.5) inMud = true;
          continue;
        }
        const hz = hazardOf(o);
        if (!hz) continue;
        if (o.kind === "spinner") {
          // Alçak dönen çubuk. Nokta–doğru parçası mesafesi ile ölçülür:
          // yaklaşık "kutu" testi çubuk çapraz dururken yanlış yerde vuruyordu.
          // Zıplayan (y > JUMP_CLEAR) çocuk temiz geçer — basit, öğretilebilir kural.
          if (r.y >= JUMP_CLEAR) continue;
          const a = o.t * o.sp;
          const dxa = Math.cos(a), dza = -Math.sin(a);   // çubuk yön vektörü
          const px = r.x, pz = r.z - o.z;
          const t = Math.max(-o.len, Math.min(o.len, px * dxa + pz * dza));
          const ex = px - t * dxa, ez = pz - t * dza;
          if (ex * ex + ez * ez < 1.15 * 1.15) knock(r, 2.4);
          continue;
        }
        const dx = r.x - hz.x, dz = r.z - hz.z;
        if (dx * dx + dz * dz < hz.r * hz.r && r.y < 2.2) knock(r, o.kind === "hammer" ? 3.4 : 2.4);
      }
      if (inMud && r.mudT <= 0) r.mudT = 0.35;   // içindeyken sürekli tazelenir
      void dt;
    };

    // ---------- adım ----------
    const step = (dt: number) => {
      // engelleri döndür
      for (const o of obsRef.current) {
        if (o.kind === "mud") continue;
        o.t += dt;
        if (o.kind === "hammer") o.head.rotation.y = o.t * o.sp;
        else if (o.kind === "pendulum") o.head.rotation.z = Math.sin(o.t * o.sp) * 0.62;
        else if (o.kind === "spinner") o.bar.rotation.y = o.t * o.sp;
        else if (o.kind === "roller") o.body.position.x = Math.sin(o.t * o.sp) * o.span;
      }

      // --- ağ atma ---
      if (ctrlRef.current.useNet) {
        ctrlRef.current.useNet = false;
        if (netCountRef.current > 0 && player.finished === null) {
          netCountRef.current -= 1;
          const mesh = new THREE.Mesh(netGeo, netMat);
          mesh.position.set(player.x, 1.1, player.z + 1);
          scene.add(mesh);
          netsRef.current.push({ mesh, x: player.x, z: player.z + 1, from: 0 });
          playSfx("coin");
        }
      }

      // --- süper zıplama ---
      if (ctrlRef.current.useJump) {
        ctrlRef.current.useJump = false;
        if (jumpCountRef.current > 0 && player.finished === null && player.y <= 0.02) {
          jumpCountRef.current -= 1;
          player.vy = JUMP_V * SUPER_JUMP_MUL;
          player.mudT = 0;
          player.hitT = 0;
          playSfx("dove");
          showFlash("⭐ SÜPER ZIPLAMA!", true);
        }
      }

      // --- normal zıplama ---
      if (ctrlRef.current.jump) {
        ctrlRef.current.jump = false;
        if (player.y <= 0.02 && player.finished === null && player.hitT <= 0) {
          player.vy = JUMP_V;
          playSfx("coin");
        }
      }

      // --- ağlar ilerler ---
      for (let i = netsRef.current.length - 1; i >= 0; i--) {
        const n = netsRef.current[i];
        n.z += 26 * dt;
        n.mesh.position.z = n.z;
        n.mesh.rotation.x += dt * 8;
        let hit = false;
        for (const r of racers) {
          if (r.id === n.from || r.finished !== null) continue;
          if (Math.abs(r.z - n.z) < 1.1 && Math.abs(r.x - n.x) < 1.6) { r.netT = NET_TIME; hit = true; break; }
        }
        if (hit || n.z > player.z + 45) {
          scene.remove(n.mesh);
          netsRef.current.splice(i, 1);
        }
      }

      // --- yarışmacılar ---
      for (const r of racers) {
        if (r.finished !== null) {
          r.group.position.set(r.x, r.y, r.z);
          continue;
        }
        if (r.boostT > 0) r.boostT = Math.max(0, r.boostT - dt);
        if (r.mudT > 0) r.mudT = Math.max(0, r.mudT - dt);
        if (r.netT > 0) r.netT = Math.max(0, r.netT - dt);
        if (r.hitT > 0) r.hitT = Math.max(0, r.hitT - dt);

        // yatay yönelim
        if (r.isPlayer) {
          if (r.hitT <= 0) r.x += ctrlRef.current.dir * STEER * dt;
        } else {
          // Bot: kapı yakınsa seçtiği şeride, değilse kendi şeridine.
          // Ayrıca becerisine göre yaklaşan engelden kaçmaya çalışır.
          const g = gatesRef.current.find((gg) => gg.z > r.z - 1 && !gg.botDone.has(r.id));
          if (g && g.z - r.z < 26) {
            if (r.gateChoice !== g.z) {
              r.gateChoice = g.z;
              const correctIdx = g.options.findIndex((o) => o.id === g.target.id);
              const pickIdx = Math.random() < r.skill ? correctIdx : Math.floor(Math.random() * 3);
              r.targetX = laneX(pickIdx);
            }
          } else {
            r.targetX = r.homeX;
            for (const o of obsRef.current) {
              if (o.kind === "mud" || o.kind === "spinner") continue;
              const hz = hazardOf(o);
              if (!hz) continue;
              const ahead = hz.z - r.z;
              if (ahead > 0 && ahead < 14 && Math.abs(hz.x - r.x) < 3.0 && Math.random() < r.skill) {
                r.targetX = hz.x > 0 ? hz.x - 4.2 : hz.x + 4.2;
                break;
              }
            }
          }
          if (r.hitT <= 0) {
            const d = r.targetX - r.x;
            r.x += Math.sign(d) * Math.min(Math.abs(d), STEER * 0.85 * dt);
          }
          // Bot da çubuğu zıplayarak geçer (becerisine göre)
          if (r.y <= 0.02) {
            for (const o of obsRef.current) {
              if (o.kind !== "spinner") continue;
              const ahead = o.z - r.z;
              if (ahead > 0 && ahead < 6.5 && Math.random() < r.skill) { r.vy = JUMP_V; break; }
            }
          }
        }
        r.x = Math.max(-ROAD_HALF + 0.7, Math.min(ROAD_HALF - 0.7, r.x));

        // dikey (zıplama)
        if (r.y > 0 || r.vy > 0) {
          r.vy -= GRAVITY * dt;
          r.y += r.vy * dt;
          if (r.y <= 0) { r.y = 0; r.vy = 0; }
        }

        // ileri hız
        let sp = BASE_SPEED;
        if (r.boostT > 0) sp = BOOST_SPEED;
        if (r.mudT > 0 || r.netT > 0) sp = MUD_SPEED;
        if (r.hitT > 0) sp = HIT_SPEED;
        r.z += sp * dt;
        r.hop += dt * (r.boostT > 0 ? 17 : 11);

        collide(r, dt);

        // --- karakter animasyonu ---
        r.group.position.set(r.x, r.y, r.z);
        const swing = Math.sin(r.hop);
        if (r.hitT > 0) {
          // takla: tüm gövde döner, kollar bacaklar savrulur
          const spin = (HIT_TIME - r.hitT) * 11;
          r.body.rotation.x = spin;
          r.body.rotation.z = 0;
          r.arms[0].rotation.x = -2.2; r.arms[1].rotation.x = -2.2;
          r.legs[0].rotation.x = 1.4; r.legs[1].rotation.x = 1.4;
          r.group.rotation.z = Math.sin(spin) * 0.25;
        } else if (r.y > 0.05) {
          // havada: kollar yukarı, bacaklar toplanmış (zıplama pozu)
          r.group.rotation.z = 0;
          r.body.rotation.set(0, 0, 0);
          r.arms[0].rotation.x = -2.4; r.arms[1].rotation.x = -2.4;
          r.legs[0].rotation.x = 0.7; r.legs[1].rotation.x = -0.4;
          r.body.position.y = 1.25;
        } else {
          // koşu: kollar ve bacaklar ZIT fazda sallanır, gövde hafif sekip eğilir
          r.group.rotation.z = 0;
          r.body.rotation.x = 0;
          r.body.rotation.z = swing * 0.08;
          r.body.position.y = 1.25 + Math.abs(swing) * 0.09;
          r.legs[0].rotation.x = swing * 0.85;
          r.legs[1].rotation.x = -swing * 0.85;
          r.arms[0].rotation.x = -swing * 0.75;
          r.arms[1].rotation.x = swing * 0.75;
        }

        if (r.z >= FINISH_Z) {
          const done = racers.filter((x) => x.finished !== null).length;
          r.finished = done + 1;
          if (r.isPlayer) {
            ctrlRef.current.running = false;
            setResult({ place: r.finished, correct: statsRef.current.correct, wrong: statsRef.current.wrong });
            setPhase("finish");
            playFeedback(r.finished <= 3);
          }
        }
      }

      // --- soru kapıları ---
      for (const g of gatesRef.current) {
        // Geçilen kapı kameranın ÖNÜNDE kalıyor (kamera oyuncunun 15 birim
        // gerisinde) ve ekranın altını tamamen kapatıyordu. Doğru/yanlış
        // rengini görecek kadar bekleyip gizle.
        if (g.done && g.group.visible && player.z > g.z + 6) g.group.visible = false;
        if (!g.done && player.finished === null && player.z >= g.z) {
          g.done = true;
          const idx = laneOf(player.x);
          const chosen = g.options[idx];
          const correct = chosen.id === g.target.id;
          recordGameAnswer(g.target, correct, {
            gameId: "party", chosenId: chosen.id, shownIds: g.options.map((o) => o.id),
          });
          // geçilen kapıyı renklendir (görsel geri bildirim)
          g.panels.forEach((p, i) => {
            const m = p.material as THREE.MeshBasicMaterial;
            m.color.set(g.options[i].id === g.target.id ? 0x86efac : 0xfca5a5);
          });
          if (correct) {
            statsRef.current.correct += 1;
            player.boostT = BOOST_TIME;
            // Ödül dönüşümlü: bir ağ, bir süper zıplama — çocuk koz biriktirir
            if (statsRef.current.correct % 2 === 1) {
              netCountRef.current = Math.min(3, netCountRef.current + 1);
              showFlash("✅ Doğru! 🚀 hız + 🕸️ ağ", true);
            } else {
              jumpCountRef.current = Math.min(3, jumpCountRef.current + 1);
              showFlash("✅ Doğru! 🚀 hız + ⭐ zıplama", true);
            }
            playFeedback(true);
          } else {
            statsRef.current.wrong += 1;
            player.mudT = MUD_TIME;
            showFlash("💦 Çamur! Yavaşladın", false);
            playFeedback(false);
          }
        }
        for (const r of racers) {
          if (r.isPlayer || g.botDone.has(r.id) || r.z < g.z) continue;
          g.botDone.add(r.id);
          const ok = g.options[laneOf(r.x)]?.id === g.target.id;
          if (ok) r.boostT = BOOST_TIME * 0.9; else r.mudT = MUD_TIME;
        }
      }

      // --- sıradaki kapının sesi ---
      // Ses çalma YAN ETKİDİR: setState güncelleyicisinin içine konulamaz
      // (StrictMode güncelleyiciyi iki kez çağırır → ses çift çalar).
      const next = gatesRef.current.find((g) => !g.done);
      const d = next ? next.z - player.z : Infinity;
      const wantId = next && d > 0 && d < 34 ? next.target.id : null;
      if (wantId !== promptIdRef.current) {
        promptIdRef.current = wantId;
        if (next && wantId) { setPrompt(next.target); playItem(next.target); }
        else setPrompt(null);
      }

      // --- kamera: oyuncunun arkasından, yukarıdan, yumuşak takip ---
      // Yakın kamera parkuru görünmez yapıyordu (çekiç direği ekranı kapatıyordu);
      // geride + yüksekte durup ileriye bakınca çocuk engeli GELİRKEN görür.
      camera.position.x += (player.x * 0.5 - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += ((12.5 + player.y * 0.3) - camera.position.y) * Math.min(1, dt * 5);
      camera.position.z += ((player.z - 17.5) - camera.position.z) * Math.min(1, dt * 8);
      // Biraz aşağı bakış: yol kadrajı doldursun, ekranın yarısı boş gök olmasın
      camera.lookAt(player.x * 0.3, 0.6 + player.y * 0.25, player.z + 13);

      // dekor: balonlar süzülür, taç döner, oyuncunun oku zıplar
      const tNow = performance.now() * 0.001;
      for (const d of decor) d.mesh.position.y = d.base + Math.sin(tNow * 1.3 + d.ph) * 0.35;
      crown.rotation.y = Math.sin(tNow * 2) * 0.4;
      const marker = player.group.getObjectByName("marker");
      if (marker) {
        marker.position.y = 3.35 + Math.abs(Math.sin(tNow * 4)) * 0.32;
        marker.rotation.y = tNow * 1.6;
      }
      // Geride kalan yarışmacı kameranın önüne girip ekranı kapatıyordu:
      // kameraya çok yakın olanı gizle (yarışta hâlâ koşmaya devam eder).
      for (const r of racers) r.group.visible = r.z > camera.position.z + 5.5;
    };

    // ---------- döngü ----------
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    const ctrl = ctrlRef.current;
    ctrl.dir = 0; ctrl.jump = false; ctrl.useNet = false; ctrl.useJump = false;
    ctrl.running = true;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      if (ctrlRef.current.running) step(dt);
      renderer.render(scene, camera);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.16;
        const ahead = racers.filter((r) => !r.isPlayer && (r.finished !== null || r.z > player.z)).length;
        setHud({
          place: ahead + 1,
          pct: Math.min(100, Math.round((player.z / FINISH_Z) * 100)),
          nets: netCountRef.current,
          jumps: jumpCountRef.current,
          correct: statsRef.current.correct,
          wrong: statsRef.current.wrong,
        });
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctrl.running = false;
      // WebGL kaynakları elle bırakılır: yarış tekrar başlatıldığında
      // sahne sıfırdan kurulur, eskisi sızmamalı.
      for (const d of disposables) d.dispose();
      renderer.dispose();
      scene.clear();
      racersRef.current = [];
      gatesRef.current = [];
      obsRef.current = [];
      netsRef.current = [];
    };
    // raceKey her "Tekrar Yarış"ta artar → sahne baştan kurulur
  }, [phase, raceKey]);

  // ---------- klavye (masaüstü) ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") ctrlRef.current.dir = -1;
      else if (e.code === "ArrowRight" || e.code === "KeyD") ctrlRef.current.dir = 1;
      else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); ctrlRef.current.jump = true; }
      else if (e.code === "KeyJ") ctrlRef.current.useNet = true;
      else if (e.code === "KeyX") ctrlRef.current.useJump = true;
    };
    const up = (e: KeyboardEvent) => {
      if ((e.code === "ArrowLeft" || e.code === "KeyA") && ctrlRef.current.dir === -1) ctrlRef.current.dir = 0;
      if ((e.code === "ArrowRight" || e.code === "KeyD") && ctrlRef.current.dir === 1) ctrlRef.current.dir = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const hold = (dir: -1 | 1) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); ctrlRef.current.dir = dir; },
    onPointerUp: () => { if (ctrlRef.current.dir === dir) ctrlRef.current.dir = 0; },
    onPointerCancel: () => { if (ctrlRef.current.dir === dir) ctrlRef.current.dir = 0; },
    onPointerLeave: () => { if (ctrlRef.current.dir === dir) ctrlRef.current.dir = 0; },
  });

  const exit = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    navigate("/oyunlar");
  };

  const PLACE_TXT = ["", "🏆 BİRİNCİ!", "🥈 İkinci!", "🥉 Üçüncü!", "4. oldun", "5. oldun", "6. oldun"];

  return (
    <div ref={wrapRef} className="fixed inset-0 flex flex-col overscroll-none bg-sky-200">
      {phase === "race" && (
        <>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

          {/* üst HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
            <div className="rounded-2xl bg-white/85 px-3 py-1.5 shadow-card backdrop-blur">
              <div className="text-[10px] font-bold text-muted-foreground">Sıra</div>
              <div className="text-xl font-extrabold text-primary">{hud.place}.</div>
            </div>
            <div className="flex-1 rounded-2xl bg-white/85 px-3 py-2 shadow-card backdrop-blur">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>Yol</span><span>%{hud.pct}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-success to-warning transition-all"
                     style={{ width: `${hud.pct}%` }} />
              </div>
            </div>
            <div className="rounded-2xl bg-white/85 px-2 py-1.5 text-center shadow-card backdrop-blur">
              <div className="text-[10px] font-bold text-muted-foreground">Koz</div>
              <div className="text-sm font-extrabold text-info">🕸️{hud.nets} <span className="text-warning">⭐{hud.jumps}</span></div>
            </div>
          </div>

          {prompt && (
            <button
              onClick={() => playItem(prompt)}
              className="absolute inset-x-3 top-[74px] z-20 flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-white/90 px-3 py-2 font-extrabold text-primary shadow-card backdrop-blur active:scale-95"
            >
              <Volume2 className="h-5 w-5" />
              Hangi kapı? — dinle
            </button>
          )}

          {flash && (
            <div key={flash.k}
                 className={cn(
                   "pointer-events-none absolute inset-x-0 top-1/3 z-30 animate-pop text-center text-2xl font-extrabold drop-shadow",
                   flash.good ? "text-success" : "text-destructive",
                 )}>
              {flash.text}
            </div>
          )}

          {/* mobil kontroller */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-stretch gap-2 bg-white/80 p-2 backdrop-blur">
            <button {...hold(-1)} aria-label="Sola"
              className="flex flex-1 touch-none select-none items-center justify-center rounded-2xl bg-primary py-5 text-primary-foreground shadow-soft active:scale-95">
              <ArrowLeft className="h-8 w-8" />
            </button>
            <button {...hold(1)} aria-label="Sağa"
              className="flex flex-1 touch-none select-none items-center justify-center rounded-2xl bg-primary py-5 text-primary-foreground shadow-soft active:scale-95">
              <ArrowRight className="h-8 w-8" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); ctrlRef.current.jump = true; }}
              aria-label="Zıpla"
              className="flex flex-[1.1] touch-none select-none flex-col items-center justify-center rounded-2xl bg-success py-5 text-success-foreground shadow-soft active:scale-95">
              <span className="text-2xl leading-none">🦘</span>
              <span className="text-[10px] font-extrabold">ZIPLA</span>
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); ctrlRef.current.useNet = true; }}
              disabled={hud.nets === 0}
              aria-label="Ağ at"
              className={cn(
                "flex flex-[0.75] touch-none select-none flex-col items-center justify-center rounded-2xl py-5 text-xl shadow-soft active:scale-95",
                hud.nets > 0 ? "bg-info text-info-foreground" : "bg-muted text-muted-foreground opacity-50",
              )}
            >
              🕸️<span className="text-[10px] font-extrabold">{hud.nets}</span>
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); ctrlRef.current.useJump = true; }}
              disabled={hud.jumps === 0}
              aria-label="Süper zıplama"
              className={cn(
                "flex flex-[0.75] touch-none select-none flex-col items-center justify-center rounded-2xl py-5 text-xl shadow-soft active:scale-95",
                hud.jumps > 0 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground opacity-50",
              )}
            >
              ⭐<span className="text-[10px] font-extrabold">{hud.jumps}</span>
            </button>
          </div>
        </>
      )}

      {phase === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl font-extrabold text-primary">Elifbâ Partisi</h1>
          <p className="max-w-xs text-sm font-bold text-muted-foreground">
            5 arkadaşınla engelli parkurda yarış! Çekiçlerden kaç, çubuğu zıpla,
            <b className="text-primary"> doğru harfin kapısından</b> geç ve tacı kap 👑
          </p>
          <div className="grid w-full max-w-xs gap-2 text-left text-sm font-bold">
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-3 py-2">🔨 Dönen çekiç → değersen takla atarsın</div>
            <div className="rounded-xl border-2 border-info/30 bg-info/10 px-3 py-2">🦘 Dönen çubuk → tam zamanında ZIPLA</div>
            <div className="rounded-xl border-2 border-success/30 bg-success/10 px-3 py-2">✅ Doğru kapı → 🚀 hız + koz</div>
            <div className="rounded-xl border-2 border-warning/30 bg-warning/10 px-3 py-2">🕸️ Ağ at / ⭐ süper zıpla</div>
          </div>
          <button onClick={start}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-success px-8 py-4 text-lg font-extrabold text-success-foreground shadow-card active:scale-95">
            <Maximize2 className="h-5 w-5" /> Yarışı Başlat
          </button>
          <button onClick={exit} className="text-sm font-bold text-muted-foreground underline">
            Oyunlara dön
          </button>
        </div>
      )}

      {phase === "finish" && result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="animate-bounce-in text-6xl">
            {result.place === 1 ? "👑" : result.place <= 3 ? "🎉" : "💪"}
          </div>
          <h2 className="text-2xl font-extrabold text-primary">{PLACE_TXT[result.place] ?? "Bitti!"}</h2>
          <div className="flex gap-3">
            <div className="rounded-2xl border-2 border-success/30 bg-success/10 px-4 py-2">
              <div className="text-[10px] font-bold text-muted-foreground">Doğru kapı</div>
              <div className="text-2xl font-extrabold text-success">{result.correct}</div>
            </div>
            <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/10 px-4 py-2">
              <div className="text-[10px] font-bold text-muted-foreground">Yanlış</div>
              <div className="text-2xl font-extrabold text-destructive">{result.wrong}</div>
            </div>
          </div>
          <div className="mt-1 rounded-2xl border-2 border-success/30 bg-success/10 px-4 py-2 text-sm font-extrabold text-success">
            {teaseRef.current}
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={start}
              className="rounded-full bg-primary px-6 py-3 font-extrabold text-primary-foreground shadow-card active:scale-95">
              Tekrar Yarış
            </button>
            <button onClick={exit}
              className="rounded-full bg-muted px-6 py-3 font-extrabold text-muted-foreground shadow-card active:scale-95">
              Çık
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyGame;
