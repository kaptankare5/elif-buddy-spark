// 🏎️ ELİFBÂ YARIŞI — Mario Kart tarzı 3B kart yarışı, botlarla.
//
// OYUN: çocuk 5 botla birlikte VİRAJLI bir pistte 2 tur atar. Pist boyunca
// SORU KAPILARI vardır: ses "Elif" der, önde üç kapı belirir, doğru harfin
// kapısından geçmek 🍄 turbo (2-3 sn hız) + RASTGELE bir özel güç verir.
// Yanlış kapı çamura sokar (yavaşlar; kimse elenmez).
//
// Elifbâ Partisi'nden AYRI bir oyun: orası düz koridorda koşu, burası
// VİRAJ ALMA becerisi — pist bir eğri (spline) üzerinde kurulur, pist dışına
// (çime) çıkmak yavaşlatır, viraja hızlı girmek savurur. Kart yarışı hissi
// bu üç şeyden gelir.
//
// TEKRAR SİSTEMİ KORUNUR: kapı hedefi pickNextGameItem'dan, şıklar pickWrongs
// (karışan harfler) ile kurulur, cevap recordGameAnswer'a chosenId/shownIds
// ile yazılır, yanlışta telafi kuyruğa girer, yarış bitince açılır.
//
// ŞİDDETSİZ: kimse vurulmaz/elenmez. Muz kabuğu yalnız KAYDIRIR (yavaşlatır),
// yıldız yalnız korur. Uygulamanın şiddetsiz çizgisiyle uyumlu.
//
// ---- MİMARİ: PİST BİR EĞRİDİR ----
// Oyun mantığı iki sayı ile çalışır:
//   s = pist boyunca kat edilen mesafe (0..TRACK_LEN, tur başında sıfırlanır)
//   u = pistin ortasından yanal sapma (-roadHalf..+roadHalf)
// Dünya konumu her karede eğriden hesaplanır: pos(s) + normal(s) * u.
// Böylece çarpışma, bot yapay zekâsı ve kapı seçimi düz bir koridordaymış
// gibi basit kalır; virajı yalnızca çizim ve kamera görür.
// Eğri örneklenip LOOKUP tablosuna alınır (curve.getPointAt her karede
// çağrılırsa 6 araç × 60 kare = pahalı).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { Volume2, Maximize2, Lock, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { gamePool, pickWrongs, shuffle } from "./_shared";
import { createAdaptiveResolution } from "./_perf";
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { playItem, playFeedback, playSfx, preloadItems } from "@/lib/audio";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { gardenTease } from "@/lib/sessionEnd";
import { isTestUnlockActive } from "@/lib/testUnlock";
import { letterTexture, nameTexture, emojiTexture, faceTexture, wordTexture } from "./_letterTexture";
import { getAskMode, okunurAd, pickNameWrongs, FLASH_SIK, USTTE_SIK, FLASH_MS, type AskMode } from "@/lib/askMode";
import type { ContentItem } from "@/data/types";

// ---- yarış sabitleri ----
// Yarış süresi: kullanıcı şartı "birkaç dakika araba kullansınlar".
// 3 tur × büyütülmüş pist ≈ 2-2.5 dk. Tur sayısını artırmak GEOMETRİ
// EKLEMEZ (aynı pist tekrar dönülür) — yani bedava süre; pisti büyütmek
// ise yalnız yol şeridinin üçgen sayısını artırır, o da tek mesh.
const LAPS = 3;
const RACERS = 6;
const DT_MAX = 0.05;

// Pist noktaları geniş yazıldı (okunabilirlik), sahneye bu çarpanla küçülür.
// Ölçeksiz hâlde bir tur ~1100 birim = 40 sn sürüyordu; 2 turluk yarış çocuk
// için çok uzundu. Küçültmek aynı zamanda virajları sıkılaştırıp "kart"
// hissini artırıyor.
// 0.7 → 1.0: pist %43 uzadı. Yan fayda: viraj yarıçapları da büyüdüğü için
// eğrilik düştü, kapılar daha uzaktan görünüyor.
const TRACK_SCALE = 1.0;

const ACCEL = 14;              // birim/sn² — otomatik gaz
const BASE_MAX = 30;           // düz yolda üst hız
const TURBO_MAX = 46;          // 🍄 / doğru kapı
const OFFROAD_MAX = 16;        // çimde üst hız (Mario Kart klasiği: yavaşlarsın)
const MUD_MAX = 9;             // yanlış kapı / muz
const BRAKE = 26;              // hız limitinin üstündeyken yavaşlama
const STEER_RATE = 15;         // yanal hız (birim/sn)
const TURBO_TIME = 2.8;        // "doğru kapıya giderse 2-3 saniye hız"
const STAR_TIME = 5.0;
const MUD_TIME = 1.6;
const SPIN_TIME = 0.9;         // muza değince savrulma
// 🪶 tüy: yüksek zıplama. 11 iken tepe ancak 2 birimdi, çocuk hiçbir şeyin
// değiştiğini fark etmiyordu ("tüy bir işe yaramıyor"). 18 ile tepe ≈5.4
// birim, havada ~1.2 sn kalınır: muzların ve çimin üstünden uçulur, inişte
// kısa turbo verilir — artık kullanıldığı belli olan bir güç.
const HOP_V = 18;
const HOP_BOOST = 1.4;         // inişte verilen kısa hız
const GRAVITY = 30;

// Soru kapısının sesi kapıdan kaç birim önce çalsın. Kart hızlı (27 b/sn):
// 260 birim ≈ 9-10 sn. Çocuk dinleyip düşünüp şeridine yerleşebilsin.
const PROMPT_LEAD = 260;
// Bir kapı cevaplandıktan sonra SIRADAKİ sorunun çalması için beklenen
// en az süre (sn). Pistler halka olduğu için kapı aralığı PROMPT_LEAD'e
// yakın çıkabiliyor (Çöl Virajı 242 < 260, Yıldız Vadisi 280): sonraki
// sorunun sesi, geçilen kapının "doğru/yanlış" melodisinin ÜSTÜNE binip
// duyulmuyordu — çocuk için soru hiç sorulmamış oluyordu ("2. harfte ses
// gelmedi, sadece şıklar vardı"). Geri bildirim melodisi en fazla ~0.65 sn.
const PROMPT_GAP = 1.6;
// Kapının ÖNÜNDE engelsiz pay geniş, arkasında dar (Partisi'yle aynı gerekçe).
const GATE_CLEAR_BEFORE = 120;
const GATE_CLEAR_AFTER = 30;

const BOT_NAMES = ["Zeynep", "Yusuf", "Ayşe", "Ömer", "Elif"];
const BOT_COLORS = [0xf59e0b, 0xef4444, 0x8b5cf6, 0x06b6d4, 0xec4899];
const PLAYER_COLOR = 0x22c55e;

// ---- özel güçler ----
// Aynı anda TEK güç taşınır ve hangisinin geleceği RASTGELEDİR (Partisi'yle
// aynı kural — sürpriz, her tur farklı). Işıkla anlatılır.
type PowerKind = "turbo" | "star" | "banana" | "feather";
const POWERS: Record<PowerKind, { emoji: string; label: string; got: string; hex: number }> = {
  turbo:   { emoji: "🍄", label: "Turbo",  got: "🍄 TURBO kazandın!",  hex: 0xff7a18 },
  star:    { emoji: "⭐", label: "Yıldız", got: "⭐ YILDIZ kazandın!", hex: 0xfacc15 },
  banana:  { emoji: "🍌", label: "Muz",    got: "🍌 MUZ kazandın!",    hex: 0xfde047 },
  feather: { emoji: "🪶", label: "Tüy",    got: "🪶 TÜY kazandın!",    hex: 0x38bdf8 },
};
const POWER_KINDS: PowerKind[] = ["turbo", "star", "banana", "feather"];
const randomPower = (): PowerKind => POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)];

// ================= pistler =================
// Kontrol noktaları XZ düzleminde; y ile hafif tepe/iniş verilebilir.
// Eğri KAPALI (son nokta ilkine bağlanır) — tur atmak için şart.
interface TrackDef {
  name: string;
  roadHalf: number;          // yol yarı genişliği
  gates: number;             // tur başına soru kapısı
  bananas: number;           // piste serpilen sabit muz sayısı
  pads: number;              // hız rampası sayısı
  botSkill: [number, number];
  sky: [number, number];     // gökyüzü gradyanı (üst, alt)
  grass: number;             // pist dışı zemin rengi
  road: number;
  pts: [number, number, number][];
}

const TRACKS: TrackDef[] = [
  {
    name: "Bahçe Turu", roadHalf: 11, gates: 2, bananas: 6, pads: 3,
    botSkill: [0.35, 0.6], sky: [0x7ec8ff, 0xdff1ff], grass: 0x86d97a, road: 0x9aa3ad,
    pts: [
      [0, 0, 0], [90, 0, -40], [160, 0, -140], [140, 0, -260], [40, 0, -320],
      [-80, 0, -300], [-160, 0, -210], [-170, 0, -90], [-100, 0, -10],
    ],
  },
  {
    name: "Çöl Virajı", roadHalf: 10, gates: 3, bananas: 9, pads: 4,
    botSkill: [0.45, 0.7], sky: [0xffc46b, 0xffe9c2], grass: 0xe0b876, road: 0xb9a68c,
    pts: [
      [0, 0, 0], [110, 0, -30], [170, 0, -120], [120, 0, -200], [30, 0, -190],
      [-40, 0, -250], [-140, 0, -280], [-200, 0, -190], [-160, 0, -70], [-70, 0, -20],
    ],
  },
  {
    name: "Yıldız Vadisi", roadHalf: 9, gates: 3, bananas: 12, pads: 5,
    botSkill: [0.55, 0.8], sky: [0x2b2f6e, 0x6f5bd0], grass: 0x3f4a7a, road: 0x6b6f86,
    pts: [
      [0, 0, 0], [80, 4, -60], [180, 8, -110], [200, 2, -220], [110, 0, -290],
      [10, 6, -270], [-60, 10, -330], [-170, 4, -300], [-220, 0, -180],
      [-150, 0, -60], [-60, 0, -20],
    ],
  },
];
const TRACK_COUNT = TRACKS.length;

const PROGRESS_KEY = "elifba-kart-progress-v1";
function getUnlockedTrack(): number {
  if (isTestUnlockActive()) return TRACK_COUNT;
  try {
    const n = parseInt(localStorage.getItem(PROGRESS_KEY) || "1", 10);
    return Math.min(TRACK_COUNT, Math.max(1, isNaN(n) ? 1 : n));
  } catch { return 1; }
}
function unlockTrack(n: number) {
  try {
    if (n > getUnlockedTrack()) localStorage.setItem(PROGRESS_KEY, String(Math.min(TRACK_COUNT, n)));
  } catch { /* ignore */ }
}

// ================= tipler =================
type Phase = "tracks" | "race" | "finish";

