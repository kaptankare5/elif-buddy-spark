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
//
// ⚠️ EKSEN KURALI — YARIŞ -Z YÖNÜNDE KOŞULUR:
// Oyun MANTIĞINDA ilerleme `z` 0'dan TRACK_LEN'e ARTAR, ama sahneye
// yerleştirirken hep `wz(z) = -z` kullanılır. Sebep: kamerayı +Z'ye baktırmak
// (yani parkuru +Z'de kurmak) three.js'te görüntüyü AYNALAR — harfler ters
// okunur ve "sağ" tuşu ekranda sola gider. -Z yönü three.js'in varsayılan
// bakış yönü olduğu için hem harfler düz çıkar hem sağ/sol doğru olur.
// Yeni bir nesne eklerken konumu `wz(z)` ile ver; z'yi ham koyma.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { Volume2, Eye, Maximize2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { gamePool, pickWrongs, shuffle } from "./_shared";
import { createAdaptiveResolution } from "./_perf";
import { pickNextGameItem, recordGameAnswer, getGameItemLevel } from "@/lib/gameProgress";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { playItem, playFeedback, playSfx, preloadItems } from "@/lib/audio";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { gardenTease } from "@/lib/sessionEnd";
import { letterTexture, nameTexture, wordTexture } from "./_letterTexture";
import {
  getAskMode, okunurAd, pickNameWrongs, adZorlugu, yaziliSik, FLASH_MS, type AskMode,
} from "@/lib/askMode";
import { isTestUnlockActive } from "@/lib/testUnlock";
import type { ContentItem } from "@/data/types";

/** Mantıksal ilerleme (artan) → sahne koordinatı (-Z). Yukarıdaki eksen notu. */
const wz = (z: number) => -z;

// ---- parkur sabitleri (birim ≈ 1 metre) ----
const ROAD_HALF = 9;           // geniş yol — engeller büyüdü, kaçacak yer lazım
const BASE_SPEED = 11.5;       // birim/sn
const BOOST_SPEED = 17;
const MUD_SPEED = 4.6;
const HIT_SPEED = 3.2;         // çekiç yedikten sonraki toparlanma hızı
const STEER = 8.5;             // yana hız
const GRAVITY = 30;
// Zıplama artık gerçek bir kaçış aracı: normal zıplama da "süper" yükseklikte
// (tepe ≈ 4.3 birim → sarkaç topunun ve çekicin üstünden geçilebilir),
// ⭐ kozu ise ondan çok daha yükseğe (tepe ≈ 13 birim) fırlatır.
const JUMP_V = 16;
const JUMP_CLEAR = 1.5;        // dönen çubuk bu yükseklikten sonra değmez
const HAMMER_CLEAR = 4.4;      // çekiç kafasının üstü
const PEND_CLEAR = 4.2;        // sarkaç topunun üstü
const ROLLER_CLEAR = 2.4;      // silindirin üstü
const BOOST_TIME = 3.5;
const MUD_TIME = 1.8;
const NET_TIME = 2.2;
const HIT_TIME = 1.0;          // takla süresi
/** Takladan sonra hiçbir engelin çarpmadığı süre (sn) — bkz. Racer.graceT. */
const GRACE_TIME = 1.2;
const RACERS = 6;
const DT_MAX = 0.05;

// Soru kapısının ÖNÜNDE ve ARKASINDA engelsiz "nefes alma" payı. Kapı hemen
// bir engelin ardından gelince çocuk hem çekiçten kaçmaya hem harfi seçmeye
// çalışıyor, ikisini de kaçırıyordu (kullanıcı şartı: "biraz dinlenelim").
// Kapı çevresindeki engelsiz "nefes" payı ASİMETRİKTİR: kapının ÖNÜ geniş
// (çocuk sesi dinleyip şeridini seçerken çekiçten kaçmak zorunda kalmasın),
// ARKASI dar (kapıyı geçti, cevabını verdi — oyun devam edebilir). Simetrik
// yapılınca kapılar arası neredeyse tamamen boşalıyordu.
const GATE_CLEAR_BEFORE = 48;
const GATE_CLEAR_AFTER = 12;

// Soru sesinin kapıdan KAÇ BİRİM ÖNCE çalacağı. 40 birim (≈3.5 sn) çok geçti:
// çocuk sesi duyup harfi hatırlayıp şeridi seçmeye ancak yetişiyordu —
// bilinmeyen bir harf + çocuk refleksi birleşince imkânsıza yakındı.
// 100 birim ≈ 9 sn: dinle, düşün, yerleş. Kapıya yaklaşınca bir kez daha
// çalar (uzakta duyduğunu unutmuş olabilir).
const PROMPT_LEAD = 100;

// ================= bölümler =================
// 10 bölüm, giderek zorlaşır. Her bölüm bir "reçete": hangi engel tipleri,
// ne sıklıkta, ne hızda, kaç soru kapısı. Engeller reçeteden PROSEDÜREL
// yerleştirilir (elle 200 satır koordinat yazmak yerine) — bölüm eklemek
// tabloya bir satır yazmaktır.
type ObsKind = "hammer" | "pendulum" | "spinner" | "roller" | "mud";

interface LevelDef {
  name: string;
  len: number;          // parkur uzunluğu
  gates: number;        // soru kapısı sayısı
  kinds: ObsKind[];     // sırayla dizilecek engel tipleri
  gap: number;          // engeller arası mesafe
  speed: number;        // engel hız çarpanı
  botSkill: [number, number];
}

// gates sayısı bilinçli olarak AZ: kapılar arası mesafe PROMPT_LEAD'i (100
// birim) aşmalı, yoksa soru sesleri birbirine giriyor. len büyüdükçe kapı
// eklenebilir; oran kabaca "her 150 birime bir kapı".
const LEVELS: LevelDef[] = [
  { name: "Isınma Turu",     len: 320, gates: 2, kinds: ["mud", "spinner"],                                  gap: 40, speed: 0.8, botSkill: [0.40, 0.62] },
  { name: "Çekiç Tarlası",   len: 360, gates: 2, kinds: ["hammer", "mud", "hammer", "spinner"],               gap: 38, speed: 0.9, botSkill: [0.45, 0.66] },
  { name: "Sallanan Toplar", len: 400, gates: 2, kinds: ["pendulum", "spinner", "pendulum", "mud"],           gap: 37, speed: 0.95, botSkill: [0.48, 0.70] },
  { name: "Yuvarlananlar",   len: 440, gates: 3, kinds: ["roller", "spinner", "roller", "mud"],               gap: 36, speed: 1.0, botSkill: [0.50, 0.72] },
  { name: "Karışık Parti",   len: 480, gates: 3, kinds: ["hammer", "pendulum", "spinner", "roller", "mud"],   gap: 35, speed: 1.05, botSkill: [0.52, 0.74] },
  { name: "Hızlı Çekiçler",  len: 520, gates: 3, kinds: ["hammer", "hammer", "spinner", "mud"],               gap: 34, speed: 1.3, botSkill: [0.55, 0.76] },
  { name: "Dar Geçit",       len: 560, gates: 3, kinds: ["roller", "spinner", "pendulum", "spinner"],         gap: 33, speed: 1.25, botSkill: [0.57, 0.78] },
  { name: "Zıpla Zıpla",     len: 600, gates: 4, kinds: ["spinner", "spinner", "hammer", "mud", "spinner"],   gap: 32, speed: 1.35, botSkill: [0.58, 0.80] },
  { name: "Fırtına",         len: 650, gates: 4, kinds: ["hammer", "pendulum", "roller", "spinner", "hammer"],gap: 31, speed: 1.45, botSkill: [0.60, 0.82] },
  { name: "Büyük Final 👑",  len: 720, gates: 5, kinds: ["hammer", "pendulum", "spinner", "roller", "hammer", "mud", "spinner"], gap: 30, speed: 1.6, botSkill: [0.62, 0.85] },
];
const LEVEL_COUNT = LEVELS.length;

// Bölüm ilerlemesi — cihazda saklanır. Ayarlar'daki test kilidi (kod 1234)
// uygulamada her şeyi açar; bölüm seçici de ona uyar.
const PROGRESS_KEY = "elifba-party-progress-v1";
function getUnlockedLevel(): number {
  if (isTestUnlockActive()) return LEVEL_COUNT;
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

const BOT_NAMES = ["Zeynep", "Yusuf", "Ayşe", "Ömer", "Elif"];
const BOT_COLORS = [0xf59e0b, 0xef4444, 0x8b5cf6, 0x06b6d4, 0xec4899];
const PLAYER_COLOR = 0x22c55e;


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


// ================= tipler =================
type Phase = "levels" | "race" | "finish";

// ---- özel güçler ----
// Çocuk aynı anda YALNIZCA BİR güç taşır (kullanıcı şartı) ve hangisini
// alacağı RASTGELEDİR — sürpriz, oyunu her turda farklı kılar. Kazanınca
// karakter parlar, kullanınca ışıklı aura açılır: çocuk gücü aldığını ve
// kullandığını yazıyı okumadan, sadece bakarak anlar.
type PowerKind = "rocket" | "jump" | "net" | "shield";
const POWERS: Record<PowerKind, { emoji: string; label: string; got: string; hex: number }> = {
  rocket: { emoji: "🚀", label: "Roket", got: "🚀 ROKET kazandın!", hex: 0xff7a18 },
  jump:   { emoji: "⭐", label: "Süper Zıplama", got: "⭐ SÜPER ZIPLAMA kazandın!", hex: 0xfacc15 },
  net:    { emoji: "🕸️", label: "Ağ", got: "🕸️ AĞ kazandın!", hex: 0x38bdf8 },
  shield: { emoji: "🛡️", label: "Kalkan", got: "🛡️ KALKAN kazandın!", hex: 0x22d3ee },
};
const POWER_KINDS: PowerKind[] = ["rocket", "jump", "net", "shield"];
const randomPower = (): PowerKind => POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)];

const ROCKET_TIME = 5.0;       // 🚀 doğru cevabın verdiği normal hızdan uzun
const SHIELD_TIME = 6.0;       // 🛡️ bu süre boyunca hiçbir engel çarpmaz
const SUPER_JUMP_MUL = 1.75;   // ⭐ normal zıplamanın kaç katı

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
  // Soru kapı SIRASI GELİNCE dağıtılır (armGate) — bölüm başında hepsine
  // birden dağıtılırsa SRS güncellenmediği için hepsi aynı harfi alıyor.
  target: ContentItem | null;
  options: ContentItem[];   // 3 şık, soldan sağa (dağıtılana kadar boş)
  done: boolean;
  said: number;             // 0 = ses hiç çalmadı, 1 = çaldı
  tries: number;            // soruyu sesli sorma denemesi (en fazla 2)
  botDone: Set<number>;
  panels: THREE.Mesh[];     // şık panoları (doğru/yanlış renklendirmesi için)
  /** "Tabela" modunda kapının ÜSTÜNDE asılı duran glif panosu. */
  topPanel: THREE.Mesh | null;
  /** Bu kapı hangi modda kuruldu (bölüm ortasında ayar değişse bile sabit). */
  mode: AskMode;
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
  /**
   * ⚠️ TAKLA SONRASI DOKUNULMAZLIK — kısır döngü kırıcı.
   *
   * Alçak dönen çubuk (spinner) sürekli döndüğü için çocuk bir kez
   * takıldığında ÇIKAMIYORDU: takla 1 sn sürüyor, o sırada ne yön
   * değiştirebiliyor ne ZIPLAYABİLİYOR (zıplama `hitT > 0` iken kapalı),
   * geri itilme (2.4 birim) ise çubuğun 8.5 birimlik erişiminden
   * çıkarmıyor. Takla biter bitmez çubuk geri geliyor ve çocuk üst üste
   * 4-5 kez yere düşüyordu (kullanıcı bildirdi: "çok sinir bozucu").
   * Artık takladan sonra `GRACE_TIME` kadar hiçbir engel çarpmaz —
   * bu süre içinde çocuk zıplayıp geçebilir.
   */
  graceT: number;
  shieldT: number;        // 🛡️ aktifken hiçbir engel çarpmaz
  glowT: number;          // güç kazanma parlaması (kısa)
  dodge: number;          // 0..1 — botun ENGELDEN kaçma becerisi
  targetX: number;
  homeX: number;
  gateChoice: number | null;
  finished: number | null;
  hop: number;
  group: THREE.Group;
  body: THREE.Group;      // gövde + yüz + şapka (birlikte eğilir/takla atar)
  legs: [THREE.Object3D, THREE.Object3D];
  arms: [THREE.Object3D, THREE.Object3D];
  bodyMat: THREE.MeshLambertMaterial;   // parlama için emissive'i değişir
  aura: THREE.Mesh | null;              // güç aktifken açılan ışık küresi
}