interface Gate {
  s: number;
  // Soru kapı SIRASI GELİNCE dağıtılır (armGate) — yarış başında hepsine
  // birden dağıtılırsa SRS güncellenmediği için hepsi aynı harfi alıyor.
  target: ContentItem | null;
  options: ContentItem[];
  tries: number;            // soruyu sesli sorma denemesi (en fazla 2)
  done: boolean;
  said: number;
  botDone: Set<number>;
  panels: THREE.Mesh[];
  /** "Tabela" modunda kapının üstünde asılı duran GLİF panosu. */
  topPanel: THREE.Mesh | null;
  /** Hangi şıkkın hangi ŞERİTTE durduğu. 3 şıkta [0,1,2]; 2 şıkta [0,2]. */
  optionLanes: number[];
  group: THREE.Group;
  /** Bu kapı hangi modda kuruldu — yarış ortasında mod değişse bile sabit. */
  mode: AskMode;
}

interface Banana {
  s: number;
  u: number;
  mesh: THREE.Object3D;
  alive: boolean;
}

interface Racer {
  id: number;
  name: string;
  isPlayer: boolean;
  s: number;              // pist boyunca mesafe (tur içinde)
  u: number;              // yanal sapma
  y: number;              // zıplama yüksekliği
  vy: number;
  v: number;              // ileri hız
  lap: number;
  turboT: number;
  starT: number;
  mudT: number;
  spinT: number;          // savrulma (muz)
  glowT: number;
  drift: number;          // -1..1 yanal kayma (gövde eğimi + kıvılcım)
  skill: number;          // bot: ideal çizgide kalma
  targetU: number;
  homeU: number;
  gateChoice: number | null;
  finished: number | null;
  group: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Object3D[];
  bodyMat: THREE.MeshStandardMaterial;
  aura: THREE.Mesh | null;
}