const PartyGame = () => {
  const navigate = useNavigate();
  useLockBodyScroll();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>("levels");
  const [level, setLevel] = useState(1);              // oynanan bölüm (1..10)
  const [unlocked, setUnlocked] = useState(() => getUnlockedLevel());
  const [hud, setHud] = useState({ place: 1, pct: 0, correct: 0, wrong: 0 });
  const [power, setPower] = useState<PowerKind | null>(null);      // taşınan tek güç
  const [activePower, setActivePower] = useState<PowerKind | null>(null); // şu an etkin
  const [prompt, setPrompt] = useState<ContentItem | null>(null);
  // "Şimşek" modunda ekranda parlayıp sönen glif.
  const [glifFlash, setGlifFlash] = useState<ContentItem | null>(null);
  const askModeRef = useRef<AskMode>(getAskMode());
  const [flash, setFlash] = useState<{ k: number; text: string; good: boolean } | null>(null);
  const [result, setResult] = useState<{ place: number; correct: number; wrong: number } | null>(null);
  const teaseRef = useRef(gardenTease());

  useRemedyOnGameOver(phase === "finish");

  // --- oyun durumu: render döngüsünde mutasyon; React state yalnız HUD ---
  const racersRef = useRef<Racer[]>([]);
  const gatesRef = useRef<Gate[]>([]);
  const obsRef = useRef<Obstacle[]>([]);
  const netsRef = useRef<{ mesh: THREE.Object3D; x: number; z: number; from: number }[]>([]);
  // dir: klavye (masaüstü). dragX: parmakla sürüklemenin hedeflediği x.
  const ctrlRef = useRef({
    dir: 0 as -1 | 0 | 1,
    dragX: null as number | null,
    jump: false,
    usePower: false,
    running: false,
  });
  const powerRef = useRef<PowerKind | null>(null);
  const statsRef = useRef({ correct: 0, wrong: 0 });
  const flashK = useRef(0);
  const promptIdRef = useRef<string | null>(null);
  const [raceKey, setRaceKey] = useState(0);   // her yarışta sahne baştan kurulsun

  const showFlash = (text: string, good: boolean) => {
    flashK.current += 1;
    setFlash({ k: flashK.current, text, good });
    setTimeout(() => setFlash(null), 1200);
  };

  const start = useCallback((lv: number) => {
    setLevel(lv);
    setRaceKey((k) => k + 1);
    setResult(null);
    setPrompt(null);
    promptIdRef.current = null;
    setHud({ place: 1, pct: 0, correct: 0, wrong: 0 });
    setPower(null);
    setActivePower(null);
    powerRef.current = null;
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
    // Sabit oran yerine UYARLANIR çözünürlük (bkz. _perf.ts): cihaz
    // kasıyorsa piksel sayısı düşer, rahatsa geri yükselir. Capacitor
    // WebView'de en büyük kazanç burada.
    const adaptiveRes = createAdaptiveResolution(
      renderer,
      () => ({ w: wrap.clientWidth || window.innerWidth, h: wrap.clientHeight || window.innerHeight }),
    );
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
    const track = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => { disposables.push(x); return x; };

    const def = LEVELS[Math.min(LEVELS.length, Math.max(1, level)) - 1];
    const TRACK_LEN = def.len;
    const FINISH_Z = TRACK_LEN;

    // ---------- yol ----------
    // Fall Guys pastel şeritleri: her 20 birimde renk değişir → hız hissi.
    const roadGeo = track(new THREE.BoxGeometry(ROAD_HALF * 2, 1, 20));
    const STRIPES = [0xffd6ec, 0xd9f7ff, 0xfff2c9, 0xd8ffe6];
    for (let i = 0; i < Math.ceil((TRACK_LEN + 60) / 20); i++) {
      const m = new THREE.Mesh(roadGeo, track(new THREE.MeshLambertMaterial({ color: STRIPES[i % STRIPES.length] })));
      m.position.set(0, -0.5, wz(-20 + i * 20 + 10));
      scene.add(m);
    }
    // yumuşak kenar duvarları (çocuk yoldan düşmez — Fall Guys'taki şişme bariyer)
    const wallGeo = track(new THREE.BoxGeometry(0.9, 1.6, TRACK_LEN + 80));
    const wallMat = track(new THREE.MeshLambertMaterial({ color: 0xff8fc4 }));
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(s * (ROAD_HALF + 0.45), 0.4, wz(TRACK_LEN / 2 - 10));
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
        b.position.set(s * BAL_X, base, wz(z));
        b.scale.y = 1.25;
        scene.add(b);
        decor.push({ mesh: b, base, ph: z * 0.7 });
        const str = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, base, 6)), stringMat);
        str.position.set(s * BAL_X, base / 2, wz(z));
        scene.add(str);
      }
    }
    // arka planda pastel tepeler (derinlik hissi)
    const hillGeo = track(new THREE.SphereGeometry(16, 14, 10));
    const hillMat = track(new THREE.MeshLambertMaterial({ color: 0xbbf7d0 }));
    for (let i = 0; i < 10; i++) {
      const hMesh = new THREE.Mesh(hillGeo, hillMat);
      hMesh.position.set((i % 2 ? -1 : 1) * (24 + (i % 3) * 9), -7, wz(30 + i * 34));
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
      post.position.set(x, 2.3, wz(z));
      scene.add(post);
      const pivot = new THREE.Group();
      pivot.position.set(x, 2.6, wz(z));
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
      pivot.position.set(x, 8.4, wz(z));
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
      g.position.set(0, 0.9, wz(z));
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
      m.position.set(0, 1.1, wz(z));
      scene.add(m);
      obstacles.push({ kind: "roller", z, t: t0, sp, span, body: m });
    };
    const addMud = (z: number, x: number, w: number, d: number) => {
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, 0.14, d)), matMud);
      m.position.set(x, 0.06, wz(z));
      scene.add(m);
      obstacles.push({ kind: "mud", z, x, w, d });
    };

    // ---------- soru kapıları ----------
    // Mod bölüm başında bir kez okunur; ortasında Ayarlar değişse bile
    // kapıların anlamı değişmesin.
    const askMode = getAskMode();
    askModeRef.current = askMode;
    const pool = gamePool();
    const gates: Gate[] = [];
    const panelGeo = track(new THREE.PlaneGeometry(5, 5));
    const doorFrameGeo = track(new THREE.BoxGeometry(0.6, 6.6, 0.6));
    const gateTopGeo = track(new THREE.BoxGeometry(ROAD_HALF * 2, 0.7, 0.7));
    const matFrame = track(new THREE.MeshLambertMaterial({ color: 0x0f766e }));
    // Kapının SORUSU burada seçilmez — bkz. armGate. Bölüm başında bütün
    // kapılara birden soru dağıtılırsa SRS durumu hiç değişmediği için
    // pickNextGameItem her seferinde AYNI harfi (müfredatın ilk görülmemiş
    // harfi = Elif) döndürüyordu; çocuk bütün bölüm boyunca tek harf görüyordu.
    const addGate = (z: number) => {
      if (pool.length < 3) return;
      const panels: THREE.Mesh[] = [];
      const g = new THREE.Group();
      g.position.z = wz(z);
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
          map: null, transparent: true, side: THREE.DoubleSide,
        }));
        const p = new THREE.Mesh(panelGeo, mat);
        p.position.set(px, 3.1, 0);
        g.add(p);
        panels.push(p);
      }
      // "Tabela" modunda glif kapının ÜSTÜNDE asılı durur; şıklar aşağıda
      // yazılı adlardır. Diğer modlarda hiç oluşturulmaz.
      let topPanel: THREE.Mesh | null = null;
      if (askMode === "ustte") {
        const tm = track(new THREE.MeshBasicMaterial({ map: null, transparent: true, side: THREE.DoubleSide }));
        topPanel = new THREE.Mesh(track(new THREE.PlaneGeometry(4.4, 4.4)), tm);
        topPanel.position.set(0, 9.6, 0);
        g.add(topPanel);
      }
      g.visible = false;   // sorusu dağıtılana kadar boş pano gösterme
      scene.add(g);
      gates.push({
        z, target: null, options: [], tries: 0, done: false, said: 0,
        botDone: new Set(), panels, group: g, topPanel, mode: askMode,
      });
    };

    // Kapıya SIRASI GELİNCE soru dağıt. Bir önceki kapı cevaplanıp
    // recordGameAnswer çalıştıktan sonra çağrıldığı için SRS durumu güncel:
    // seviye/aciliyet/karışıklık ısısı hesaba katılır ve harf gerçekten değişir.
    // "Öğret" modu kapıları İKİŞERLİ kullanır: önce ÖĞRETME kapısı (üç şerit
    // de aynı harf, geçerken adını söyler), hemen ardından AYNI harfin klasik
    // SINAMA kapısı.
    const armGate = (g: Gate) => {
      const target = pickNextGameItem(pool) || pool[0];
      // ⚠️ PARTİ'DE ŞIK SAYISI HEP 3. Yarışı'nda şimşek modu 2 şıkka iniyor
      // (orta şerit çapraz taralı plakayla kapanıyor), ama burada şeritler
      // parkurun kendisi — kapatılan şerit engel gibi görünüp çocuğu
      // yanıltıyor. Burada şimşek de 3 yazılı şıkla sorulur.
      const yeniMod = yaziliSik(g.mode) && okunurAd(target) !== null;
      const wrongs = yeniMod
        ? pickNameWrongs(pool, target, 2, { zorluk: adZorlugu(getGameItemLevel(target)) })
        : pickWrongs(pool, target, 2);
      if (wrongs.length < 2) {
        // Yeni modda yeterli ad bulunamadı → klasiğe düş, kapı boşa gitmesin.
        const kw = pickWrongs(pool, target, 2);
        if (kw.length < 2) { g.done = true; return; }
        g.mode = "klasik";
        g.options = shuffle([target, ...kw]);
      } else {
        g.options = shuffle([target, ...wrongs]);
      }
      g.target = target;
      g.tries = 0;
      preloadItems([target]);   // soru çalana kadar dosya inmiş olsun
      g.panels.forEach((p, i) => {
        const m = p.material as THREE.MeshBasicMaterial;
        m.map = yaziliSik(g.mode)
          ? track(wordTexture(okunurAd(g.options[i]) ?? "?"))
          : track(letterTexture(g.options[i].emoji ?? "؟"));
        m.color.set(0xffffff);
        m.needsUpdate = true;
      });
      if (g.topPanel) {
        const tm = g.topPanel.material as THREE.MeshBasicMaterial;
        tm.map = track(letterTexture(target.emoji ?? "؟"));
        tm.needsUpdate = true;
        g.topPanel.visible = g.mode === "ustte";
      }
    };

    // ---------- parkur dizilimi (bölüm reçetesinden prosedürel) ----------
    // Ritim: uzun engel bölümü → soru kapısı → uzun engel bölümü …
    // Kapılar parkurun İKİ UCUNA YAYILIR (eşit parçalara bölmek yerine):
    // aralarında PROMPT_LEAD'den fazla mesafe kalması şart, yoksa bir kapıyı
    // geçer geçmez sonrakinin sesi çalıp çocuk hiç nefes alamıyor.
    const gStart = 82;
    const gEnd = TRACK_LEN - 50;
    const gateZs: number[] = [];
    for (let i = 0; i < def.gates; i++) {
      const t = def.gates === 1 ? 0.5 : i / (def.gates - 1);
      gateZs.push(Math.round(gStart + t * (gEnd - gStart)));
    }
    const nearGate = (z: number) =>
      gateZs.some((gz) => z <= gz ? gz - z < GATE_CLEAR_BEFORE : z - gz < GATE_CLEAR_AFTER);

    let ki = 0;
    for (let z = 34; z < TRACK_LEN - 24; z += def.gap) {
      if (nearGate(z)) continue;
      const kind = def.kinds[ki % def.kinds.length];
      ki++;
      // Yön/faz çeşitliliği: aynı engel hep aynı taraftan gelmesin
      const side = ki % 2 ? -1 : 1;
      const dir = ki % 3 ? 1 : -1;
      const t0 = (ki * 0.7) % 3;
      const sp = def.speed;
      if (kind === "hammer") addHammer(z, side * 4.0, dir * 1.9 * sp, t0);
      else if (kind === "pendulum") addPendulum(z, side * 4.0, dir * 1.9 * sp, 5.8, t0);
      else if (kind === "spinner") addSpinner(z, dir * 2.2 * sp, t0);
      else if (kind === "roller") addRoller(z, dir * 1.7 * sp, 7.2, t0);
      else addMud(z, side * 3.4, 7, 7);
    }
    for (const gz of gateZs) addGate(gz);

    obsRef.current = obstacles;
    gatesRef.current = gates;

    // ---------- bitiş: taç + damalı çizgi ----------
    const finishG = new THREE.Group();
    finishG.position.z = wz(FINISH_Z);
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
      // Koşu yönü -Z olduğu için yüz de -Z'ye bakar (kamera arkada, +Z'de).
      // Düzlem gövdenin DIŞINDA durmalı: kapsülün içine gömülünce arkadan
      // bakıldığında gözler/ağız gövdeden sızıyordu.
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(0, 0.28, -0.79);
      face.rotation.y = Math.PI;
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
      tail.position.set(0, -0.35, 0.78);   // kuyruk ARKADA = +Z (koşu yönü -Z)
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
        foot.position.set(0, -0.48, -0.1);   // ayak ucu ileri = -Z
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
      // Işık aurası — güç kazanınca/aktifken açılır. Çocuk gücü aldığını
      // yazıyı okumadan, sadece karakterin parlamasından anlar.
      let aura: THREE.Mesh | null = null;
      if (isPlayer) {
        aura = new THREE.Mesh(
          track(new THREE.SphereGeometry(1.55, 18, 14)),
          track(new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
          })),
        );
        aura.position.y = 1.3;
        aura.visible = false;
        group.add(aura);
      }
      scene.add(group);
      return {
        id, name, isPlayer, z: 0, x: homeX, y: 0, vy: 0,
        boostT: 0, mudT: 0, netT: 0, hitT: 0, graceT: 0, shieldT: 0, glowT: 0,
        dodge: isPlayer ? 1 : def.botSkill[0] + Math.random() * (def.botSkill[1] - def.botSkill[0]),
        targetX: homeX, homeX, gateChoice: null, finished: null,
        hop: Math.random() * 6, group, body,
        legs: legs as [THREE.Object3D, THREE.Object3D],
        arms: arms as [THREE.Object3D, THREE.Object3D],
        bodyMat: mat, aura,
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
    powerRef.current = null;
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

    // ---------- hyper-casual sürükleme kontrolü ----------
    // Parmağını basılı tutup sağa/sola KAYDIRIR, karakter parmağı takip eder.
    // Subway Surfers gibi "swipe = şerit atla" DEĞİL: hareket sürekli, çocuk
    // istediği noktaya milimetrik gidebilir. Kısa dokunuş (kaydırmadan) = ZIPLA.
    let dragId: number | null = null;
    let dragStartPx = 0;
    let dragStartX = 0;
    let dragMoved = false;
    let dragDownAt = 0;
    /** Ekran pikseli → yol birimi. Ekranın yarısını kaydırmak yolun yarısını geçirir. */
    const pxToUnits = () => (ROAD_HALF * 2.2) / Math.max(1, wrap.clientWidth);

    const onDown = (e: PointerEvent) => {
      if (dragId !== null) return;
      dragId = e.pointerId;
      dragStartPx = e.clientX;
      dragStartX = racersRef.current[0]?.x ?? 0;
      dragMoved = false;
      dragDownAt = performance.now();
      ctrlRef.current.dragX = dragStartX;
    };
    const onMove = (e: PointerEvent) => {
      if (dragId !== e.pointerId) return;
      const dpx = e.clientX - dragStartPx;
      if (Math.abs(dpx) > 8) dragMoved = true;
      ctrlRef.current.dragX = Math.max(-ROAD_HALF + 0.7, Math.min(ROAD_HALF - 0.7, dragStartX + dpx * pxToUnits()));
    };
    const onUp = (e: PointerEvent) => {
      if (dragId !== e.pointerId) return;
      dragId = null;
      ctrlRef.current.dragX = null;
      // kaydırmadan kısa dokunuş → zıpla (ayrı düğmeye basmaya gerek yok)
      if (!dragMoved && performance.now() - dragDownAt < 260) ctrlRef.current.jump = true;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // ---------- yardımcılar ----------
    const player = racers[0];
    const laneOf = (x: number) => Math.max(0, Math.min(2, Math.floor(((x + ROAD_HALF) / (ROAD_HALF * 2)) * 3)));
    const laneX = (i: number) => -ROAD_HALF + (i + 0.5) * (ROAD_HALF * 2 / 3);

    /** Çekiç/sarkaç/çubuk vurdu mu? Vurulan takla atar, geri kayar. */
    const knock = (r: Racer, push: number) => {
      // Takla sırasında VE hemen sonrasındaki dokunulmazlıkta çarpma yok
      // (yoksa dönen çubuk çocuğu döngüye sokuyor — bkz. Racer.graceT).
      if (r.hitT > 0 || r.graceT > 0) return;
      if (r.shieldT > 0) {           // 🛡️ kalkan: engel çarpmaz, sadece ışık
        if (r.isPlayer) { playSfx("coin"); r.glowT = Math.max(r.glowT, 0.3); }
        return;
      }
      r.hitT = HIT_TIME;
      r.graceT = HIT_TIME + GRACE_TIME;
      r.z = Math.max(0, r.z - push);
      r.vy = 5.5;
      r.y = Math.max(r.y, 0.1);
      r.boostT = 0;
      if (r.isPlayer) { playSfx("stomp"); showFlash("💫 Takla attın!", false); }
    };

    /**
     * Engelin şu anki tehlike merkezi — MANTIKSAL koordinatta (z artan).
     * Çekiç kolu sahnede lokal +Z'de duruyor ama sahne -Z'ye kurulu olduğu
     * için mantıksal z'de İŞARET TERSTİR (`- cos(a)`); `clear` ise engelin
     * üstünden zıplayarak geçmek için gereken yükseklik.
     */
    const hazardOf = (o: Obstacle): { x: number; z: number; r: number; clear: number } | null => {
      if (o.kind === "hammer") {
        const a = o.t * o.sp;
        return { x: o.x + Math.sin(a) * o.arm, z: o.z - Math.cos(a) * o.arm, r: 2.7, clear: HAMMER_CLEAR };
      }
      if (o.kind === "pendulum") {
        return { x: o.x + Math.sin(o.t * o.sp) * o.amp, z: o.z, r: 2.4, clear: PEND_CLEAR };
      }
      if (o.kind === "spinner") {
        return { x: 0, z: o.z, r: 0, clear: JUMP_CLEAR };   // çubuk yolu keser → zıpla
      }
      if (o.kind === "roller") {
        return { x: Math.sin(o.t * o.sp) * o.span, z: o.z, r: 2.3, clear: ROLLER_CLEAR };
      }
      return null;
    };

    const collide = (r: Racer, dt: number) => {
      let inMud = false;
      for (const o of obsRef.current) {
        // Kaba eleme: çekiç kolu 6.9 uzunlukta, kafa yarıçapı 2.7 → merkez
        // mesafesi 12'ye kadar hâlâ değebilir.
        if (Math.abs(o.z - r.z) > 12) continue;
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
          // Çubuk lokal X'te uzanır, rotation.y = a. Sahne -Z'de kurulu
          // olduğu için mantıksal z bileşeni +sin(a) olur.
          const a = o.t * o.sp;
          const dxa = Math.cos(a), dza = Math.sin(a);
          const px = r.x, pz = r.z - o.z;
          const t = Math.max(-o.len, Math.min(o.len, px * dxa + pz * dza));
          const ex = px - t * dxa, ez = pz - t * dza;
          if (ex * ex + ez * ez < 1.15 * 1.15) knock(r, 2.4);
          continue;
        }
        // Zıplama artık gerçek bir kaçış: her engelin kendi "üstünden geç"
        // eşiği var (çekiç 4.4, sarkaç 4.2, silindir 2.4).
        if (r.y >= hz.clear) continue;
        const dx = r.x - hz.x, dz = r.z - hz.z;
        if (dx * dx + dz * dz < hz.r * hz.r) knock(r, o.kind === "hammer" ? 3.4 : 2.4);
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

      // --- ÖZEL GÜÇ kullanımı (tek düğme, taşınan tek güç) ---
      if (ctrlRef.current.usePower) {
        ctrlRef.current.usePower = false;
        const k = powerRef.current;
        if (k && player.finished === null) {
          // ⭐ ancak yerdeyken kullanılabilir; boşa gitmesin diye güç durur
          if (k === "jump" && player.y > 0.02) {
            // yerde değil → gücü harcamadan geç
          } else {
            powerRef.current = null;
            setPower(null);
            if (k === "rocket") {
              player.boostT = ROCKET_TIME;
              playSfx("dove");
              showFlash("🚀 ROKET!", true);
            } else if (k === "jump") {
              player.vy = JUMP_V * SUPER_JUMP_MUL;
              player.mudT = 0;
              player.hitT = 0;
              playSfx("dove");
              showFlash("⭐ SÜPER ZIPLAMA!", true);
            } else if (k === "net") {
              const mesh = new THREE.Mesh(netGeo, netMat);
              mesh.position.set(player.x, 1.1, wz(player.z + 1));
              scene.add(mesh);
              netsRef.current.push({ mesh, x: player.x, z: player.z + 1, from: 0 });
              playSfx("coin");
              showFlash("🕸️ AĞ ATTIN!", true);
            } else {
              player.shieldT = SHIELD_TIME;
              player.mudT = 0;
              player.hitT = 0;
              playSfx("dove");
              showFlash("🛡️ KALKAN!", true);
            }
          }
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
        n.mesh.position.z = wz(n.z);
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
          r.group.position.set(r.x, r.y, wz(r.z));
          continue;
        }
        if (r.boostT > 0) r.boostT = Math.max(0, r.boostT - dt);
        if (r.mudT > 0) r.mudT = Math.max(0, r.mudT - dt);
        if (r.netT > 0) r.netT = Math.max(0, r.netT - dt);
        if (r.hitT > 0) r.hitT = Math.max(0, r.hitT - dt);
        if (r.graceT > 0) r.graceT = Math.max(0, r.graceT - dt);
        if (r.shieldT > 0) r.shieldT = Math.max(0, r.shieldT - dt);
        if (r.glowT > 0) r.glowT = Math.max(0, r.glowT - dt);

        // yatay yönelim
        if (r.isPlayer) {
          if (r.hitT <= 0) {
            // Hyper-casual kontrol: parmak ekranda sürüklendikçe karakter
            // ONU TAKİP EDER (şerit atlamalı "swipe" değil — çocuk istediği
            // yere milimetrik gidebilsin). dragX parmağın hedeflediği x'tir;
            // karaktere yumuşatarak yaklaşırız ki takılmalı görünmesin.
            const dx = ctrlRef.current.dragX;
            if (dx !== null) {
              const d = dx - r.x;
              r.x += Math.sign(d) * Math.min(Math.abs(d), STEER * 2.2 * dt);
            } else {
              r.x += ctrlRef.current.dir * STEER * dt;   // klavye (masaüstü)
            }
          }
        } else {
          // Bot: kapıda RASTGELE şerit seçer (kullanıcı şartı — botlar hep
          // doğruyu bulunca çocuk doğru cevap verse bile öne geçemiyordu;
          // artık doğru cevap gerçek bir avantaj). Engellerden kaçma becerisi
          // ayrı tutulur: yarış yine de çekişmeli olsun.
          const g = gatesRef.current.find((gg) => gg.z > r.z - 1 && !gg.botDone.has(r.id));
          if (g && g.z - r.z < 26) {
            if (r.gateChoice !== g.z) {
              r.gateChoice = g.z;
              r.targetX = laneX(Math.floor(Math.random() * 3));
            }
          } else {
            r.targetX = r.homeX;
            for (const o of obsRef.current) {
              if (o.kind === "mud" || o.kind === "spinner") continue;
              const hz = hazardOf(o);
              if (!hz) continue;
              const ahead = hz.z - r.z;
              if (ahead > 0 && ahead < 14 && Math.abs(hz.x - r.x) < 3.0 && Math.random() < r.dodge) {
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
              if (ahead > 0 && ahead < 6.5 && Math.random() < r.dodge) { r.vy = JUMP_V; break; }
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
        r.group.position.set(r.x, r.y, wz(r.z));
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
            // Bölümü bitirmek sonrakini açar (derece şartı yok — çocuk
            // sonuncu da olsa parkuru tamamladıysa devam edebilmeli).
            unlockLevel(level + 1);
            setUnlocked(getUnlockedLevel());
            setResult({ place: r.finished, correct: statsRef.current.correct, wrong: statsRef.current.wrong });
            setPhase("finish");
            playFeedback(r.finished <= 3);
          }
        }
      }

      // --- soru kapıları ---
      // Aynı anda YALNIZCA SIRADAKİ kapı görünür: iki kapı üst üste görününce
      // çocuk hangisine cevap vereceğini şaşırıyor.
      const nextGate = gatesRef.current.find((g) => !g.done);
      // Sırası gelen kapıya soruyu ŞİMDİ dağıt: bir önceki cevap SRS'e
      // işlendikten sonra seçildiği için harf her kapıda gerçekten değişir.
      if (nextGate && !nextGate.target) armGate(nextGate);
      for (const g of gatesRef.current) {
        // Geçilen kapı kameranın ÖNÜNDE kalıyor (kamera oyuncunun 17 birim
        // gerisinde) ve ekranın altını tamamen kapatıyordu. Doğru/yanlış
        // rengini görecek kadar bekleyip gizle.
        if (g.done) {
          if (g.group.visible && player.z > g.z + 6) g.group.visible = false;
        } else {
          g.group.visible = g === nextGate;
        }
        if (!g.done && g.target && player.finished === null && player.z >= g.z) {
          const target = g.target;
          g.done = true;
          const idx = laneOf(player.x);
          const chosen = g.options[idx];
          const correct = chosen.id === target.id;
          recordGameAnswer(target, correct, {
            gameId: "party", chosenId: chosen.id, shownIds: g.options.map((o) => o.id),
          });
          // geçilen kapıyı renklendir (görsel geri bildirim)
          g.panels.forEach((p, i) => {
            const m = p.material as THREE.MeshBasicMaterial;
            m.color.set(g.options[i].id === target.id ? 0x86efac : 0xfca5a5);
          });
          // YENİ MODLARDA doğru cevabın SESİ kapıdan geçerken çalar: soru
          // görseldi, geri bildirim işitsel — çocuk adı hem okur hem duyar.
          if (g.mode !== "klasik") window.setTimeout(() => playItem(target), 260);
          if (correct) {
            statsRef.current.correct += 1;
            player.boostT = BOOST_TIME;
            // Ödül: hız + RASTGELE bir özel güç (tek slot, üstüne yazar).
            // Hangisinin geleceği belli değil → her doğru cevap bir sürpriz.
            const k = randomPower();
            powerRef.current = k;
            setPower(k);
            player.glowT = 1.1;                  // karakter parlayarak "aldım" der
            showFlash(POWERS[k].got, true);
            playFeedback(true);
          } else {
            statsRef.current.wrong += 1;
            player.mudT = MUD_TIME;
            showFlash("💦 Çamur! Yavaşladın", false);
            playFeedback(false);
          }
        }
        for (const r of racers) {
          if (r.isPlayer || !g.target || g.botDone.has(r.id) || r.z < g.z) continue;
          g.botDone.add(r.id);
          const ok = g.options[laneOf(r.x)]?.id === g.target.id;
          if (ok) r.boostT = BOOST_TIME * 0.9; else r.mudT = MUD_TIME;
        }
      }

      // --- sıradaki kapının sesi ---
      // Ses çalma YAN ETKİDİR: setState güncelleyicisinin içine konulamaz
      // (StrictMode güncelleyiciyi iki kez çağırır → ses çift çalar).
      // Kapı başına TEK KEZ, PROMPT_LEAD kadar uzaktan çalar. Otomatik tekrar
      // YOK (kullanıcı şartı: aynı soruyu iki kez sormak rahatsız ediyor);
      // tekrar dinlemek isteyen çocuk "Hangi kapı? — dinle" bandına dokunur.
      const d = nextGate ? nextGate.z - player.z : Infinity;
      if (nextGate?.target && d > 0 && d < PROMPT_LEAD) {
        const gt = nextGate.target;
        if (nextGate.said === 0) {
          const g0 = nextGate;
          g0.said = 1;
          g0.tries += 1;
          setPrompt(gt);
          if (g0.mode === "flash") {
            // ⚠️ YENİ MODLARDA SORU SESLİ SORULMAZ: sesi çalmak harfin ADINI
            // söylemek = cevabı vermek olurdu. Soru GÖRSELdir.
            setGlifFlash(gt);
            window.setTimeout(() => setGlifFlash((x) => (x?.id === gt.id ? null : x)), FLASH_MS);
          } else if (g0.mode === "klasik") {
            // Kayıt gerçekten çalmadıysa soru sorulmuş sayılmaz (bkz. KartGame).
            playItem(gt, { onFail: () => { if (!g0.done && g0.tries < 2) g0.said = 0; } });
          }
          // "ustte" modunda hiçbir şey tetiklenmez — glif zaten kapıda asılı.
        }
        if (promptIdRef.current !== gt.id) {
          promptIdRef.current = gt.id;
          setPrompt(gt);
        }
      } else if (promptIdRef.current !== null) {
        promptIdRef.current = null;
        setPrompt(null);
      }

      // --- kamera: oyuncunun arkasından, yukarıdan, yumuşak takip ---
      // Yakın kamera parkuru görünmez yapıyordu (çekiç direği ekranı kapatıyordu);
      // geride + yüksekte durup ileriye bakınca çocuk engeli GELİRKEN görür.
      // Kamera oyuncunun ARKASINDA = mantıksal z'de geride = sahnede +Z tarafta.
      camera.position.x += (player.x * 0.5 - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += ((12.5 + player.y * 0.3) - camera.position.y) * Math.min(1, dt * 5);
      camera.position.z += (wz(player.z - 17.5) - camera.position.z) * Math.min(1, dt * 8);
      // Biraz aşağı bakış: yol kadrajı doldursun, ekranın yarısı boş gök olmasın
      camera.lookAt(player.x * 0.3, 0.6 + player.y * 0.25, wz(player.z + 13));

      // dekor: balonlar süzülür, taç döner, oyuncunun oku zıplar
      const tNow = performance.now() * 0.001;
      for (const d of decor) d.mesh.position.y = d.base + Math.sin(tNow * 1.3 + d.ph) * 0.35;
      crown.rotation.y = Math.sin(tNow * 2) * 0.4;
      const marker = player.group.getObjectByName("marker");
      if (marker) {
        marker.position.y = 3.35 + Math.abs(Math.sin(tNow * 4)) * 0.32;
        marker.rotation.y = tNow * 1.6;
      }
      // ⚠️ GÖRÜNÜRLÜĞÜN TEK SAHİBİ BURASI. İki kural birleştirilir, yoksa
      // sonra çalışan biri ötekini eziyor:
      //  (1) Geride kalan yarışmacı kameranın önüne girip ekranı kapatıyordu
      //      → kameraya çok yakın olanı gizle (yarışta koşmaya devam eder).
      //  (2) Takla sonrası DOKUNULMAZLIK görünür olsun: karakter yanıp söner,
      //      çocuk "şimdi çarpmıyorum, kaç" bilgisini alsın. Görünmez bir
      //      kural çocuğa hiçbir şey anlatmaz.
      for (const r of racers) {
        const kameradaGorunur = wz(r.z) < camera.position.z - 5.5;
        const sondu = r.hitT <= 0 && r.graceT > 0 && Math.floor(r.graceT * 12) % 2 === 0;
        r.group.visible = kameradaGorunur && !sondu;
      }

      // --- GÜÇ IŞIĞI: karakter parlar, aura açılır ---
      // Üç durum, üç renk: kalkan (camgöbeği), roket/hız (turuncu),
      // güç kazanma flaşı (beyaz-altın). Sözle değil ışıkla anlatılır.
      const auraMat = player.aura?.material as THREE.MeshBasicMaterial | undefined;
      let glowHex = 0;
      let glowAmt = 0;
      // Işık karakterin KENDİ rengini yutmamalı (emissive fazla olunca yeşil
      // oyuncu tamamen sarıya dönüyordu) — parlasın ama kim olduğu belli kalsın.
      if (player.shieldT > 0) {
        glowHex = POWERS.shield.hex;
        glowAmt = 0.40 + Math.sin(tNow * 9) * 0.10;
      } else if (player.boostT > 0) {
        glowHex = POWERS.rocket.hex;
        glowAmt = 0.30 + Math.sin(tNow * 14) * 0.10;
      } else if (player.glowT > 0) {
        glowHex = 0xfff3b0;
        glowAmt = Math.min(1, player.glowT) * 0.5;
      }
      if (glowAmt > 0) {
        player.bodyMat.emissive.setHex(glowHex);
        player.bodyMat.emissiveIntensity = glowAmt;
        if (player.aura && auraMat) {
          player.aura.visible = true;
          auraMat.color.setHex(glowHex);
          auraMat.opacity = glowAmt * 0.42;
          const s = 1 + Math.sin(tNow * 7) * 0.07;
          player.aura.scale.setScalar(s);
        }
      } else {
        player.bodyMat.emissive.setHex(0x000000);
        if (player.aura) player.aura.visible = false;
      }
    };

    // ---------- döngü ----------
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    const ctrl = ctrlRef.current;
    ctrl.dir = 0; ctrl.dragX = null; ctrl.jump = false; ctrl.usePower = false;
    ctrl.running = true;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtRaw = (now - last) / 1000;
      const dt = Math.min(DT_MAX, dtRaw);
      last = now;
      adaptiveRes.sample(dtRaw);
      if (ctrlRef.current.running) step(dt);
      renderer.render(scene, camera);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.16;
        const ahead = racers.filter((r) => !r.isPlayer && (r.finished !== null || r.z > player.z)).length;
        setHud({
          place: ahead + 1,
          pct: Math.min(100, Math.round((player.z / FINISH_Z) * 100)),
          correct: statsRef.current.correct,
          wrong: statsRef.current.wrong,
        });
        // Etkin gücü HUD'a bildir (düğme rengi + rozet buna göre yanar)
        setActivePower(player.shieldT > 0 ? "shield" : player.boostT > 0 ? "rocket" : null);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
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
  }, [phase, raceKey, level]);

  // ---------- klavye (masaüstü) ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") ctrlRef.current.dir = -1;
      else if (e.code === "ArrowRight" || e.code === "KeyD") ctrlRef.current.dir = 1;
      else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); ctrlRef.current.jump = true; }
      else if (e.code === "KeyX" || e.code === "KeyJ") ctrlRef.current.usePower = true;
    };
    const up = (e: KeyboardEvent) => {
      if ((e.code === "ArrowLeft" || e.code === "KeyA") && ctrlRef.current.dir === -1) ctrlRef.current.dir = 0;
      if ((e.code === "ArrowRight" || e.code === "KeyD") && ctrlRef.current.dir === 1) ctrlRef.current.dir = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

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
            <div className="rounded-2xl bg-white/85 px-3 py-1.5 text-center shadow-card backdrop-blur">
              <div className="text-[10px] font-bold text-muted-foreground">B{level} · Sıra</div>
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
              <div className="text-[10px] font-bold text-muted-foreground">Güç</div>
              <div className="text-lg leading-tight">{power ? POWERS[power].emoji : "—"}</div>
            </div>
          </div>

          {/* ⚠️ Yeni modlarda "dinle" bandı YOK: sesi çalmak adı söylemek =
              cevabı vermek. Şimşekte yerine glifi tekrar gösteren düğme var. */}
          {prompt && askModeRef.current === "klasik" && (
            <button
              onClick={() => playItem(prompt)}
              className="absolute inset-x-3 top-[74px] z-20 flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-white/90 px-3 py-2 font-extrabold text-primary shadow-card backdrop-blur active:scale-95"
            >
              <Volume2 className="h-5 w-5" />
              Hangi kapı? — dinle
            </button>
          )}
          {prompt && askModeRef.current === "flash" && (
            <button
              onClick={() => {
                const p0 = prompt;
                setGlifFlash(p0);
                window.setTimeout(() => setGlifFlash((x) => (x?.id === p0.id ? null : x)), FLASH_MS);
              }}
              className="absolute inset-x-3 top-[74px] z-20 flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-white/90 px-3 py-2 font-extrabold text-primary shadow-card active:scale-95"
            >
              <Eye className="h-5 w-5" />
              Harfi tekrar göster
            </button>
          )}

          {/* ŞİMŞEK — glif SAYDAM DEĞİL, altlık saydam (harf tanıma parlaklık
              karşıtlığına bağlı). Konum üst bölge: üste bindirilmiş sabit
              sembol dikkati tünelliyor, sürüş alanının üstü kapatılmıyor. */}
          {glifFlash && (
            <div className="pointer-events-none absolute inset-x-0 top-[18%] z-30 flex justify-center">
              {/* ⚠️ leading 1.35 gliflerin nokta/kesresini yuvarlağın dışına
                  taşırıyordu; 1.7 şart. Boyut da ekrana göre sınırlı. */}
              <div className="rounded-[2rem] border-2 border-foreground/75 bg-white/75 px-7 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.28)]">
                <div
                  className="block font-arabic text-emerald-950"
                  style={{
                    fontSize: "min(6.5rem, 26vw)", lineHeight: 1.7,
                    textShadow: "0 0 10px rgba(255,255,255,0.95), 0 0 3px rgba(255,255,255,1)",
                  }}
                  dir="rtl"
                >
                  {glifFlash.emoji}
                </div>
              </div>
            </div>
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

          {/* Kontroller yüzer: ekranın geri kalanı SÜRÜKLEME alanıdır.
              Alt bara sabit düğme koyulunca parmak oraya takılıyor ve
              hyper-casual "kaydır" hissi kayboluyordu. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-1 px-5 pb-3">
            <div className="flex flex-col items-center gap-1">
              <button
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); ctrlRef.current.jump = true; }}
                aria-label="Zıpla"
                className="pointer-events-auto flex h-20 w-20 touch-none select-none flex-col items-center justify-center rounded-full bg-success/90 text-success-foreground shadow-card backdrop-blur active:scale-90"
              >
                <span className="text-3xl leading-none">🦘</span>
                <span className="text-[10px] font-extrabold">ZIPLA</span>
              </button>
              {/* Zıplamanın ikinci yolu: ekranın herhangi bir yerine dokunmak */}
              <span className="rounded-full bg-white/85 px-2 py-0.5 text-center text-[10px] font-extrabold leading-tight text-success">
                ya da ekrana<br />tıkla
              </span>
            </div>

            <span className="mb-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-extrabold text-muted-foreground backdrop-blur">
              👆 parmağını kaydır
            </span>

            {/* TEK özel güç düğmesi — oyunun ANA düğmesi: büyük, kalın çerçeveli,
                dolu olduğunda halkalarıyla birlikte yanıp söner. */}
            <div className="flex flex-col items-center gap-1">
              <button
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); ctrlRef.current.usePower = true; }}
                disabled={!power}
                aria-label={power ? `${POWERS[power].label} kullan` : "Özel güç yok"}
                className={cn(
                  "pointer-events-auto flex h-32 w-32 touch-none select-none flex-col items-center justify-center rounded-full border-[6px] shadow-elegant transition-bouncy active:scale-90",
                  power
                    ? "animate-pulse border-white bg-warning text-warning-foreground ring-[6px] ring-warning/45"
                    : "border-white/70 bg-white/70 text-muted-foreground opacity-75 backdrop-blur",
                )}
              >
                <span className="text-6xl leading-none drop-shadow">{power ? POWERS[power].emoji : "✨"}</span>
                <span className="mt-1 text-[11px] font-extrabold uppercase leading-none">
                  {power ? POWERS[power].label : "GÜÇ YOK"}
                </span>
              </button>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-center text-[10px] font-extrabold leading-tight",
                power ? "bg-warning text-warning-foreground" : "bg-white/85 text-muted-foreground",
              )}>
                {power ? "BAS ve kullan!" : "doğru kapı = güç"}
              </span>
            </div>
          </div>

          {/* Güç ETKİNKEN ekran kenarı da parlar — çocuk gücünün çalıştığını görür */}
          {activePower && (
            <div
              className="pointer-events-none absolute inset-0 z-10 animate-pulse"
              // İnce bir çerçeve parıltısı yeter: geniş yayılınca (90px)
              // parkurun yarısını boyayıp oyunu görünmez hâle getiriyordu.
              style={{
                boxShadow: `inset 0 0 34px 5px ${activePower === "shield" ? "rgba(34,211,238,0.55)" : "rgba(255,122,24,0.5)"}`,
              }}
            />
          )}
        </>
      )}

      {/* ---- BÖLÜM SEÇME ---- */}
      {phase === "levels" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4 pb-8 text-center">
          <div className="mt-2 text-5xl">🎉</div>
          <h1 className="mt-1 text-2xl font-extrabold text-primary">Elifbâ Partisi</h1>
          <p className="mx-auto mt-1 max-w-xs text-xs font-bold text-muted-foreground">
            5 arkadaşınla engelli parkurda yarış! Çekiçlerden kaç, çubuğu zıpla,
            <b className="text-primary"> doğru harfin kapısından</b> geç ve tacı kap 👑
          </p>

          <div className="mx-auto mt-3 grid w-full max-w-sm grid-cols-2 gap-2">
            {LEVELS.map((lv, i) => {
              const n = i + 1;
              const open = n <= unlocked;
              const done = n < unlocked;
              return (
                <button
                  key={n}
                  onClick={() => open && start(n)}
                  disabled={!open}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-2xl border-4 p-3 text-left shadow-card transition-bouncy",
                    open
                      ? "border-primary/40 bg-card active:scale-95"
                      : "border-muted bg-muted/40 opacity-60",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-lg font-extrabold text-primary">{n}. Bölüm</span>
                    {!open ? <Lock className="h-4 w-4 text-muted-foreground" />
                      : done ? <span className="text-lg">⭐</span> : null}
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">{lv.name}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {lv.gates} soru kapısı
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mx-auto mt-3 w-full max-w-sm rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-extrabold text-primary">
            🚧 Devamı gelecek — yeni bölümler yolda!
          </div>

          <div className="mx-auto mt-3 grid w-full max-w-sm gap-1.5 text-left text-xs font-bold">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/10 px-3 py-2">👆 Parmağını ekrana bas ve sağa/sola KAYDIR</div>
            <div className="rounded-xl border-2 border-info/30 bg-info/10 px-3 py-2">🦘 Ekrana TIKLA (ya da ZIPLA düğmesi) → çubuğun, hatta çekicin üstünden geç</div>
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-3 py-2">🔨 Dönen çekiç → değersen takla atarsın</div>
            <div className="rounded-xl border-2 border-success/30 bg-success/10 px-3 py-2">✅ Doğru kapı → 🚀 hız + SÜRPRİZ güç</div>
            <div className="rounded-xl border-2 border-warning/30 bg-warning/10 px-3 py-2">✨ Güç düğmesi: 🚀 roket · ⭐ zıplama · 🕸️ ağ · 🛡️ kalkan</div>
          </div>

          <button
            onClick={() => start(unlocked)}
            className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-success px-8 py-4 text-lg font-extrabold text-success-foreground shadow-card active:scale-95"
          >
            <Maximize2 className="h-5 w-5" /> {unlocked}. Bölümü Oyna
          </button>
          <button onClick={exit} className="mt-3 text-sm font-bold text-muted-foreground underline">
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
          <div className="-mt-1 text-sm font-bold text-muted-foreground">
            {level}. Bölüm · {LEVELS[level - 1]?.name}
          </div>
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
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {level < LEVEL_COUNT ? (
              <button onClick={() => start(level + 1)}
                className="rounded-full bg-success px-6 py-3 font-extrabold text-success-foreground shadow-card active:scale-95">
                ▶ {level + 1}. Bölüm
              </button>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-sm font-extrabold text-primary">
                🚧 Son bölümü bitirdin! Devamı gelecek…
              </div>
            )}
            <button onClick={() => start(level)}
              className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground shadow-card active:scale-95">
              Tekrar
            </button>
            <button onClick={() => { setPrompt(null); setPhase("levels"); }}
              className="rounded-full bg-muted px-5 py-3 font-extrabold text-muted-foreground shadow-card active:scale-95">
              Bölümler
            </button>
            <button onClick={exit}
              className="rounded-full bg-muted px-5 py-3 font-extrabold text-muted-foreground shadow-card active:scale-95">
              Çık
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyGame;