const KartGame = () => {
  const navigate = useNavigate();
  useLockBodyScroll();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>("tracks");
  const [track, setTrack] = useState(1);
  const [unlocked, setUnlocked] = useState(() => getUnlockedTrack());
  const [hud, setHud] = useState({ place: 1, lap: 1, pct: 0, kmh: 0, correct: 0, wrong: 0 });
  const [power, setPower] = useState<PowerKind | null>(null);
  const [activePower, setActivePower] = useState<PowerKind | null>(null);
  const [prompt, setPrompt] = useState<ContentItem | null>(null);
  // "Şimşek" modu: glif ekranda yarı saydam parlar, FLASH_MS sonra söner.
  // (Ad `flash` DEĞİL — o zaten oyunun bildirim şeridinde kullanılıyor.)
  const [glifFlash, setGlifFlash] = useState<ContentItem | null>(null);
  // Arayüz katmanının okuduğu mod. Sahne içindeki `askMode` yarış başında
  // dondurulur; bu ref onunla aynı değeri taşır.
  const askModeRef = useRef<AskMode>(getAskMode());
  const [flash, setFlash] = useState<{ k: number; text: string; good: boolean } | null>(null);
  const [result, setResult] = useState<{ place: number; correct: number; wrong: number } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const teaseRef = useRef(gardenTease());

  useRemedyOnGameOver(phase === "finish");

  const racersRef = useRef<Racer[]>([]);
  const gatesRef = useRef<Gate[]>([]);
  const bananasRef = useRef<Banana[]>([]);
  const ctrlRef = useRef({
    dir: 0 as -1 | 0 | 1,
    dragU: null as number | null,
    usePower: false,
    running: false,
  });
  const powerRef = useRef<PowerKind | null>(null);
  const statsRef = useRef({ correct: 0, wrong: 0 });
  const flashK = useRef(0);
  const promptIdRef = useRef<string | null>(null);
  const [raceKey, setRaceKey] = useState(0);

  const showFlash = useCallback((text: string, good: boolean) => {
    flashK.current += 1;
    setFlash({ k: flashK.current, text, good });
    setTimeout(() => setFlash(null), 1200);
  }, []);

  const start = useCallback((t: number) => {
    setTrack(t);
    setRaceKey((k) => k + 1);
    setResult(null);
    setPrompt(null);
    promptIdRef.current = null;
    powerRef.current = null;
    setPower(null);
    setActivePower(null);
    setHud({ place: 1, lap: 1, pct: 0, kmh: 0, correct: 0, wrong: 0 });
    setPhase("race");
    wrapRef.current?.requestFullscreen?.().catch(() => { /* izin yoksa sorun değil */ });
  }, []);

  // ================= sahne + oyun döngüsü =================
  useEffect(() => {
    if (phase !== "race") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const def = TRACKS[Math.min(TRACKS.length, Math.max(1, track)) - 1];
    const ROAD_HALF = def.roadHalf;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    // Sabit oran yerine UYARLANIR çözünürlük (bkz. _perf.ts): cihaz
    // kasıyorsa piksel sayısı düşer, rahatsa geri yükselir. Capacitor
    // WebView'de en büyük kazanç burada.
    const adaptiveRes = createAdaptiveResolution(
      renderer,
      () => ({ w: wrap.clientWidth || window.innerWidth, h: wrap.clientHeight || window.innerHeight }),
    );
    // Görüntü kalitesi: filmik ton eşleme + sRGB çıkış + yumuşak gölge.
    // Bunlar olmadan PBR malzemeler "yıkanmış" ve plastik görünüyor.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const skyTop = new THREE.Color(def.sky[0]);
    const skyBot = new THREE.Color(def.sky[1]);
    scene.background = skyBot.clone();
    scene.fog = new THREE.Fog(skyBot.getHex(), 220, 620);

    const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1400);

    const disposables: { dispose(): void }[] = [];
    const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => {
      disposables.push(x);
      return x;
    };

    // ---------- ışık ----------
    scene.add(new THREE.HemisphereLight(skyTop.getHex(), def.grass, 0.85));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
    sun.position.set(120, 190, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // Gölge kamerası pistin tamamını kapsayamaz (çözünürlük erir); aracın
    // çevresinde gezdirilir, her karede hedefe kaydırılır.
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 420;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    sc.updateProjectionMatrix();
    scene.add(sun);
    scene.add(sun.target);

    // ---------- gökyüzü kubbesi (gradyan) ----------
    const skyGeo = keep(new THREE.SphereGeometry(900, 24, 16));
    const skyMat = keep(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: skyTop }, bottom: { value: skyBot } },
      vertexShader: `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying float vY;
        void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(vY*1.25+0.15,0.0,1.0)), 1.0); }`,
    }));
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // ---------- pist eğrisi + lookup ----------
    const curve = new THREE.CatmullRomCurve3(
      def.pts.map(([x, y, z]) => new THREE.Vector3(x * TRACK_SCALE, y * TRACK_SCALE, z * TRACK_SCALE)),
      true, "catmullrom", 0.5,
    );
    // Pist uzadı → aynı örnek sayısında segmentler uzar ve virajlar köşeli
    // görünür. Örnek sayısı da orantılı artar; yol TEK mesh olduğu için
    // maliyeti yalnız üçgen sayısı, çizim çağrısı değil.
    const SAMPLES = 1200;
    // getSpacedPoints EŞİT ARALIKLI örnek verir → s (mesafe) doğrudan indekse
    // çevrilebilir. getPoint (parametrik) kullanılsaydı virajlarda örnekler
    // sıkışıp araç hızı dalgalanırdı.
    const pts = curve.getSpacedPoints(SAMPLES);
    const TRACK_LEN = curve.getLength();
    const SEG = TRACK_LEN / SAMPLES;

    const tangents: THREE.Vector3[] = [];
    const normals: THREE.Vector3[] = [];
    const UP = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < SAMPLES; i++) {
      const a = pts[i], b = pts[(i + 1) % SAMPLES];
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      tangents.push(t);
      normals.push(new THREE.Vector3().crossVectors(UP, t).normalize());
    }
    /** Eğrilik: yanal ivme limitini (viraj hızı) belirler. */
    const curvature: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t0 = tangents[i], t1 = tangents[(i + 8) % SAMPLES];
      curvature.push(t0.angleTo(t1) / (SEG * 8));
    }

    const wrapS = (s: number) => ((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
    const idxOf = (s: number) => Math.floor(wrapS(s) / SEG) % SAMPLES;

    // ---------- soru kapılarının YERİ (eğriliğe göre) ----------
    // ⚠️ Kapılar pist boyunca EŞİT bölünürse VİRAJ ÇIKIŞINA denk gelebiliyor:
    // çocuk virajı alıyor, şıkları ancak ~1 sn kala görüyor — cevap verecek
    // vakit kalmıyor. Ölçüm (Yıldız Vadisi 2. kapı, eşit bölmeyle s=420):
    // yaklaşımın son 70 biriminde κ=0.019, pistin en sert virajının %45'i.
    // Bu yüzden kapılar eşit noktadan en fazla ±%15 kayarak, YAKLAŞIMI EN DÜZ
    // olan yerlere BİRLİKTE yerleştirilir. Kısıt: kapı aralığı eşit aralığın
    // %75'inin altına inemez (soru sesi için nefes payı korunsun, bkz.
    // PROMPT_GAP). Ortak arama şart — kapılar tek tek en düze kaçınca
    // aralıklar bozuluyordu (bir ölçümde 100 birime kadar düşmüştü).
    /** Kapıya YAKLAŞIRKEN yolun ne kadar büküldüğü = görüş mesafesi ölçüsü. */
    const approachCurv = (s: number) => {
      let t = 0, n = 0;
      for (let d = 0; d < 70; d += SEG) { t += curvature[idxOf(s - d)]; n++; }
      return t / n;
    };
    const gateSs: number[] = (() => {
      const g = def.gates;
      const even = TRACK_LEN / g;
      const minGap = even * 0.78;
      const win = TRACK_LEN * 0.15;
      const step = SEG * 8;
      const cands: Array<Array<{ s: number; k: number }>> = [];
      for (let i = 0; i < g; i++) {
        const ideal = TRACK_LEN * ((i + 0.5) / g);
        const c: Array<{ s: number; k: number }> = [];
        for (let d = -win; d <= win; d += step) {
          const s = wrapS(ideal + d);
          // Başlangıç çizgisinin ilk 110 birimi boş kalsın: geri sayım biter
          // bitmez kapı gelirse çocuk daha araca alışmadan cevap veriyor.
          if (s < 110) continue;
          c.push({ s, k: approachCurv(s) });
        }
        if (c.length === 0) c.push({ s: wrapS(ideal), k: approachCurv(ideal) });
        cands.push(c);
      }
      let best: { tot: number; ss: number[] } | null = null;
      const pick: Array<{ s: number; k: number }> = [];
      const walk = (i: number) => {
        if (i === g) {
          // ⚠️ Aralık kontrolü SIRALI dizide yapılmalı. Arama penceresi
          // sarmalanınca (ideal ± pencere, 0'ın altına inince) kapılar
          // sırasını değiştirebiliyor; sıralamadan bakılınca iki kapı 4
          // birim aralığa düştüğü hâlde kontrol "geçti" diyordu.
          const ss = pick.map((x) => x.s).sort((a, b) => a - b);
          for (let j = 0; j < ss.length; j++) {
            if (wrapS(ss[(j + 1) % ss.length] - ss[j]) < minGap) return;
          }
          const tot = pick.reduce((a, x) => a + x.k, 0);
          if (!best || tot < best.tot) best = { tot, ss };
          return;
        }
        for (const c of cands[i]) { pick.push(c); walk(i + 1); pick.pop(); }
      };
      walk(0);
      const secilen = best?.ss ?? cands.map((_, i) => TRACK_LEN * ((i + 0.5) / g));
      return secilen.map((s) => Math.round(s));
    })();
    /** Kapıya YAKLAŞIM koridoru — dekor buraya konmaz (görüşü kapatmasın). */
    const inGateSight = (s: number) =>
      gateSs.some((gs) => { const d = wrapS(gs - s); return d >= 0 && d < 100; });

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    /**
     * Mantıksal (s,u) → dünya konumu.
     *
     * ⚠️ u'nun İŞARETİ: `normals` = UP × teğet, ama ileri bakan bir sürücünün
     * SAĞI = teğet × UP = −normal'dir. u'yu doğrudan normal'e eklemek
     * "u pozitif = SOL" anlamına geliyordu; sonuç: parmağı sağa kaydırınca
     * araç sola gidiyor, kapı şıkları ters sırada diziliyordu. Bu yüzden
     * u burada NEGATİF işaretle uygulanır — böylece u pozitif = sağ.
     * (Yol/kerb/çim şeritleri simetrik üretildiği için etkilenmez.)
     */
    const worldAt = (s: number, u: number, out: THREE.Vector3) => {
      const w = wrapS(s);
      const f = w / SEG;
      const i = Math.floor(f) % SAMPLES;
      const j = (i + 1) % SAMPLES;
      const k = f - Math.floor(f);
      out.copy(pts[i]).lerp(pts[j], k);
      tmpA.copy(normals[i]).lerp(normals[j], k).normalize();
      out.addScaledVector(tmpA, -u);
      return out;
    };

    // ---------- yol geometrisi ----------
    // Eğri boyunca şerit: her örnekte sol/sağ kenar → iki üçgen. Kenarlarda
    // ayrıca "kırmızı-beyaz kerb" ve dış çim yakası.
    const buildRibbon = (halfIn: number, halfOut: number, y: number) => {
      // ⚠️ Kenarlar her zaman KÜÇÜKTEN BÜYÜĞE sıralanır. Aksi hâlde (örneğin
      // sol taraf için −11 → −12.6 verilince) üçgen sarımı ters dönüyor,
      // yüzey normali aşağı bakıyor ve şerit görünmez oluyordu: kenar çizgisi
      // ile kerb yalnız bir tarafta çıkıyordu.
      const lo = Math.min(halfIn, halfOut);
      const hi = Math.max(halfIn, halfOut);
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const m = i % SAMPLES;
        const p = pts[m], n = normals[m];
        pos.push(p.x + n.x * lo, p.y + y, p.z + n.z * lo);
        pos.push(p.x + n.x * hi, p.y + y, p.z + n.z * hi);
        const v = (i * SEG) / 12;
        uv.push(0, v, 1, v);
      }
      for (let i = 0; i < SAMPLES; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return keep(g);
    };

    // asfalt (orta çizgi dokusuyla)
    const roadCv = document.createElement("canvas");
    roadCv.width = 64; roadCv.height = 64;
    {
      const g = roadCv.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = "rgba(0,0,0,0.10)";
      g.fillRect(30, 0, 4, 34);           // kesikli orta çizgi
    }
    const roadTex = keep(new THREE.CanvasTexture(roadCv));
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.colorSpace = THREE.SRGBColorSpace;
    const road = new THREE.Mesh(
      buildRibbon(-ROAD_HALF, ROAD_HALF, 0.02),
      keep(new THREE.MeshStandardMaterial({ color: def.road, map: roadTex, roughness: 0.85, metalness: 0.04 })),
    );
    road.receiveShadow = true;
    scene.add(road);

    // Yol kenar ÇİZGİSİ — asfaltın iki yanında düz beyaz şerit. Yol ile
    // dışını (kerb/çim/toprak) ayıran net bir kenar olmadan pistin sınırı
    // hız yaparken okunmuyordu; gerçek yollarda da bu çizgi vardır.
    const edgeMat = keep(new THREE.MeshStandardMaterial({
      color: 0xfdfdfd, roughness: 0.55, emissive: 0x2a2a2a,
    }));
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(
        buildRibbon(s * (ROAD_HALF - 0.75), s * (ROAD_HALF - 0.15), 0.045),
        edgeMat,
      );
      e.receiveShadow = true;
      scene.add(e);
    }

    // kerb (kırmızı-beyaz) — virajı okumayı kolaylaştırır
    const kerbCv = document.createElement("canvas");
    kerbCv.width = 8; kerbCv.height = 8;
    {
      const g = kerbCv.getContext("2d")!;
      g.fillStyle = "#e5e7eb"; g.fillRect(0, 0, 8, 8);
      g.fillStyle = "#ef4444"; g.fillRect(0, 0, 8, 4);
    }
    const kerbTex = keep(new THREE.CanvasTexture(kerbCv));
    kerbTex.wrapS = kerbTex.wrapT = THREE.RepeatWrapping;
    kerbTex.repeat.set(1, 40);
    kerbTex.colorSpace = THREE.SRGBColorSpace;
    const kerbMat = keep(new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.7 }));
    for (const s of [-1, 1]) {
      const k = new THREE.Mesh(buildRibbon(s * ROAD_HALF, s * (ROAD_HALF + 1.6), 0.05), kerbMat);
      k.receiveShadow = true;
      scene.add(k);
    }
    // çim yakası (pist dışı — buraya çıkmak yavaşlatır)
    const grassMat = keep(new THREE.MeshStandardMaterial({ color: def.grass, roughness: 1 }));
    for (const s of [-1, 1]) {
      const gm = new THREE.Mesh(buildRibbon(s * (ROAD_HALF + 1.6), s * (ROAD_HALF + 34), -0.05), grassMat);
      gm.receiveShadow = true;
      scene.add(gm);
    }
    // uzak zemin
    const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(2400, 2400)), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    scene.add(ground);

    // ---------- dekor: ağaç/kaya + tribün + bulut ----------
    const treeTrunk = keep(new THREE.CylinderGeometry(0.5, 0.7, 4, 7));
    const treeTop = keep(new THREE.ConeGeometry(3.2, 7, 9));
    const trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }));
    const leafMat = keep(new THREE.MeshStandardMaterial({ color: 0x2f9e52, roughness: 0.85 }));
    const rockMat = keep(new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.95 }));
    const rockGeo = keep(new THREE.DodecahedronGeometry(2.4, 0));
    const decoPos = new THREE.Vector3();
    for (let i = 0; i < SAMPLES; i += 11) {
      // ⚠️ Kapıya YAKLAŞIRKEN ağaç/kaya konmaz: 15-31 birim yanda duran ~10
      // birim boyundaki ağaç, virajın içinde kalınca kapıyı tam olarak
      // gizliyordu ("viraja girmeden bir yer var, orada da ağaç var, o yüzden
      // yine görülmüyor"). Koridor 100 birim — kapının kendisi ve sonrası
      // dekorlu kalır, yalnız görüş hattı temizlenir.
      if (inGateSight(i * SEG)) continue;
      for (const side of [-1, 1]) {
        if ((i / 11 + (side > 0 ? 1 : 0)) % 3 === 0) continue;
        const off = (ROAD_HALF + 6) + ((i * 7) % 16);
        worldAt(i * SEG, side * off, decoPos);
        if ((i / 11) % 4 === 3) {
          const r = new THREE.Mesh(rockGeo, rockMat);
          r.position.copy(decoPos);
          r.position.y += 0.8;
          r.scale.setScalar(0.6 + ((i * 13) % 7) / 10);
          r.castShadow = true;
          scene.add(r);
        } else {
          const t = new THREE.Group();
          const tr = new THREE.Mesh(treeTrunk, trunkMat);
          tr.position.y = 2;
          const tp = new THREE.Mesh(treeTop, leafMat);
          tp.position.y = 6.4;
          tp.castShadow = true;
          t.add(tr, tp);
          t.position.copy(decoPos);
          t.scale.setScalar(0.85 + ((i * 17) % 9) / 12);
          scene.add(t);
        }
      }
    }
    // bulutlar
    const cloudMat = keep(new THREE.SpriteMaterial({
      map: keep(emojiTexture("☁️", 256)), transparent: true, opacity: 0.95, depthWrite: false,
    }));
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Sprite(cloudMat);
      const a = (i / 16) * Math.PI * 2;
      c.position.set(Math.cos(a) * (300 + (i % 4) * 90), 90 + (i % 5) * 26, Math.sin(a) * (300 + (i % 3) * 110) - 150);
      c.scale.setScalar(60 + (i % 4) * 22);
      scene.add(c);
    }

    // Yol düzlemine yatık bir nesneyi yerleştirmenin GÜVENLİ yolu: bir grup
    // kur, grubu lookAt ile teğete çevir, düzlemi grubun İÇİNDE yatır.
    // rotation.x ve rotation.z'yi aynı nesnede birlikte vermek Euler sırası
    // yüzünden beklenmeyen eğrilik üretiyor.
    // Grubun +Z'si ileri (Object3D.lookAt +Z'yi hedefe çevirir). Düzlem
    // rotation.x = −90° ile yere yatar; bu dönüş düzlemin +Y'sini grubun
    // −Z'sine (GERİYE) taşır, bu yüzden dokunun "yukarısı" geriyi gösterirdi.
    // rotation.z = 180° düzlemi kendi içinde çevirip dokuyu ileri döndürür
    // (yüzey normali yine yukarı kaldığı için görünürlük bozulmaz).
    const flatOnTrack = (s: number, u: number, mesh: THREE.Object3D, lift = 0.1) => {
      const g = new THREE.Group();
      g.position.copy(worldAt(s, u, new THREE.Vector3()));
      g.position.y += lift;
      const ahead = worldAt(s + 10, u, new THREE.Vector3());
      g.lookAt(ahead.x, g.position.y, ahead.z);
      mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
      g.add(mesh);
      scene.add(g);
      return g;
    };

    // ---------- başlangıç/bitiş çizgisi ----------
    const gridCv = document.createElement("canvas");
    gridCv.width = 128; gridCv.height = 16;
    {
      const g = gridCv.getContext("2d")!;
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? "#111827" : "#ffffff";
        g.fillRect(i * 8, 0, 8, 8);
        g.fillStyle = i % 2 ? "#ffffff" : "#111827";
        g.fillRect(i * 8, 8, 8, 8);
      }
    }
    flatOnTrack(0, 0, new THREE.Mesh(
      keep(new THREE.PlaneGeometry(ROAD_HALF * 2, 5)),
      keep(new THREE.MeshBasicMaterial({ map: keep(new THREE.CanvasTexture(gridCv)) })),
    ), 0.12);
    {
      const p = worldAt(0, 0, new THREE.Vector3());
      const flagSprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({
        map: keep(emojiTexture("🏁", 256)), transparent: true, depthWrite: false,
      })));
      flagSprite.position.set(p.x, p.y + 19, p.z);
      flagSprite.scale.setScalar(5);
      scene.add(flagSprite);
    }

    // ---------- soru kapıları ----------
    // ⚠️ Mod YARIŞ BAŞINDA bir kez okunur. Ortada değişirse kurulmuş kapıların
    // geometrisi (üst tabela var/yok) uymaz — bir sonraki yarışta geçerli olur.
    const askMode = getAskMode();
    askModeRef.current = askMode;
    const pool = gamePool();
    const gates: Gate[] = [];
    // gateSs yukarıda, eğrilik profiline göre hesaplandı (viraj çıkışı yok).
    const panelGeo = keep(new THREE.PlaneGeometry(ROAD_HALF * 0.62, ROAD_HALF * 0.62));
    const postGeo = keep(new THREE.BoxGeometry(0.55, 8, 0.55));
    const frameMat = keep(new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.6, metalness: 0.25 }));
    const laneU = (i: number) => -ROAD_HALF + (i + 0.5) * (ROAD_HALF * 2 / 3);
    const laneOf = (u: number) => Math.max(0, Math.min(2, Math.floor(((u + ROAD_HALF) / (ROAD_HALF * 2)) * 3)));

    // Kapının SORUSU burada seçilmez — bkz. armGate. Yarış başında bütün
    // kapılara birden soru dağıtılırsa SRS durumu hiç değişmediği için
    // pickNextGameItem her seferinde AYNI harfi (müfredatın ilk görülmemiş
    // harfi = Elif) döndürüyordu; çocuk bütün yarış boyunca tek harf görüyordu.
    for (const gs of gateSs) {
      if (pool.length < 3) break;
      const g = new THREE.Group();
      const c = worldAt(gs, 0, new THREE.Vector3());
      g.position.copy(c);
      // lookAt GERİYE (aracın geldiği yön): Object3D.lookAt yerel +Z'yi
      // hedefe çevirdiğinden, böylece panonun ön yüzü (+Z normali) çocuğa
      // bakar — ileriye baktırılınca harfler AYNALANIYOR ve şeritler ters
      // sıralanıyordu. Bu dönüşle yerel +X = −normal = sürücünün sağı,
      // yani pano yanal konumu doğrudan laneU(i).
      const behind = worldAt(gs - 10, 0, new THREE.Vector3());
      g.lookAt(behind.x, c.y, behind.z);
      const panels: THREE.Mesh[] = [];
      // üst kiriş
      const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(ROAD_HALF * 2 + 2, 0.7, 0.7)), frameMat);
      beam.position.y = 8;
      g.add(beam);
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(postGeo, frameMat);
        p.position.set(-ROAD_HALF + (i / 3) * ROAD_HALF * 2, 4, 0);
        p.castShadow = true;
        g.add(p);
      }
      for (let i = 0; i < 3; i++) {
        const mat = keep(new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide }));
        const p = new THREE.Mesh(panelGeo, mat);
        // Grup lookAt(ileri) ile döndüğü için yerel +X = −normal = sürücünün
        // SAĞI; u da artık sağ yönünde ölçüldüğünden yerel x doğrudan laneU(i).
        p.position.set(laneU(i), 4.2, 0);
        g.add(p);
        panels.push(p);
      }
      // "Tabela" modunda glif kapının ÜSTÜNDE asılı durur (kiriş üstü) —
      // şıklar aşağıda yazılı adlardır. Diğer modlarda hiç oluşturulmaz.
      let topPanel: THREE.Mesh | null = null;
      if (askMode === "ustte") {
        const tm = keep(new THREE.MeshBasicMaterial({ map: null, side: THREE.DoubleSide, transparent: true }));
        topPanel = new THREE.Mesh(keep(new THREE.PlaneGeometry(ROAD_HALF * 0.8, ROAD_HALF * 0.8)), tm);
        topPanel.position.set(0, 11.5, 0);
        g.add(topPanel);
      }
      g.visible = false;   // sorusu dağıtılana kadar boş pano gösterme
      scene.add(g);
      gates.push({
        s: gs, target: null, options: [], tries: 0, done: false, said: 0,
        botDone: new Set(), panels, topPanel, group: g,
        mode: askMode, optionLanes: [0, 1, 2],
      });
    }
    gatesRef.current = gates;
    // Son kapının cevaplandığı an (sn) — sıradaki sorunun sesi bunun üstüne
    // binmesin diye PROMPT_GAP kadar beklenir.
    let lastGateT = -99;

    // Kapıya SIRASI GELİNCE soru dağıt. Bir önceki kapı cevaplanıp
    // recordGameAnswer çalıştıktan sonra çağrıldığı için SRS durumu güncel:
    // seviye/aciliyet/karışıklık ısısı hesaba katılır ve harf gerçekten değişir.
    const armGate = (g: Gate) => {
      const target = pickNextGameItem(pool) || pool[0];
      // YENİ MODLAR: şıklar harfin YAZILI ADI, soru glifin kendisi.
      // Adı olmayan öğede (translit boş) ya da yeterli benzer ad bulunamazsa
      // o kapı sessizce KLASİĞE düşer — oyun kilitlenmesin.
      const yeniMod = g.mode !== "klasik" && okunurAd(target) !== null;
      const sikSayisi = g.mode === "flash" ? FLASH_SIK : USTTE_SIK;
      const wrongs = yeniMod
        ? pickNameWrongs(pool, target, sikSayisi - 1)
        : pickWrongs(pool, target, 2);
      const yeterli = yeniMod ? wrongs.length >= sikSayisi - 1 : wrongs.length >= 2;
      if (!yeterli) {
        if (!yeniMod) { g.done = true; return; }
        // yeni modda çeldirici bulunamadı → klasiğe düş
        const kw = pickWrongs(pool, target, 2);
        if (kw.length < 2) { g.done = true; return; }
        g.mode = "klasik";
        g.options = shuffle([target, ...kw]);
      } else {
        g.options = shuffle([target, ...wrongs]);
      }
      g.target = target;
      g.tries = 0;
      // 2 şıkta ORTA şerit boş kalır: şıklar dışa (0 ve 2) yerleşir, çocuk
      // sağa mı sola mı gittiğine karar verir. 3 şıkta her şerit dolu.
      g.optionLanes = g.options.length === 2 ? [0, 2] : [0, 1, 2];
      // Kaydı ŞİMDİDEN yükle: soru PROMPT_GAP kadar sonra çalacak, o arada
      // dosya inmiş olsun. Yavaş bağlantıda ilk kez duyulan bir harfin mp3'ü
      // yüklenirken çocuk kapıyı geçebiliyordu.
      preloadItems([target]);
      // Önce bütün panoları gizle (2 şıkta orta pano boş kalacak).
      g.panels.forEach((p) => { p.visible = false; });
      g.options.forEach((opt, k) => {
        const p = g.panels[g.optionLanes[k]];
        const m = p.material as THREE.MeshBasicMaterial;
        m.map = g.mode === "klasik"
          ? keep(letterTexture(opt.emoji ?? "؟"))
          : keep(wordTexture(okunurAd(opt) ?? "?"));
        m.color.set(0xffffff);
        m.needsUpdate = true;
        p.visible = true;
      });
      if (g.topPanel) {
        const tm = g.topPanel.material as THREE.MeshBasicMaterial;
        tm.map = keep(letterTexture(target.emoji ?? "؟"));
        tm.needsUpdate = true;
        g.topPanel.visible = g.mode === "ustte";
      }
    };

    const nearGate = (s: number) =>
      gateSs.some((gs) => {
        const d = wrapS(gs - s);
        return d < GATE_CLEAR_BEFORE || TRACK_LEN - d < GATE_CLEAR_AFTER;
      });

    // ---------- hız rampaları ----------
    // Hız rampası: üstünde İLERİ bakan oklar. Düz mavi bir dikdörtgen
    // hızlandırdığını anlatmıyordu; akan ok deseni "buraya bas, fırla" der.
    const padCv = document.createElement("canvas");
    padCv.width = 64; padCv.height = 64;
    {
      const g = padCv.getContext("2d")!;
      g.fillStyle = "#0284c7";
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 13;
      g.lineCap = "round";
      g.lineJoin = "round";
      // Doku "yukarısı" (+v) ileri yöne bakar → oklar ileriyi gösterir.
      // İki İRİ ok: uzaktan ve eğik açıdan bakınca sık/ince oklar düz çizgiye
      // dönüşüp "ok" olarak okunmuyordu.
      for (const cy of [17, 47]) {
        g.beginPath();
        g.moveTo(9, cy + 13);
        g.lineTo(32, cy - 12);
        g.lineTo(55, cy + 13);
        g.stroke();
      }
    }
    const padTex = keep(new THREE.CanvasTexture(padCv));
    padTex.wrapS = padTex.wrapT = THREE.RepeatWrapping;
    padTex.repeat.set(1, 1);
    padTex.colorSpace = THREE.SRGBColorSpace;
    const padMat = keep(new THREE.MeshBasicMaterial({
      map: padTex, transparent: true, opacity: 0.95,
    }));
    // Rampanın ÜSTÜNDE havada duran ok işareti. Yerdeki desen yalnız üstüne
    // gelindiğinde okunuyor (yatık düzleme çok eğik açıdan bakılıyor); sprite
    // her zaman kameraya döndüğü için uzaktan da "burada hızlanacaksın" der.
    const padSignMat = keep(new THREE.SpriteMaterial({
      map: keep(emojiTexture("⏫", 128)), transparent: true, depthWrite: false,
    }));
    const padSigns: THREE.Sprite[] = [];
    const pads: { s: number; u: number }[] = [];
    for (let i = 0; i < def.pads; i++) {
      const s = wrapS(TRACK_LEN * ((i + 0.22) / def.pads));
      if (nearGate(s)) continue;
      const u = (i % 2 ? 1 : -1) * ROAD_HALF * 0.45;
      flatOnTrack(s, u, new THREE.Mesh(keep(new THREE.PlaneGeometry(ROAD_HALF * 0.75, 13)), padMat), 0.14);
      const sign = new THREE.Sprite(padSignMat);
      const sp = worldAt(s, u, new THREE.Vector3());
      sign.position.set(sp.x, sp.y + 3.4, sp.z);
      sign.scale.setScalar(4.2);
      scene.add(sign);
      padSigns.push(sign);
      pads.push({ s, u });
    }

    // ---------- muzlar ----------
    const bananaMat = keep(new THREE.SpriteMaterial({
      map: keep(emojiTexture("🍌", 128)), transparent: true, depthWrite: false,
    }));
    const bananas: Banana[] = [];
    const addBanana = (s: number, u: number) => {
      const sp = new THREE.Sprite(bananaMat);
      const p = worldAt(s, u, new THREE.Vector3());
      sp.position.set(p.x, p.y + 1.1, p.z);
      sp.scale.setScalar(3);
      scene.add(sp);
      bananas.push({ s: wrapS(s), u, mesh: sp, alive: true });
    };
    for (let i = 0; i < def.bananas; i++) {
      const s = wrapS(TRACK_LEN * ((i + 0.6) / def.bananas));
      if (nearGate(s)) continue;
      addBanana(s, ((i * 37) % 100 / 100 - 0.5) * ROAD_HALF * 1.5);
    }
    bananasRef.current = bananas;

    // ---------- kartlar ----------
    // Sürücü ANIMAL CROSSING oranlarında: her parça YUVARLAK (küre/kapsül/
    // torus), kafa gövdeye göre büyük, yüz ÇİZİLMİŞ ve AÇIKTA. Kapalı vizör
    // camı kullanılmıyordu — küre "kuşağı" olarak kaskın çevresini sardığı
    // için arkadan bakınca cam çocuğa dönük görünüyor, sürücü geri bakıyor
    // sanılıyordu. Açık kask hem sorunu bitirir hem sevimliliği artırır.
    const chassisGeo = keep(new THREE.BoxGeometry(2.3, 0.6, 3.6));
    const noseGeo = keep(new THREE.CapsuleGeometry(0.62, 1.5, 5, 12));
    const seatGeo = keep(new THREE.SphereGeometry(0.62, 16, 12));
    const spoilerGeo = keep(new THREE.BoxGeometry(2.2, 0.16, 0.7));
    const spoilerLegGeo = keep(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8));
    const wheelGeo = keep(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 16));
    const rimGeo = keep(new THREE.CylinderGeometry(0.3, 0.3, 0.58, 12));
    const auraGeo = keep(new THREE.SphereGeometry(2.6, 18, 14));
    // sürücü parçaları
    const dTorsoGeo = keep(new THREE.SphereGeometry(0.46, 18, 14));
    const dHeadGeo = keep(new THREE.SphereGeometry(0.48, 20, 16));
    const dFaceGeo = keep(new THREE.PlaneGeometry(0.76, 0.76));
    const dArmGeo = keep(new THREE.CapsuleGeometry(0.11, 0.26, 4, 10));
    const dHandGeo = keep(new THREE.SphereGeometry(0.14, 12, 10));
    // kask: kafanın ÜST yarısını saran yarım küre + yuvarlak siperlik
    const dHelmetGeo = keep(new THREE.SphereGeometry(0.53, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5));
    const dBrimGeo = keep(new THREE.TorusGeometry(0.5, 0.07, 8, 20, Math.PI));
    const wheelRingGeo = keep(new THREE.TorusGeometry(0.26, 0.06, 8, 16));

    const tyreMat = keep(new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.92 }));
    const rimMat = keep(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.6 }));
    const darkMat = keep(new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.6, metalness: 0.25 }));
    const skinMat = keep(new THREE.MeshStandardMaterial({ color: 0xffdcb4, roughness: 0.85 }));
    const faceMat = keep(new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true }));

    const makeRacer = (id: number, name: string, color: number, isPlayer: boolean, homeU: number): Racer => {
      const group = new THREE.Group();
      const body = new THREE.Group();
      const bodyMat = keep(new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.35 }));

      // ⚠️ MODELİN ÖNÜ +Z'DİR. `Object3D.lookAt` kamera OLMAYAN nesnelerde
      // yerel **+Z** eksenini hedefe çevirir (kameralarda −Z). Model −Z'ye
      // bakacak şekilde kurulduğunda araç bütün yarışı geri geri gidiyordu.
      const chassis = new THREE.Mesh(chassisGeo, bodyMat);
      chassis.position.y = 0.75;
      chassis.castShadow = true;
      body.add(chassis);
      // yuvarlak burun (kapsül, yatık) — köşeli kutu yerine
      const nose = new THREE.Mesh(noseGeo, bodyMat);
      nose.rotation.x = Math.PI / 2;
      nose.scale.set(1, 1, 0.55);
      nose.position.set(0, 0.66, 1.75);
      body.add(nose);
      // Koltuk sürücünün ARKASINDA ince bir sırtlık. Küre olarak gövdenin
      // üstüne konduğunda sürücüyü tamamen yutuyordu.
      const seat = new THREE.Mesh(seatGeo, darkMat);
      seat.scale.set(0.95, 0.95, 0.42);
      seat.position.set(0, 1.32, -0.95);
      body.add(seat);
      const spoiler = new THREE.Mesh(spoilerGeo, bodyMat);
      spoiler.position.set(0, 1.55, -1.85);
      body.add(spoiler);
      for (const sx of [-0.85, 0.85]) {
        const leg = new THREE.Mesh(spoilerLegGeo, darkMat);
        leg.position.set(sx, 1.22, -1.85);
        body.add(leg);
      }
      // ---- SÜRÜCÜ (yuvarlak, sevimli; yüz ileriye = +Z bakar) ----
      const driver = new THREE.Group();
      driver.position.set(0, 1.42, -0.22);
      driver.scale.setScalar(1.12);
      // Tulum, aracın AÇIK tonu: aynı renk olunca sürücünün gövdesi kaportaya
      // karışıp görünmüyordu.
      const suitMat = keep(new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.42),
        roughness: 0.7,
      }));
      const torso = new THREE.Mesh(dTorsoGeo, suitMat);
      torso.scale.set(1, 0.9, 0.9);
      torso.castShadow = true;
      driver.add(torso);
      // kollar direksiyona uzanır + yuvarlak eller
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(dArmGeo, skinMat);
        arm.position.set(sx * 0.32, 0.06, 0.26);
        arm.rotation.x = -1.05;
        driver.add(arm);
        const hand = new THREE.Mesh(dHandGeo, skinMat);
        hand.position.set(sx * 0.3, -0.02, 0.54);
        driver.add(hand);
      }
      // direksiyon
      const wheelRing = new THREE.Mesh(wheelRingGeo, darkMat);
      wheelRing.position.set(0, 0.0, 0.56);
      wheelRing.rotation.x = 1.15;
      driver.add(wheelRing);
      // KAFA: gövdeye göre büyük (Animal Crossing oranı)
      const head = new THREE.Mesh(dHeadGeo, skinMat);
      head.position.y = 0.62;
      head.scale.set(1, 0.97, 0.95);
      head.castShadow = true;
      driver.add(head);
      // çizilmiş yüz — kafanın ön yüzünde, hafif dışında
      const face = new THREE.Mesh(dFaceGeo, faceMat);
      face.position.set(0, 0.63, 0.45);
      driver.add(face);
      // AÇIK kask: yalnız kafanın üstünü sarar, yüz görünür kalır
      const helmet = new THREE.Mesh(dHelmetGeo, bodyMat);
      helmet.position.y = 0.6;
      driver.add(helmet);
      const brim = new THREE.Mesh(dBrimGeo, bodyMat);
      brim.position.set(0, 0.62, 0.06);
      brim.rotation.set(-0.25, 0, 0);
      driver.add(brim);
      // Kamera hep ARKADAN baktığı için sevimlilik arkadan da okunmalı:
      // iki yanda yuvarlak kulaklık + kaskın tepesinde krem ponpon.
      const trimMat = keep(new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.8 }));
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(dHandGeo, trimMat);
        ear.scale.set(0.8, 1, 0.8);
        ear.position.set(sx * 0.49, 0.6, 0);
        driver.add(ear);
      }
      const pom = new THREE.Mesh(dHandGeo, trimMat);
      pom.scale.setScalar(0.85);
      pom.position.set(0, 1.12, 0);
      driver.add(pom);
      body.add(driver);

      // İlk iki eleman ÖN tekerlek (direksiyona çevrilenler) — ön artık +Z.
      const wheels: THREE.Object3D[] = [];
      for (const [wx, wz, ws] of [[-1.25, 1.25, 1], [1.25, 1.25, 1], [-1.3, -1.35, 1.14], [1.3, -1.35, 1.14]] as const) {
        const w = new THREE.Group();
        const tyre = new THREE.Mesh(wheelGeo, tyreMat);
        tyre.rotation.z = Math.PI / 2;
        tyre.scale.set(ws, 1, ws);
        tyre.castShadow = true;
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.z = Math.PI / 2;
        w.add(tyre, rim);
        w.position.set(wx, 0.62 * ws, wz);
        body.add(w);
        wheels.push(w);
      }

      group.add(body);

      const tag = new THREE.Sprite(keep(new THREE.SpriteMaterial({
        map: nameTexture(name, isPlayer ? "#065f46" : "#334155"), transparent: true,
      })));
      tag.scale.set(3.2, 0.8, 1);
      tag.position.y = isPlayer ? 5.9 : 4.2;
      tag.name = "tag";
      group.add(tag);

      let aura: THREE.Mesh | null = null;
      if (isPlayer) {
        // Oyuncuyu kalabalıkta bulmak için dönen yeşil ok
        const arrow = new THREE.Mesh(
          keep(new THREE.ConeGeometry(0.8, 1.5, 4)),
          keep(new THREE.MeshBasicMaterial({ color: 0x16a34a })),
        );
        arrow.rotation.x = Math.PI;
        arrow.position.y = 4.2;
        arrow.name = "marker";
        group.add(arrow);
        // güç aurası
        aura = new THREE.Mesh(auraGeo, keep(new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })));
        aura.position.y = 1.3;
        aura.visible = false;
        group.add(aura);
      }

      scene.add(group);
      return {
        id, name, isPlayer, s: 0, u: homeU, y: 0, vy: 0, v: 0, lap: 1,
        turboT: 0, starT: 0, mudT: 0, spinT: 0, glowT: 0, drift: 0,
        skill: isPlayer ? 1 : def.botSkill[0] + Math.random() * (def.botSkill[1] - def.botSkill[0]),
        targetU: homeU, homeU, gateChoice: null, finished: null,
        group, body, wheels, bodyMat, aura,
      };
    };

    const racers: Racer[] = [makeRacer(0, "Sen", PLAYER_COLOR, true, 0)];
    // Başlangıç ızgarası: herkes AYNI çizgide, yan yana. Botları oyuncunun
    // gerisine dizmek kamerayı (oyuncunun 13 birim arkasında) doldurup
    // oyuncuyu tamamen kapatıyordu — kamera artık kimsenin arkasında değil.
    // Orta şerit oyuncunun; botlar iki yana ve hafif öne kayar.
    const BOT_U = [-0.34, 0.34, -0.66, 0.66, -0.92].map((k) => k * ROAD_HALF);
    for (let i = 0; i < RACERS - 1; i++) {
      const r = makeRacer(i + 1, BOT_NAMES[i], BOT_COLORS[i], false, BOT_U[i]);
      r.s = wrapS(3 + 2.5 * (i % 3));
      racers.push(r);
    }
    racersRef.current = racers;
    statsRef.current = { correct: 0, wrong: 0 };

    // drift kıvılcımı (basit parçacık havuzu)
    const sparkMat = keep(new THREE.SpriteMaterial({
      map: keep(emojiTexture("✨", 64)), transparent: true, depthWrite: false, opacity: 0.9,
    }));
    const sparks: { sp: THREE.Sprite; life: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(sparkMat);
      sp.visible = false;
      sp.scale.setScalar(1.6);
      scene.add(sp);
      sparks.push({ sp, life: 0 });
    }

    // ---------- boyutlandırma ----------
    const resize = () => {
      const w = wrap.clientWidth || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // ---------- kontrol: sürükleme ----------
    // Partisi ile aynı hyper-casual kural: parmağı basılı tutup kaydır,
    // araç parmağı takip eder. "Şerit atla" swipe DEĞİL.
    let dragId: number | null = null;
    let dragPx = 0;
    let dragU0 = 0;
    let dragMoved = false;
    let dragAt = 0;
    const pxToU = () => (ROAD_HALF * 2.4) / Math.max(1, wrap.clientWidth);
    const onDown = (e: PointerEvent) => {
      if (dragId !== null) return;
      dragId = e.pointerId;
      dragPx = e.clientX;
      dragU0 = racersRef.current[0]?.u ?? 0;
      dragMoved = false;
      dragAt = performance.now();
      ctrlRef.current.dragU = dragU0;
    };
    const onMove = (e: PointerEvent) => {
      if (dragId !== e.pointerId) return;
      if (Math.abs(e.clientX - dragPx) > 8) dragMoved = true;
      const d = (e.clientX - dragPx) * pxToU();
      ctrlRef.current.dragU = Math.max(-ROAD_HALF - 4, Math.min(ROAD_HALF + 4, dragU0 + d));
    };
    const onUp = (e: PointerEvent) => {
      if (dragId !== e.pointerId) return;
      dragId = null;
      ctrlRef.current.dragU = null;
      // Kaydırmadan kısa DOKUNUŞ = özel gücü kullan. Çocuğun parmağı zaten
      // ekranın ortasında (direksiyon orada); köşedeki düğmeye uzanmak yerine
      // olduğu yere dokunabilsin.
      if (!dragMoved && performance.now() - dragAt < 260) ctrlRef.current.usePower = true;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // ---------- yardımcılar ----------
    const player = racers[0];
    const totalOf = (r: Racer) => (r.lap - 1) * TRACK_LEN + r.s;

    const spinOut = (r: Racer) => {
      if (r.spinT > 0 || r.starT > 0) return;
      r.spinT = SPIN_TIME;
      r.v *= 0.35;
      r.turboT = 0;
      if (r.isPlayer) { playSfx("stomp"); showFlash("🍌 Kaydın!", false); }
    };

    /** Viraj hız limiti: eğrilik arttıkça düşer (yanal ivme sınırı). */
    const cornerLimit = (s: number) => {
      const c = curvature[idxOf(s)];
      // a = v²·κ  →  v = √(a/κ). a ≈ 12 birim/sn² tutarsa viraj "tutar".
      return c < 1e-4 ? 999 : Math.sqrt(12 / c);
    };

    const wpos = new THREE.Vector3();
    const wnext = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();

    /**
     * Araçları (s,u)'dan dünyaya yerleştirir ve tekerlek/eğim animasyonunu
     * uygular. AYRI bir fonksiyon çünkü GERİ SAYIM sırasında da çağrılmalı:
     * yalnız step() içinde kalınca yarış başlamadan önce bütün araçlar
     * sahnenin merkezinde üst üste duruyordu.
     */
    const placeRacers = () => {
      for (const r of racers) {
        worldAt(r.s, r.u, wpos);
        r.group.position.set(wpos.x, wpos.y + r.y, wpos.z);
        worldAt(r.s + 4, r.u + r.drift * 2.2, wnext);
        r.group.lookAt(wnext.x, wnext.y + r.y, wnext.z);
        // drift eğimi + savrulma dönüşü
        r.body.rotation.z = -r.drift * 0.22;
        r.body.rotation.y = r.spinT > 0 ? (SPIN_TIME - r.spinT) * 14 : 0;
        const spin = r.v * 0.9;
        for (const w of r.wheels) w.rotation.x -= spin * 0.016;
        // ön tekerlekleri direksiyona çevir
        r.wheels[0].rotation.y = r.wheels[1].rotation.y = -r.drift * 0.4;
      }
    };
    camera.position.copy(worldAt(-12, 0, camPos)).setY(7);

    // ---------- adım ----------
    const step = (dt: number, tNow: number) => {
      for (const r of racers) {
        if (r.finished !== null) continue;

        if (r.turboT > 0) r.turboT = Math.max(0, r.turboT - dt);
        if (r.starT > 0) r.starT = Math.max(0, r.starT - dt);
        if (r.mudT > 0) r.mudT = Math.max(0, r.mudT - dt);
        if (r.spinT > 0) r.spinT = Math.max(0, r.spinT - dt);
        if (r.glowT > 0) r.glowT = Math.max(0, r.glowT - dt);

        // --- yanal yönelim ---
        const prevU = r.u;
        if (r.isPlayer) {
          if (r.spinT <= 0) {
            const du = ctrlRef.current.dragU;
            if (du !== null) {
              const d = du - r.u;
              r.u += Math.sign(d) * Math.min(Math.abs(d), STEER_RATE * 1.5 * dt);
            } else {
              r.u += ctrlRef.current.dir * STEER_RATE * dt;
            }
          }
        } else {
          // Bot: kapıda RASTGELE şerit (kullanıcı şartı — çocuk doğru cevapla
          // öne geçebilsin). Kapı dışında ideal çizgiye ve muzdan kaçmaya bakar.
          const g = gates.find((gg) => !gg.botDone.has(r.id) && wrapS(gg.s - r.s) < PROMPT_LEAD);
          if (g) {
            if (r.gateChoice !== g.s) {
              r.gateChoice = g.s;
              // Botlar da yalnız DOLU şeritleri seçer (2 şıkta orta boş).
              const secenekler = g.optionLanes.length ? g.optionLanes : [0, 1, 2];
              r.targetU = laneU(secenekler[Math.floor(Math.random() * secenekler.length)]);
            }
          } else {
            r.targetU = r.homeU * (1 - r.skill * 0.7);   // becerikli bot içeriden alır
            for (const b of bananas) {
              if (!b.alive) continue;
              const ahead = wrapS(b.s - r.s);
              if (ahead < 26 && Math.abs(b.u - r.u) < 2.4 && Math.random() < r.skill) {
                r.targetU = b.u > 0 ? b.u - 4 : b.u + 4;
                break;
              }
            }
          }
          if (r.spinT <= 0) {
            const d = r.targetU - r.u;
            r.u += Math.sign(d) * Math.min(Math.abs(d), STEER_RATE * 0.9 * dt);
          }
        }
        // Pist dışına ÇIKILABİLİR (çim yavaşlatır) ama kaybolacak kadar değil.
        r.u = Math.max(-ROAD_HALF - 4, Math.min(ROAD_HALF + 4, r.u));
        // Çimdeyken yavaşça asfalta doğru itilir. Mario Kart'taki "geri
        // döndürme"nin çocuk dostu hâli: küçük çocuk pistin dışında takılıp
        // kalmasın, ceza (yavaşlık) yeter, kilitlenmek gerekmez.
        if (Math.abs(r.u) > ROAD_HALF) {
          r.u -= Math.sign(r.u) * 3.2 * dt;
        }
        // drift: yanal hız → gövde eğimi + kıvılcım
        const lateral = (r.u - prevU) / Math.max(dt, 1e-4);
        r.drift += (Math.max(-1, Math.min(1, lateral / STEER_RATE)) - r.drift) * Math.min(1, dt * 8);

        // --- zıplama (tüy) ---
        if (r.y > 0 || r.vy > 0) {
          r.vy -= GRAVITY * dt;
          r.y += r.vy * dt;
          if (r.y <= 0) { r.y = 0; r.vy = 0; }
        }

        // --- hız ---
        const offroad = Math.abs(r.u) > ROAD_HALF + 0.4 && r.y < 0.4;
        let limit = BASE_MAX;
        if (r.turboT > 0 || r.starT > 0) limit = TURBO_MAX;
        if (offroad) limit = Math.min(limit, OFFROAD_MAX);
        if (r.mudT > 0) limit = Math.min(limit, MUD_MAX);
        if (r.spinT > 0) limit = Math.min(limit, 6);
        // Viraj limiti yalnız yerdeyken ve turbo yokken uygulanır (turbo
        // "viraj tutar" hissi verir; çocuk cezalandırılmasın).
        if (r.y < 0.3 && r.turboT <= 0 && r.starT <= 0) {
          limit = Math.min(limit, cornerLimit(r.s) * (r.isPlayer ? 1.25 : 1 + r.skill * 0.3));
        }
        if (r.v < limit) r.v = Math.min(limit, r.v + ACCEL * dt);
        else r.v = Math.max(limit, r.v - BRAKE * dt);

        const prevS = r.s;
        r.s = wrapS(r.s + r.v * dt);

        // --- tur sayacı ---
        // Çizgiyi geçmek: s sarmalandıysa (büyükten küçüğe düştüyse) tur bitti
        if (prevS > r.s + TRACK_LEN * 0.5) {
          r.lap += 1;
          if (r.lap > LAPS) {
            const done = racers.filter((x) => x.finished !== null).length;
            r.finished = done + 1;
            if (r.isPlayer) {
              ctrlRef.current.running = false;
              unlockTrack(track + 1);
              setUnlocked(getUnlockedTrack());
              setResult({ place: r.finished, correct: statsRef.current.correct, wrong: statsRef.current.wrong });
              setPhase("finish");
              playFeedback(r.finished <= 3);
            }
            continue;
          }
          // Yeni tura girince kapılar tekrar sorulur — ama AYNI harfler değil:
          // hedef sıfırlanır, armGate ikinci turda güncel SRS'e göre yeniden
          // seçer (birinci turun cevapları seviyeleri çoktan değiştirdi).
          if (r.isPlayer) {
            for (const g of gates) {
              g.done = false;
              g.said = 0;
              g.target = null;
              g.tries = 0;
              g.options = [];
              g.group.visible = false;
            }
            playSfx("dove");
            showFlash(`🏁 ${r.lap}. TUR`, true);
          } else {
            for (const g of gates) g.botDone.delete(r.id);
          }
        }

        // --- hız rampası ---
        // Sarmalı-güvenli mesafe: pist kapalı olduğu için s farkı iki yönden
        // ölçülür ve küçüğü alınır (yoksa çizgi civarında çarpışma kaçırılır).
        for (const p of pads) {
          const dd = Math.min(wrapS(r.s - p.s), wrapS(p.s - r.s));
          if (dd < 4.5 && Math.abs(r.u - p.u) < ROAD_HALF * 0.42) {
            r.turboT = Math.max(r.turboT, 1.4);
            if (r.isPlayer && r.turboT < 1.35) playSfx("coin");
          }
        }

        // --- muz ---
        for (const b of bananas) {
          if (!b.alive) continue;
          const dd = Math.min(wrapS(r.s - b.s), wrapS(b.s - r.s));
          if (dd < 2.6 && Math.abs(r.u - b.u) < 1.7 && r.y < 1.2) {
            if (r.starT > 0) continue;      // ⭐ korur
            b.alive = false;
            b.mesh.visible = false;
            spinOut(r);
          }
        }
      }

      // --- ÖZEL GÜÇ kullanımı ---
      if (ctrlRef.current.usePower) {
        ctrlRef.current.usePower = false;
        const k = powerRef.current;
        if (k && player.finished === null) {
          if (k === "feather" && player.y > 0.02) {
            // havada — boşa gitmesin
          } else {
            powerRef.current = null;
            setPower(null);
            if (k === "turbo") {
              player.turboT = TURBO_TIME;
              player.v = Math.max(player.v, BASE_MAX);
              playSfx("dove");
              showFlash("🍄 TURBO!", true);
            } else if (k === "star") {
              player.starT = STAR_TIME;
              player.mudT = 0;
              player.spinT = 0;
              playSfx("dove");
              showFlash("⭐ YILDIZ! Dokunulmazsın", true);
            } else if (k === "banana") {
              addBanana(wrapS(player.s - 8), player.u);
              playSfx("coin");
              showFlash("🍌 Muz bıraktın", true);
            } else {
              player.vy = HOP_V;
              player.turboT = Math.max(player.turboT, HOP_BOOST);
              player.mudT = 0;
              playSfx("dove");
              showFlash("🪶 TÜY! Havalandın", true);
            }
          }
        }
      }

      // --- soru kapıları ---
      // SIRA ÖNEMLİ: önce geçilen kapının cevabı kaydedilir, SONRA sıradaki
      // kapı seçilip sorusu dağıtılır. Tersi olursa (kapı burada halka
      // şeklinde olduğu için) oyuncu bir kapıyı geçtiği KAREDE, o kapı henüz
      // `done` işaretlenmeden sıradaki kapı "en yakın" sayılıp siliniyordu →
      // soru, önceki cevap SRS'e işlenmeden seçildiği için aynı harf çıkıyordu.
      for (const g of gates) {
        // oyuncu kapıyı geçti mi? (bu karede üzerinden atladıysak da yakalanır)
        if (!g.done && g.target && player.finished === null && wrapS(player.s - g.s) < 8) {
          const target = g.target;
          g.done = true;
          lastGateT = tNow;      // sıradaki soru bu anın üstüne binmesin
          // 2 şıkta orta şerit yok: sola mı sağa mı gittiğine bakılır.
          const idx = g.options.length === 2
            ? (player.u < 0 ? 0 : 1)
            : g.optionLanes.indexOf(laneOf(player.u));
          const chosen = g.options[Math.max(0, idx)];
          const correct = chosen.id === target.id;
          recordGameAnswer(target, correct, {
            gameId: "kart", chosenId: chosen.id, shownIds: g.options.map((o) => o.id),
          });
          g.options.forEach((opt, k) => {
            (g.panels[g.optionLanes[k]].material as THREE.MeshBasicMaterial).color.set(
              opt.id === target.id ? 0x86efac : 0xfca5a5,
            );
          });
          // YENİ MODLARDA doğru cevabın SESİ kapıdan geçerken çalar: soru
          // görseldi, geri bildirim işitsel — çocuk adı hem okur hem duyar.
          if (g.mode !== "klasik") setTimeout(() => playItem(target), 260);
          if (correct) {
            statsRef.current.correct += 1;
            // "doğru kapıya giderse 2-3 saniye hız kazanabilir" + rastgele güç
            player.turboT = TURBO_TIME;
            player.v = Math.max(player.v, BASE_MAX);
            const k = randomPower();
            powerRef.current = k;
            setPower(k);
            player.glowT = 1.1;
            showFlash(`✅ Doğru! 🍄 hız + ${POWERS[k].emoji}`, true);
            playFeedback(true);
          } else {
            statsRef.current.wrong += 1;
            player.mudT = MUD_TIME;
            showFlash("💦 Çamur! Yavaşladın", false);
            playFeedback(false);
          }
        }
        for (const r of racers) {
          if (r.isPlayer || !g.target || g.botDone.has(r.id)) continue;
          if (wrapS(r.s - g.s) < 8) {
            g.botDone.add(r.id);
            const ok = g.options[laneOf(r.u)]?.id === g.target.id;
            if (ok) r.turboT = TURBO_TIME * 0.9; else r.mudT = MUD_TIME;
          }
        }
      }

      // Cevaplar işlendi; şimdi sıradaki kapıyı seç ve sorusunu dağıt.
      let nextGate: Gate | null = null;
      let nextD = Infinity;
      for (const g of gates) {
        if (g.done) continue;
        const d = wrapS(g.s - player.s);
        if (d < nextD) { nextD = d; nextGate = g; }
      }
      if (nextGate && !nextGate.target) armGate(nextGate);
      for (const g of gates) {
        if (g.done) {
          if (g.group.visible && wrapS(player.s - g.s) > 22 && wrapS(player.s - g.s) < TRACK_LEN * 0.5) {
            g.group.visible = false;
          }
        } else {
          g.group.visible = g === nextGate && !!g.target;
        }
      }

      // --- kapı sesi: kapı başına TEK KEZ, erkenden ---
      // Otomatik tekrar YOK (kullanıcı şartı: "soru cevaplamadan 2 defa
      // soruyor" — biri uzakta biri kapıya yakınken). Tekrar dinlemek isteyen
      // çocuk üstteki "Hangi kapı? — dinle" bandına dokunur.
      // ⚠️ PROMPT_GAP: geçilen kapının doğru/yanlış sesi bitmeden sıradaki
      // soru ÇALMAZ. Kapı aralığı PROMPT_LEAD'e yakın olan pistlerde (Çöl
      // Virajı 242, Yıldız Vadisi 280) soru, önceki kapının melodisiyle aynı
      // anda çalıp duyulmuyordu.
      if (nextGate?.target && nextD < PROMPT_LEAD) {
        const gt = nextGate.target;
        // `nextD < 80` emniyeti: bekleme soruyu GECİKTİRİR, asla atlamaz —
        // kapı yaklaştıysa süre dolmasa da sorulur.
        if (nextGate.said === 0 && (tNow - lastGateT >= PROMPT_GAP || nextD < 80)) {
          const g0 = nextGate;
          g0.said = 1;
          g0.tries += 1;
          setPrompt(gt);
          if (g0.mode === "flash") {
            // ⚠️ YENİ MODLARDA SORU SESLİ SORULMAZ. Sesi çalmak harfin ADINI
            // söylemek demektir — yani doğru cevabı vermek. Soru GÖRSELdir:
            // glif yarı saydam parlar, söner; çocuk adını okuyup kapıya gider.
            setGlifFlash(gt);
            window.setTimeout(() => setGlifFlash((x) => (x?.id === gt.id ? null : x)), FLASH_MS);
          } else if (g0.mode === "klasik") {
            // Kayıt GERÇEKTEN çalmadıysa (play() reddedildi / dosya hatası →
            // robotik TTS) soru sorulmuş sayılmaz: said sıfırlanır, bir sonraki
            // karede yeniden denenir. Bu "iki kez sormak" DEĞİL (kullanıcı onu
            // istemedi), "bir kez gerçekten sorabilmek" güvencesidir — en fazla
            // 2 deneme, kapı geçildiyse hiç denenmez.
            playItem(gt, {
              onFail: () => { if (!g0.done && g0.tries < 2) g0.said = 0; },
            });
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

      placeRacers();

      // --- drift kıvılcımları (oyuncu) ---
      if (Math.abs(player.drift) > 0.55 && player.y < 0.3) {
        const free = sparks.find((x) => x.life <= 0);
        if (free) {
          free.life = 0.35;
          worldAt(player.s - 1.6, player.u - Math.sign(player.drift) * 1.2, wpos);
          free.sp.position.set(wpos.x, wpos.y + 0.5, wpos.z);
          free.sp.visible = true;
        }
      }
      for (const sk of sparks) {
        if (sk.life > 0) {
          sk.life -= dt;
          sk.sp.scale.setScalar(1.6 + (0.35 - sk.life) * 6);
          if (sk.life <= 0) sk.sp.visible = false;
        }
      }

      // --- güç ışığı ---
      const auraMat = player.aura?.material as THREE.MeshBasicMaterial | undefined;
      let glowHex = 0, glowAmt = 0;
      if (player.starT > 0) {
        glowHex = POWERS.star.hex;
        glowAmt = 0.42 + Math.sin(tNow * 12) * 0.12;
      } else if (player.turboT > 0) {
        glowHex = POWERS.turbo.hex;
        glowAmt = 0.32 + Math.sin(tNow * 15) * 0.1;
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
          auraMat.opacity = glowAmt * 0.4;
          player.aura.scale.setScalar(1 + Math.sin(tNow * 7) * 0.07);
        }
      } else {
        player.bodyMat.emissive.setHex(0x000000);
        if (player.aura) player.aura.visible = false;
      }
      const marker = player.group.getObjectByName("marker");
      if (marker) marker.position.y = 4.2 + Math.abs(Math.sin(tNow * 4)) * 0.4;
      // Kapıya yaklaşırken oyuncunun oku ve isim tabelası tam ortadaki
      // panonun ÖNÜNE gelip harfi örtüyordu — o anda gizlenirler.
      // ⚠️ YENİ MODLARDA BÜTÜN yarışmacı etiketleri, ÇOK DAHA ERKEN gizlenir:
      // pano artık glif değil YAZI, ve yazı okumak glif tanımaktan uzun sürer.
      // 40 birimde gizlemek geç kalıyordu — "Zeynep/Yusuf" tabelaları sağdaki
      // şıkkın üstüne biniyor ve çocuk kelimeyi okuyamıyordu (ekran görüntüsünde
      // yakalandı).
      const okumaMesafesi = askMode === "klasik" ? 40 : 150;
      const atGate = nextGate !== null && nextD < okumaMesafesi;
      if (marker) marker.visible = !atGate;
      if (askMode === "klasik") {
        const ptag = player.group.getObjectByName("tag");
        if (ptag) ptag.visible = !atGate;
      } else {
        for (const r of racers) {
          const tg = r.group.getObjectByName("tag");
          if (tg) tg.visible = !atGate;
        }
      }
      // rampadaki oklar ileri doğru akar + havadaki ok zıplar → "hızlandırıyor"
      padTex.offset.y = (padTex.offset.y - dt * 1.6) % 1;
      const bob = Math.abs(Math.sin(tNow * 3)) * 0.7;
      for (const sg of padSigns) sg.scale.setScalar(4.2 + bob);

      // --- kamera: aracın arkasından, hıza göre geri çekilir ---
      // Yanal takip GÜÇLÜ olmalı: zayıf takiple (u*0.55) çime çıkan oyuncu
      // çerçevenin dışında kalıyor ve çocuk kendi aracını göremiyordu.
      const back = 13 + player.v * 0.14;
      worldAt(player.s - back, player.u * 0.75, camPos);
      camPos.y += 6.4 + player.y * 0.4;
      camera.position.lerp(camPos, Math.min(1, dt * 6));
      worldAt(player.s + 20, player.u * 0.55, camLook);
      camLook.y += 2.2;
      camera.lookAt(camLook);

      // Bot yalnızca KAMERANIN İÇİNE girdiğinde gizlenir. Önceden "oyuncunun
      // gerisindeki herkes" gizleniyordu (1..back+5 bandı) — geçtiğin rakip
      // daha yanı başındayken yok oluyordu. Ölçüt artık kameraya olan gerçek
      // mesafe: rakip geride kalmaya devam eder, yalnız kameranın burnuna
      // girdiğinde (görüntüyü kapatacakken) kaybolur.
      for (const r of racers) {
        if (r.isPlayer) continue;
        r.group.visible = r.group.position.distanceTo(camera.position) > 5;
      }
      // hız hissi: FOV turboyla açılır
      const wantFov = 62 + (player.turboT > 0 || player.starT > 0 ? 10 : 0) + player.v * 0.12;
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();

      // gölge kamerası aracı takip eder
      worldAt(player.s + 20, 0, wpos);
      sun.target.position.copy(wpos);
      sun.position.set(wpos.x + 90, wpos.y + 150, wpos.z + 70);
    };

    // ---------- geri sayım + döngü ----------
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let cd = 3.2;
    setCountdown(3);
    const ctrl = ctrlRef.current;
    ctrl.dir = 0; ctrl.dragU = null; ctrl.usePower = false;
    ctrl.running = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtRaw = (now - last) / 1000;
      const dt = Math.min(DT_MAX, dtRaw);
      last = now;
      adaptiveRes.sample(dtRaw);   // GERÇEK kare süresi (kelepçesiz) ölçülür
      const tNow = now * 0.001;

      if (!ctrl.running && cd > 0) {
        cd -= dt;
        const shown = Math.ceil(cd - 0.2);
        setCountdown(shown > 0 ? shown : 0);
        if (cd <= 0) {
          ctrl.running = true;
          setCountdown(null);
          playSfx("dove");
        }
        placeRacers();
        // Geri sayımda kamera geride ve yukarıda: hem ızgarayı hem pistin
        // ilk virajını göstersin (çocuk nereye gideceğini önceden görsün).
        worldAt(player.s - 20, 0, camPos);
        camPos.y += 9;
        camera.position.lerp(camPos, Math.min(1, dt * 5));
        worldAt(player.s + 30, 0, camLook);
        camLook.y += 2.4;
        camera.lookAt(camLook);
      } else if (ctrl.running) {
        step(dt, tNow);
      }

      renderer.render(scene, camera);

      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.14;
        const mine = totalOf(player);
        const ahead = racers.filter((r) => !r.isPlayer && (r.finished !== null || totalOf(r) > mine)).length;
        setHud({
          place: ahead + 1,
          lap: Math.min(LAPS, player.lap),
          pct: Math.min(100, Math.round((mine / (TRACK_LEN * LAPS)) * 100)),
          kmh: Math.round(player.v * 4.2),
          correct: statsRef.current.correct,
          wrong: statsRef.current.wrong,
        });
        setActivePower(player.starT > 0 ? "star" : player.turboT > 0 ? "turbo" : null);
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
      setCountdown(null);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      scene.clear();
      racersRef.current = [];
      gatesRef.current = [];
      bananasRef.current = [];
    };
  }, [phase, raceKey, track, showFlash]);

  // ---------- klavye (masaüstü) ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") ctrlRef.current.dir = -1;
      else if (e.code === "ArrowRight" || e.code === "KeyD") ctrlRef.current.dir = 1;
      else if (e.code === "Space" || e.code === "KeyX" || e.code === "KeyJ") {
        e.preventDefault();
        ctrlRef.current.usePower = true;
      }
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

  const PLACE_TXT = useMemo(
    () => ["", "🏆 BİRİNCİ!", "🥈 İkinci!", "🥉 Üçüncü!", "4. oldun", "5. oldun", "6. oldun"],
    [],
  );

  return (
    <div ref={wrapRef} className="fixed inset-0 flex flex-col overscroll-none bg-sky-300">
      {phase === "race" && (
        <>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

          {/* üst HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
            {/* Yarıştan çıkış: önceden yalnız bitiş ekranında vardı, çocuk
                yarışın ortasında oyunlara dönemiyordu. */}
            <button
              onClick={exit}
              aria-label="Oyunlara dön"
              className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-muted-foreground shadow-card backdrop-blur active:scale-90"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="rounded-2xl bg-white/85 px-2.5 py-1.5 text-center shadow-card backdrop-blur">
              <div className="text-[10px] font-bold text-muted-foreground">Sıra</div>
              <div className="text-xl font-extrabold text-primary">{hud.place}<span className="text-xs">/{RACERS}</span></div>
            </div>
            <div className="flex-1 rounded-2xl bg-white/85 px-3 py-1.5 shadow-card backdrop-blur">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>TUR {hud.lap}/{LAPS}</span><span>{hud.kmh} km/s</span>
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

          {/* ⚠️ "dinle" bandı YALNIZ klasik modda. Yeni modlarda sesi çalmak
              harfin ADINI söylemek = cevabı vermek olurdu. Onun yerine
              "şimşek" modunda glifi tekrar gösteren bir düğme var. */}
          {prompt && askModeRef.current === "klasik" && (
            <button
              onClick={() => playItem(prompt)}
              className="absolute inset-x-3 top-[70px] z-20 flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-white/90 px-3 py-2 font-extrabold text-primary shadow-card backdrop-blur active:scale-95"
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
              className="absolute inset-x-3 top-[70px] z-20 flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-white/90 px-3 py-2 font-extrabold text-primary shadow-card backdrop-blur active:scale-95"
            >
              <Eye className="h-5 w-5" />
              Harfi tekrar göster
            </button>
          )}

          {/* ŞİMŞEK: glif yarı saydam parlar — arkadaki yarış görünmeye devam
              eder (kullanıcı şartı), çocuk hem yolu hem harfi takip eder. */}
          {glifFlash && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div
                className="font-arabic text-[9rem] leading-[1.4] text-emerald-900 drop-shadow-[0_2px_12px_rgba(255,255,255,0.9)]"
                style={{ opacity: 0.55 }}
                dir="rtl"
              >
                {glifFlash.emoji}
              </div>
            </div>
          )}

          {countdown !== null && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div key={countdown} className="animate-pop text-[7rem] font-extrabold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                {countdown > 0 ? countdown : "BAŞLA!"}
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

          {activePower && (
            <div
              className="pointer-events-none absolute inset-0 z-10 animate-pulse"
              style={{
                boxShadow: `inset 0 0 34px 5px ${activePower === "star" ? "rgba(250,204,21,0.6)" : "rgba(255,122,24,0.5)"}`,
              }}
            />
          )}

          {/* Kontroller yüzer — ekranın geri kalanı sürükleme alanı */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-1 px-5 pb-3">
            <span className="mb-2 rounded-full bg-white/85 px-3 py-1 text-[11px] font-extrabold text-muted-foreground backdrop-blur">
              👆 parmağını kaydır
            </span>

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
                {power ? "BAS ya da ekrana dokun" : "doğru kapı = güç"}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ---- PİST SEÇME ---- */}
      {phase === "tracks" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4 pb-8 text-center">
          <div className="mt-2 text-5xl">🏎️</div>
          <h1 className="mt-1 text-2xl font-extrabold text-primary">Elifbâ Yarışı</h1>
          <p className="mx-auto mt-1 max-w-xs text-xs font-bold text-muted-foreground">
            5 arkadaşınla {LAPS} tur yarış! Virajları al, çime çıkma,
            <b className="text-primary"> doğru harfin kapısından</b> geç ve turbo kap 🍄
          </p>

          <div className="mx-auto mt-3 grid w-full max-w-sm gap-2">
            {TRACKS.map((t, i) => {
              const n = i + 1;
              const open = n <= unlocked;
              const done = n < unlocked;
              return (
                <button
                  key={n}
                  onClick={() => open && start(n)}
                  disabled={!open}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl border-4 p-3 text-left shadow-card transition-bouncy",
                    open ? "border-primary/40 bg-card active:scale-95" : "border-muted bg-muted/40 opacity-60",
                  )}
                >
                  <div>
                    <div className="text-lg font-extrabold text-primary">{n}. Pist</div>
                    <div className="text-xs font-bold text-muted-foreground">{t.name}</div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      {t.gates} soru kapısı · {LAPS} tur
                    </div>
                  </div>
                  {!open ? <Lock className="h-5 w-5 text-muted-foreground" />
                    : done ? <span className="text-2xl">⭐</span>
                    : <span className="text-2xl">🏁</span>}
                </button>
              );
            })}
          </div>

          <div className="mx-auto mt-3 w-full max-w-sm rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-extrabold text-primary">
            🚧 Devamı gelecek — yeni pistler yolda!
          </div>

          <div className="mx-auto mt-3 grid w-full max-w-sm gap-1.5 text-left text-xs font-bold">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/10 px-3 py-2">👆 Parmağını ekrana bas ve sağa/sola KAYDIR</div>
            <div className="rounded-xl border-2 border-success/30 bg-success/10 px-3 py-2">✅ Doğru kapı → 🍄 2-3 sn hız + SÜRPRİZ güç</div>
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-3 py-2">🌿 Çime çıkarsan yavaşlarsın, 🍌 muza değersen kayarsın</div>
            <div className="rounded-xl border-2 border-warning/30 bg-warning/10 px-3 py-2">✨ Güçler: 🍄 turbo · ⭐ yıldız · 🍌 muz · 🪶 tüy</div>
          </div>

          <button
            onClick={() => start(unlocked)}
            className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-success px-8 py-4 text-lg font-extrabold text-success-foreground shadow-card active:scale-95"
          >
            <Maximize2 className="h-5 w-5" /> {unlocked}. Pistte Yarış
          </button>
          <button onClick={exit} className="mt-3 text-sm font-bold text-muted-foreground underline">
            Oyunlara dön
          </button>
        </div>
      )}

      {/* ---- BİTİŞ ---- */}
      {phase === "finish" && result && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="animate-bounce-in text-6xl">
            {result.place === 1 ? "🏆" : result.place <= 3 ? "🎉" : "💪"}
          </div>
          <h2 className="text-2xl font-extrabold text-primary">{PLACE_TXT[result.place] ?? "Bitti!"}</h2>
          <div className="-mt-1 text-sm font-bold text-muted-foreground">
            {track}. Pist · {TRACKS[track - 1]?.name}
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
            {track < TRACK_COUNT ? (
              <button onClick={() => start(track + 1)}
                className="rounded-full bg-success px-6 py-3 font-extrabold text-success-foreground shadow-card active:scale-95">
                ▶ {track + 1}. Pist
              </button>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-sm font-extrabold text-primary">
                🚧 Son pisti bitirdin! Devamı gelecek…
              </div>
            )}
            <button onClick={() => start(track)}
              className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground shadow-card active:scale-95">
              Tekrar
            </button>
            <button onClick={() => { setPrompt(null); setPhase("tracks"); }}
              className="rounded-full bg-muted px-5 py-3 font-extrabold text-muted-foreground shadow-card active:scale-95">
              Pistler
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

export default KartGame;
