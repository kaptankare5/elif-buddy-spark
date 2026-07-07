// 3D "ElifBâ Koşusu" — eğitici sonsuz koşu oyunu.
// Tasarım: docs/elifba-kosu-tasarim.md
//
// Çekirdek döngü: ses + yazılı soru hedef harfi verir; oyuncu koşarken sabit
// engeller / karşıdan gelen engeller / bariyerler arasında zıplayıp kayarak
// ilerler ve ileride beliren 3 büyük harf panosundan doğrusunun içinden geçer.
// Doğru: puan + seri + bazen güç (jetpack / 2x / mıknatıs). Yanlış: kalp ve
// puan kaybı + doğru cevap gösterilir. Cevaplar SRS ilerlemesine işlenir.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { gamePool, pickN, shuffle } from "./_shared";
import { recordLetterMastery } from "@/data/srs";
import { enqueueRetryItem, getGameItemLevel, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Volume2, Heart, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Pause, Play } from "lucide-react";

// ---- sabitler ----
// Panolar büyütülünce (özellikle boy) şeritler de genişlemeli — yoksa komşu
// panolar iç içe girer. WSCALE tüm enine (x) genişlikleri (tren/bariyer/ray)
// yeni şerit aralığına orantılı ölçekler.
const OLD_LANE_GAP = 2.3;
const LANE_GAP = 3.3;
const LANE_X = [-LANE_GAP, 0, LANE_GAP] as const;
const WSCALE = LANE_GAP / OLD_LANE_GAP;
const GATE_Z = -70;        // pano dalgasının doğduğu yerel z
const OBST_Z = -78;        // engel sırasının doğduğu yerel z
const DESPAWN_Z = 16;
const BASE_SPEED = 13;
const MAX_SPEED = 24;
const DT_MAX = 0.05;       // sekme arkaplandan dönünce ışınlanmayı önler
const GRAVITY = -30;
const JUMP_V = 11.6;       // tepe ≈ 2.24 — tren üstüne (1.7) rahat çıkar
const TRAIN_TOP = 1.7;     // tren üstü koşu yüzeyi
const RAMP_LEN = 3.4;
const SLIDE_TIME = 0.8;
const GHOST_TIME = 1.4;    // tökezleme sonrası hayalet süresi
const JET_TIME = 4.5;
const X2_TIME = 12;
const MAG_TIME = 10;
const BOARD_W = 2.9;       // harf panosu genişliği (büyük ve okunur)
const BOARD_H = 3.6;       // pano yüksekliği — genişlikten belirgin daha büyük
const BOARD_GAP = 0.15;    // panonun alt kenarı ile zemin/tren üstü arası boşluk

// Tren/bariyer enine genişlikleri
const TRAIN_W = 1.9 * WSCALE, TRAIN_TOP_W = 1.95 * WSCALE, TRAIN_GLASS_W = 1.7 * WSCALE, TRAIN_SKIRT_W = 1.6 * WSCALE;
const ONC_FRONT_W = 1.8 * WSCALE, ONC_LIGHT_X = 0.55 * WSCALE;
const LOW_POLE_X = 0.85 * WSCALE, LOW_BAR_W = 1.8 * WSCALE;
const OH_POLE_X = 0.95 * WSCALE, OH_SIGN_W = 2.0 * WSCALE, OH_PANEL_W = 1.7 * WSCALE;
const RAIL_OFFSET = 0.55 * WSCALE;

interface Sim {
  running: boolean;
  speed: number;
  D: number;          // toplam alınan yol — dünya grubu bu kadar kayar
  lane: number;
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
  slideT: number;
  ghostT: number;     // hayalet (dokunulmaz) süresi
  slowT: number;      // tökezleme yavaşlaması
  jetT: number;
  x2T: number;
  magT: number;
  shake: number;
}

// Tek varlık tipi — kind alanına göre alanların bir kısmı kullanılır.
interface Ent {
  id: number;
  kind: "train" | "oncoming" | "low" | "overhead" | "coins" | "gate";
  localZ: number;             // dünya grubu içindeki sabit z (train/gate: ön yüz)
  lane?: number;
  len?: number;
  ramp?: boolean;
  color?: string;
  extraZ?: number;            // karşıdan gelen trenin ek yolu (mutasyonla artar)
  count?: number;
  y?: number;
  taken?: boolean[];
  hit?: boolean;
  target?: ContentItem;
  items?: ContentItem[];
  targetLane?: number;
  elevated?: boolean;
  crossed?: boolean;
  resolution?: null | { lane: number; correct: boolean };
}

let UID = 1;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
function nearestLane(x: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < LANE_X.length; i++) {
    const d = Math.abs(LANE_X[i] - x);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ---- Arapça harf panosu dokusu: beyaz tabela + çok büyük koyu harf ----
// Harf, gerçek piksel sınırları ölçülerek panoya SIĞDIRILIR ve ortalanır.
// Böylece derin çanaklı harfler (ج ح خ ع غ…) kesilmez, ufak harfler de
// panoyu olabildiğince doldurur (uzaktan okunurluk).
let MAX_ANISO = 4; // Canvas onCreated'da gerçek donanım değeriyle güncellenir
const FONT_STACK = '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif';
const texCache = new Map<string, THREE.CanvasTexture>();
function boardTexture(text: string): THREE.CanvasTexture {
  const hit = texCache.get(text);
  if (hit) return hit;
  // Kanvas oranı pano oranıyla (BOARD_W:BOARD_H) eşleşir — aksi halde harf
  // dikeyde gerilip bozulurdu.
  const cW = 512;
  const cH = Math.round(cW * (BOARD_H / BOARD_W));
  const c = document.createElement("canvas");
  c.width = cW; c.height = cH;
  const g = c.getContext("2d")!;
  // beyaz yuvarlak köşeli pano
  g.clearRect(0, 0, cW, cH);
  const r = 56;
  g.beginPath();
  g.moveTo(r, 6);
  g.arcTo(cW - 6, 6, cW - 6, cH - 6, r);
  g.arcTo(cW - 6, cH - 6, 6, cH - 6, r);
  g.arcTo(6, cH - 6, 6, 6, r);
  g.arcTo(6, 6, cW - 6, 6, r);
  g.closePath();
  g.fillStyle = "#ffffff";
  g.fill();
  g.lineWidth = 18;
  g.strokeStyle = "#0f766e";
  g.stroke();
  // 1) ölçüm turu
  const base = 300;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `${base}px ${FONT_STACK}`;
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent || base * 0.75;
  const desc = m.actualBoundingBoxDescent || base * 0.25;
  const w = Math.max((m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0), m.width, 1);
  // 2) kullanılabilir alana ölçekle (genişlik ve yükseklik payı ayrı ayrı;
  // harf sadece genişlik sınırıyla büyür, ekstra boy fazladan üst/alt boşluk verir)
  const pad = 52;
  const availW = cW - pad * 2;
  const availH = cH - pad * 2;
  const scale = Math.min(availH / (asc + desc), availW / w, 1.55);
  const size = Math.floor(base * scale);
  g.font = `${size}px ${FONT_STACK}`;
  const m2 = g.measureText(text);
  const asc2 = m2.actualBoundingBoxAscent || size * 0.75;
  const desc2 = m2.actualBoundingBoxDescent || size * 0.25;
  // 3) dikeyde tüm kanvasa göre ortala
  const y = (cH - (asc2 + desc2)) / 2 + asc2;
  g.fillStyle = "#065f46";
  g.fillText(text, cW / 2, y);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = Math.min(16, MAX_ANISO);
  texCache.set(text, t);
  return t;
}

// ================= sahne dekoru =================

function Rails() {
  return (
    <group>
      {LANE_X.map((x) => (
        <group key={x}>
          <mesh position={[x - RAIL_OFFSET, 0.08, -30]}>
            <boxGeometry args={[0.1, 0.09, 130]} />
            <meshLambertMaterial color="#8b95a3" />
          </mesh>
          <mesh position={[x + RAIL_OFFSET, 0.08, -30]}>
            <boxGeometry args={[0.1, 0.09, 130]} />
            <meshLambertMaterial color="#8b95a3" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const SLEEPER_LEN = (LANE_GAP + RAIL_OFFSET) * 2 + 3; // tüm şeritleri + kenar payını kapla

function Sleepers({ sim }: { sim: React.MutableRefObject<Sim> }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const zs = useMemo(() => Array.from({ length: 22 }, (_, i) => -80 + i * 4), []);
  useFrame((_, dRaw) => {
    const s = sim.current;
    const d = Math.min(dRaw, DT_MAX) * (s.running ? 1 : 0);
    for (const m of refs.current) {
      if (!m) continue;
      m.position.z += s.speed * d;
      if (m.position.z > 10) m.position.z -= 88;
    }
  });
  return (
    <>
      {zs.map((z, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} position={[0, 0.03, z]}>
          <boxGeometry args={[SLEEPER_LEN, 0.08, 0.5]} />
          <meshLambertMaterial color="#b98b5e" />
        </mesh>
      ))}
    </>
  );
}

const BUILDING_COLORS = ["#f9a8d4", "#93c5fd", "#fcd34d", "#86efac", "#c4b5fd", "#fdba74"];

function Scenery({ sim }: { sim: React.MutableRefObject<Sim> }) {
  const defs = useMemo(() => {
    const arr: { x: number; z: number; w: number; h: number; c: string; tree: boolean }[] = [];
    for (let i = 0; i < 9; i++) {
      for (const side of [-1, 1]) {
        arr.push({
          x: side * (7.5 + Math.random() * 3),
          z: -85 + i * 11 + Math.random() * 5,
          w: 2.2 + Math.random() * 1.8,
          h: 2 + Math.random() * 4.5,
          c: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
          tree: Math.random() < 0.3,
        });
      }
    }
    return arr;
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dRaw) => {
    const s = sim.current;
    const d = Math.min(dRaw, DT_MAX) * (s.running ? 1 : 0);
    for (const g of refs.current) {
      if (!g) continue;
      g.position.z += s.speed * d;
      if (g.position.z > 14) g.position.z -= 100;
    }
  });
  return (
    <>
      {defs.map((b, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} position={[b.x, 0, b.z]}>
          {b.tree ? (
            <>
              <mesh position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.16, 0.22, 1.4, 8]} />
                <meshLambertMaterial color="#92613a" />
              </mesh>
              <mesh position={[0, 1.9, 0]}>
                <sphereGeometry args={[0.95, 12, 10]} />
                <meshLambertMaterial color="#4cae5b" />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, b.h / 2, 0]}>
                <boxGeometry args={[b.w, b.h, b.w]} />
                <meshLambertMaterial color={b.c} />
              </mesh>
              <mesh position={[0, b.h + 0.12, 0]}>
                <boxGeometry args={[b.w + 0.3, 0.24, b.w + 0.3]} />
                <meshLambertMaterial color="#64748b" />
              </mesh>
            </>
          )}
        </group>
      ))}
    </>
  );
}

function Clouds({ sim }: { sim: React.MutableRefObject<Sim> }) {
  const defs = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({
      x: (Math.random() - 0.5) * 30,
      y: 8 + Math.random() * 4,
      z: -86 + i * 14,
      s: 1 + Math.random() * 1.4,
    })),
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dRaw) => {
    const s = sim.current;
    const d = Math.min(dRaw, DT_MAX) * (s.running ? 1 : 0);
    for (const g of refs.current) {
      if (!g) continue;
      g.position.z += s.speed * 0.25 * d;
      // kameraya yaklaşmadan sar — yakın plana dev bulut girmesin
      if (g.position.z > -14) g.position.z -= 90;
    }
  });
  return (
    <>
      {defs.map((c, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[0.9, -0.1, 0]}><sphereGeometry args={[0.7, 10, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[-0.9, -0.15, 0]}><sphereGeometry args={[0.65, 10, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
        </group>
      ))}
    </>
  );
}

const GROUND_HALF = LANE_GAP + BOARD_W / 2 + 2.9; // panoların dışına yeterli omuz payı
function Ground() {
  const side = GROUND_HALF * 2;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -30]}>
        <planeGeometry args={[GROUND_HALF * 2, 150]} />
        <meshLambertMaterial color="#e3dccb" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-(GROUND_HALF + side / 2), -0.03, -30]}>
        <planeGeometry args={[side, 150]} />
        <meshLambertMaterial color="#b7e3a6" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[GROUND_HALF + side / 2, -0.03, -30]}>
        <planeGeometry args={[side, 150]} />
        <meshLambertMaterial color="#b7e3a6" />
      </mesh>
    </group>
  );
}

// ================= oyuncu =================

function Player({ sim }: { sim: React.MutableRefObject<Sim> }) {
  const g = useRef<THREE.Group>(null!);
  const sprite = useRef<THREE.Sprite>(null!);
  const jet = useRef<THREE.Group>(null!);
  const flameL = useRef<THREE.Mesh>(null!);
  const flameR = useRef<THREE.Mesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const map = useTexture("/runner-child.png");

  useFrame((st, dRaw) => {
    const s = sim.current;
    const d = Math.min(dRaw, DT_MAX);
    s.x += (LANE_X[s.lane] - s.x) * Math.min(1, d * 10);
    const t = st.clock.elapsedTime;
    const running = s.running && s.grounded && s.jetT <= 0 && s.slideT <= 0;
    const bob = running ? Math.abs(Math.sin(t * 9)) * 0.09 : 0;
    // karakter orta noktası yaklaşık 0.9; sprite'ı bu yüksekliğe oturt
    g.current.position.set(s.x, s.y + bob + 0.9, 0);
    g.current.rotation.z = (LANE_X[s.lane] - s.x) * -0.09;
    g.current.rotation.x = s.jetT > 0 ? -0.25 : !s.grounded ? -0.12 : 0;
    // kayma: dikey olarak sıkıştır
    const squash = s.slideT > 0 ? 0.52 : 1;
    const baseScale = 1.6;
    sprite.current.scale.set(baseScale, baseScale * squash, 1);
    // hayalet: yanıp sönme
    g.current.visible = s.ghostT > 0 ? Math.floor(t * 12) % 2 === 0 : true;
    jet.current.visible = s.jetT > 0;
    if (s.jetT > 0) {
      const f = 0.8 + Math.abs(Math.sin(t * 30)) * 0.5;
      flameL.current.scale.set(1, f, 1);
      flameR.current.scale.set(1, f * 0.9, 1);
    }
    shadow.current.position.x = s.x;
    const sh = Math.max(0.25, 1 - s.y / 4.5);
    shadow.current.scale.setScalar(sh);
    (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.22 * sh;
  });

  return (
    <>
      <group ref={g}>
        <sprite ref={sprite} position={[0, 0, 0]}>
          <spriteMaterial map={map} transparent alphaTest={0.5} />
        </sprite>
        <group ref={jet} visible={false}>
          <mesh position={[-0.14, 0.2, 0.42]}>
            <cylinderGeometry args={[0.11, 0.11, 0.55, 10]} />
            <meshLambertMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0.14, 0.2, 0.42]}>
            <cylinderGeometry args={[0.11, 0.11, 0.55, 10]} />
            <meshLambertMaterial color="#94a3b8" />
          </mesh>
          <mesh ref={flameL} position={[-0.14, -0.22, 0.42]} rotation-x={Math.PI}>
            <coneGeometry args={[0.1, 0.4, 8]} />
            <meshBasicMaterial color="#fb923c" />
          </mesh>
          <mesh ref={flameR} position={[0.14, -0.22, 0.42]} rotation-x={Math.PI}>
            <coneGeometry args={[0.1, 0.4, 8]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </group>
      </group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
    </>
  );
}

// ================= dünya varlıkları =================

const TRAIN_COLORS = ["#ef6a6a", "#5aa9f8", "#f8b34c", "#7dd3a8", "#c4a3f5"];

// Park treni — üstü koşulabilir; rampalıysa önden çıkılır.
function TrainEnt({ e }: { e: Ent }) {
  const len = e.len!;
  const color = e.color!;
  return (
    <group position={[LANE_X[e.lane!], 0, e.localZ]}>
      {/* gövde: ön yüz z=0, arkaya doğru uzanır */}
      <mesh position={[0, 0.9, -len / 2]}>
        <boxGeometry args={[TRAIN_W, 1.5, len]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {/* üst koşu yüzeyi */}
      <mesh position={[0, TRAIN_TOP - 0.04, -len / 2]}>
        <boxGeometry args={[TRAIN_TOP_W, 0.1, len]} />
        <meshLambertMaterial color="#475569" />
      </mesh>
      {/* ön cam / yüz */}
      <mesh position={[0, 1.1, 0.02]}>
        <boxGeometry args={[TRAIN_GLASS_W, 0.7, 0.06]} />
        <meshLambertMaterial color="#dbeafe" />
      </mesh>
      {/* alt etek */}
      <mesh position={[0, 0.18, -len / 2]}>
        <boxGeometry args={[TRAIN_SKIRT_W, 0.36, len - 0.4]} />
        <meshLambertMaterial color="#334155" />
      </mesh>
      {/* rampa: öne eğimli sarı şeritli plaka */}
      {e.ramp && (
        <mesh position={[0, TRAIN_TOP / 2 - 0.05, RAMP_LEN / 2]} rotation-x={Math.atan2(TRAIN_TOP, RAMP_LEN)}>
          <boxGeometry args={[TRAIN_W, 0.12, Math.sqrt(RAMP_LEN * RAMP_LEN + TRAIN_TOP * TRAIN_TOP)]} />
          <meshLambertMaterial color="#fbbf24" />
        </mesh>
      )}
    </group>
  );
}

// Karşıdan gelen tren — farlı, hızlı, tehlikeli.
function OncomingEnt({ e, sim }: { e: Ent; sim: React.MutableRefObject<Sim> }) {
  const g = useRef<THREE.Group>(null!);
  const len = e.len!;
  useFrame((st, dRaw) => {
    const s = sim.current;
    const d = Math.min(dRaw, DT_MAX) * (s.running ? 1 : 0);
    e.extraZ = (e.extraZ ?? 0) + 9 * d;
    g.current.position.z = e.localZ + e.extraZ!;
    // far yanıp söner
    void st;
  });
  return (
    <group ref={g} position={[LANE_X[e.lane!], 0, e.localZ]}>
      <mesh position={[0, 0.9, -len / 2]}>
        <boxGeometry args={[TRAIN_W, 1.5, len]} />
        <meshLambertMaterial color="#64748b" />
      </mesh>
      <mesh position={[0, TRAIN_TOP - 0.04, -len / 2]}>
        <boxGeometry args={[TRAIN_TOP_W, 0.1, len]} />
        <meshLambertMaterial color="#1f2937" />
      </mesh>
      {/* parlak ön yüz + farlar */}
      <mesh position={[0, 1.05, 0.02]}>
        <boxGeometry args={[ONC_FRONT_W, 0.9, 0.08]} />
        <meshLambertMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-ONC_LIGHT_X, 0.55, 0.08]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshBasicMaterial color="#fffbeb" />
      </mesh>
      <mesh position={[ONC_LIGHT_X, 0.55, 0.08]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshBasicMaterial color="#fffbeb" />
      </mesh>
    </group>
  );
}

// Alçak bariyer — üstünden zıplanır.
function LowBarrierEnt({ e }: { e: Ent }) {
  return (
    <group position={[LANE_X[e.lane!], 0, e.localZ]}>
      <mesh position={[-LOW_POLE_X, 0.42, 0]}>
        <boxGeometry args={[0.12, 0.85, 0.12]} />
        <meshLambertMaterial color="#6b7280" />
      </mesh>
      <mesh position={[LOW_POLE_X, 0.42, 0]}>
        <boxGeometry args={[0.12, 0.85, 0.12]} />
        <meshLambertMaterial color="#6b7280" />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[LOW_BAR_W, 0.34, 0.14]} />
        <meshLambertMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[LOW_BAR_W, 0.26, 0.14]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// Üst tabela — altından kayılır.
function OverheadEnt({ e }: { e: Ent }) {
  return (
    <group position={[LANE_X[e.lane!], 0, e.localZ]}>
      <mesh position={[-OH_POLE_X, 1.3, 0]}>
        <boxGeometry args={[0.14, 2.6, 0.14]} />
        <meshLambertMaterial color="#6b7280" />
      </mesh>
      <mesh position={[OH_POLE_X, 1.3, 0]}>
        <boxGeometry args={[0.14, 2.6, 0.14]} />
        <meshLambertMaterial color="#6b7280" />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <boxGeometry args={[OH_SIGN_W, 1.4, 0.14]} />
        <meshLambertMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[0, 1.85, 0.08]}>
        <boxGeometry args={[OH_PANEL_W, 1.1, 0.02]} />
        <meshLambertMaterial color="#fff7ed" />
      </mesh>
      {/* aşağı ok — "altından kay" ipucu */}
      <mesh position={[0, 1.85, 0.11]} rotation-z={Math.PI}>
        <coneGeometry args={[0.35, 0.7, 3]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

// Altın dizisi.
function CoinsEnt({ e }: { e: Ent }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    for (let i = 0; i < e.count!; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      m.visible = !e.taken![i];
      m.rotation.y = t * 4;
    }
  });
  return (
    <group position={[LANE_X[e.lane!], e.y!, e.localZ]}>
      {Array.from({ length: e.count! }).map((_, i) => (
        <mesh key={i} ref={(el) => { meshes.current[i] = el; }} position={[0, 0, i * 1.7]} scale={[1, 1, 0.35]}>
          <sphereGeometry args={[0.34, 14, 10]} />
          <meshLambertMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// Harf panosu dalgası — 3 şeritte büyük tabelalar.
function GateEnt({ e, hintLane, fontTick }: { e: Ent; hintLane: number; fontTick: number }) {
  // Panonun alt kenarı zemine/tren üstüne yakın durur — bir kapı gibi
  // içinden geçilir. Yükseklik oyuncu boyunu rahatça aşar.
  const boardY = (e.elevated ? TRAIN_TOP : 0) + BOARD_GAP + BOARD_H / 2;
  return (
    <group position={[0, 0, e.localZ]}>
      {e.items!.map((it, lane) => (
        <GateBoard
          key={lane}
          item={it}
          lane={lane}
          y={boardY}
          elevated={!!e.elevated}
          showHint={hintLane === lane && !e.resolution}
          resolution={e.resolution ?? null}
          fontTick={fontTick}
        />
      ))}
    </group>
  );
}

function GateBoard({ item, lane, y, elevated, showHint, resolution, fontTick }: {
  item: ContentItem;
  lane: number;
  y: number;
  elevated: boolean;
  showHint: boolean;
  resolution: null | { lane: number; correct: boolean };
  fontTick: number;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(() => boardTexture(item.emoji || "?"), [item.emoji, fontTick]);
  const glow = useRef<THREE.Mesh>(null!);
  const board = useRef<THREE.Mesh>(null!);
  const anim = useRef(0);
  const resolvedHere = !!resolution && resolution.lane === lane;

  useFrame((st, d) => {
    if (glow.current) {
      const p = 1 + Math.sin(st.clock.elapsedTime * 5) * 0.06;
      glow.current.scale.setScalar(p);
    }
    if (resolvedHere && board.current) {
      anim.current = Math.min(1, anim.current + d * 2.5);
      const k = anim.current;
      board.current.position.y = y + k * 1.2;
      board.current.scale.setScalar(1 + k * 0.35);
      (board.current.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    }
  });

  const postX = BOARD_W / 2 - 0.5;
  const postH = Math.max(0.2, y - BOARD_H / 2 - (elevated ? TRAIN_TOP : 0));
  const postBaseY = elevated ? TRAIN_TOP : 0;
  return (
    <group position={[LANE_X[lane], 0, 0]}>
      {/* direkler */}
      <mesh position={[-postX, postBaseY + postH / 2, -0.06]}>
        <cylinderGeometry args={[0.06, 0.06, postH, 8]} />
        <meshLambertMaterial color="#64748b" />
      </mesh>
      <mesh position={[postX, postBaseY + postH / 2, -0.06]}>
        <cylinderGeometry args={[0.06, 0.06, postH, 8]} />
        <meshLambertMaterial color="#64748b" />
      </mesh>
      {/* ipucu parlaması */}
      {showHint && (
        <mesh ref={glow} position={[0, y, -0.04]}>
          <planeGeometry args={[BOARD_W + 0.45, BOARD_H + 0.45]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.85} fog={false} />
        </mesh>
      )}
      {/* çözüm arka planı: doğru yeşil / yanlış kırmızı */}
      {resolvedHere && (
        <mesh position={[0, y, -0.03]}>
          <planeGeometry args={[BOARD_W + 0.35, BOARD_H + 0.35]} />
          <meshBasicMaterial color={resolution!.correct ? "#22c55e" : "#ef4444"} fog={false} />
        </mesh>
      )}
      {/* pano — sisten muaf: uzaktan da net okunur */}
      <mesh ref={board} position={[0, y, 0]}>
        <planeGeometry args={[BOARD_W, BOARD_H]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

// ================= simülasyon (tek döngü) =================

interface DirectorProps {
  sim: React.MutableRefObject<Sim>;
  entsRef: React.MutableRefObject<Ent[]>;
  worldRef: React.MutableRefObject<THREE.Group | null>;
  gateActive: React.MutableRefObject<boolean>;
  onSpawnGate: () => void;
  onSpawnRow: (localZ: number) => void;
  onAirCoins: () => void;
  onGateCross: (id: number) => void;
  onStumble: () => void;
  onCoin: () => void;
  onDespawn: (ids: number[]) => void;
  onTimersEnd: () => void;
}

function Director({ sim, entsRef, worldRef, gateActive, onSpawnGate, onSpawnRow, onAirCoins, onGateCross, onStumble, onCoin, onDespawn, onTimersEnd }: DirectorProps) {
  const gateCool = useRef(1.0);
  const nextObsD = useRef(26);
  const jetCoin = useRef(0.4);
  const cleanupT = useRef(0.5);
  const { camera } = useThree();

  useFrame((st, dRaw) => {
    const s = sim.current;
    const d = Math.min(dRaw, DT_MAX);

    // kamera — şeritler genişlediği için biraz geride ve yukarıda durur
    const shakeX = s.shake > 0 ? Math.sin(st.clock.elapsedTime * 45) * 0.16 * (s.shake / 0.5) : 0;
    camera.position.set(shakeX, 4.7 + s.y * 0.3, 8.6);
    camera.lookAt(0, 1.5 + s.y * 0.25, -10);
    if (!s.running) return;

    // zamanlayıcılar
    if (s.shake > 0) s.shake = Math.max(0, s.shake - d);
    if (s.slideT > 0) s.slideT = Math.max(0, s.slideT - d);
    if (s.ghostT > 0) s.ghostT = Math.max(0, s.ghostT - d);
    if (s.slowT > 0) s.slowT = Math.max(0, s.slowT - d);
    if (s.x2T > 0) { s.x2T = Math.max(0, s.x2T - d); if (s.x2T === 0) onTimersEnd(); }
    if (s.magT > 0) { s.magT = Math.max(0, s.magT - d); if (s.magT === 0) onTimersEnd(); }
    if (s.jetT > 0) {
      s.jetT = Math.max(0, s.jetT - d);
      jetCoin.current -= d;
      if (jetCoin.current <= 0 && s.jetT > 1.8) { onAirCoins(); jetCoin.current = 0.9; }
      if (s.jetT === 0) { gateCool.current = Math.max(gateCool.current, 0.9); onTimersEnd(); }
    }

    // ilerleme (tökezlemede yavaşla)
    const slowK = s.slowT > 0 ? 0.5 + 0.5 * (1 - s.slowT / 1.2) : 1;
    s.D += s.speed * slowK * d;
    if (worldRef.current) worldRef.current.position.z = s.D;

    const ents = entsRef.current;
    const lane = nearestLane(s.x);

    // --- destek yüksekliği (tren üstü) + tren çarpışması ---
    let support = 0;
    let insideSolid = false;
    for (const e of ents) {
      if (e.kind !== "train" && e.kind !== "oncoming") continue;
      if (e.lane !== lane) continue;
      const wzF = s.D + e.localZ + (e.extraZ ?? 0);
      if (e.kind === "train" && e.ramp) {
        // rampa öne uzanır: [wzF, wzF+RAMP_LEN] eğim, [wzF-len, wzF] gövde
        if (wzF + RAMP_LEN < -0.9 || wzF - e.len! > 0.9) continue;
        support = Math.max(support, TRAIN_TOP * clamp01((wzF + RAMP_LEN) / RAMP_LEN));
        continue;
      }
      if (wzF < -0.9 || wzF - e.len! > 0.9) continue; // oyuncuyla çakışmıyor
      if (s.y >= TRAIN_TOP - 0.45) {
        // her iki tren tipinin de üstünde koşulabilir (hareketli tren altından akar)
        support = Math.max(support, TRAIN_TOP);
      } else {
        insideSolid = true;
      }
    }
    if (insideSolid && s.jetT <= 0) {
      if (s.ghostT <= 0) { onStumble(); s.ghostT = GHOST_TIME; s.slowT = 1.2; s.shake = 0.5; }
      else if (s.ghostT < 0.1) s.ghostT = 0.15; // hâlâ içindeyse hayaleti uzat
    }

    // --- dikey fizik ---
    if (s.jetT > 0) {
      s.y += (3.1 - s.y) * Math.min(1, d * 3.5);
      s.vy = 0;
      s.grounded = false;
    } else {
      const wasGrounded = s.grounded;
      if (wasGrounded && support > s.y && support - s.y < 0.6) {
        s.y = support; // rampada yürüyerek tırman
      }
      s.vy += GRAVITY * d;
      s.y += s.vy * d;
      if (s.y <= support) { s.y = support; s.vy = 0; s.grounded = true; }
      else s.grounded = false;
    }

    // --- bariyerler ---
    for (const e of ents) {
      if (e.kind !== "low" && e.kind !== "overhead") continue;
      if (e.lane !== lane || e.hit) continue;
      const wz = s.D + e.localZ;
      if (wz < -0.75 || wz > 0.75) continue;
      e.hit = true;
      if (s.jetT > 0 || s.ghostT > 0) continue;
      const fail = e.kind === "low" ? s.y < 0.75 : s.slideT <= 0 && s.y < 2.55;
      if (fail) { onStumble(); s.ghostT = GHOST_TIME; s.slowT = 1.2; s.shake = 0.5; }
    }

    // --- pano dalgası geçişi ---
    for (const e of ents) {
      if (e.kind !== "gate" || e.crossed) continue;
      const wz = s.D + e.localZ;
      if (wz >= -0.6) { e.crossed = true; onGateCross(e.id); }
    }

    // --- altınlar ---
    for (const e of ents) {
      if (e.kind !== "coins") continue;
      for (let i = 0; i < e.count!; i++) {
        if (e.taken![i]) continue;
        const wz = s.D + e.localZ + i * 1.7;
        const magnetHit = s.magT > 0 && Math.abs(wz) < 4;
        const normalHit = e.lane === lane && Math.abs(wz) < 0.9 && Math.abs(s.y + 0.9 - e.y!) < 1.3;
        if (magnetHit || normalHit) { e.taken![i] = true; onCoin(); }
      }
    }

    // --- pano dalgası zamanlaması ---
    if (!gateActive.current && s.jetT <= 0) {
      gateCool.current -= d;
      if (gateCool.current <= 0) {
        // panonun önü açık mı? (yerel -72..-54 bandı boş olmalı)
        let blocked = false;
        for (const e of ents) {
          if (e.kind === "gate" || e.kind === "coins") continue;
          const wz = s.D + e.localZ + (e.extraZ ?? 0);
          const back = wz - (e.len ?? 0);
          if (back < -52 && wz > -74) { blocked = true; break; }
        }
        if (!blocked) {
          gateActive.current = true;
          gateCool.current = 1.6;
          onSpawnGate();
        } else {
          gateCool.current = 0.35;
        }
      }
    }

    // --- engel sıraları ---
    if (s.D >= nextObsD.current) {
      // pano yakınında engel yok (yerel −100..−60 bandında pano varsa bekle)
      let nearGate = false;
      for (const e of ents) {
        if (e.kind !== "gate") continue;
        const wz = s.D + e.localZ;
        if (wz > -100 && wz < -58) { nearGate = true; break; }
      }
      if (!nearGate) {
        onSpawnRow(OBST_Z - s.D);
        const gap = Math.max(13, 19 - s.D * 0.004);
        nextObsD.current = s.D + gap + Math.random() * 6;
      } else {
        nextObsD.current = s.D + 4;
      }
    }

    // --- temizlik ---
    cleanupT.current -= d;
    if (cleanupT.current <= 0) {
      cleanupT.current = 0.5;
      const dead: number[] = [];
      for (const e of ents) {
        const wz = s.D + e.localZ + (e.extraZ ?? 0);
        const tail = e.kind === "coins" ? -(e.count! * 1.7) : (e.len ?? 0);
        if (wz - tail > DESPAWN_Z) dead.push(e.id);
      }
      if (dead.length) onDespawn(dead);
    }
  });
  return null;
}

// ================= oyun sayfası =================

const SubwayGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";

  const sim = useRef<Sim>({
    running: false, speed: BASE_SPEED, D: 0, lane: 1, x: 0, y: 0, vy: 0,
    grounded: true, slideT: 0, ghostT: 0, slowT: 0, jetT: 0, x2T: 0, magT: 0, shake: 0,
  });
  const worldRef = useRef<THREE.Group | null>(null);
  const gateActive = useRef(false);
  const entsRef = useRef<Ent[]>([]);
  const laneEnd = useRef<[number, number, number]>([99, 99, 99]); // şerit başına son trenin arka ucu (yerel z)
  const streakRef = useRef(0);

  const [ents, setEnts] = useState<Ent[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "good" | "bad" | "power" } | null>(null);
  const [pu, setPu] = useState<{ jet: number; x2: number; mag: number }>({ jet: 0, x2: 0, mag: 0 });
  const [fontTick, setFontTick] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { entsRef.current = ents; }, [ents]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { sim.current.running = !paused && !gameOver; }, [paused, gameOver]);
  useEffect(() => { sim.current.speed = Math.min(MAX_SPEED, BASE_SPEED + score * 0.05); }, [score]);

  // Arapça font geç yüklendiyse pano dokularını tazele
  useEffect(() => {
    let alive = true;
    try {
      document.fonts.load('330px "Amiri Quran"', "بَ").then(() => {
        if (alive) { texCache.clear(); setFontTick((t) => t + 1); }
      });
    } catch { /* ignore */ }
    return () => { alive = false; };
  }, []);

  // Güç göstergesi — düşük frekans HUD güncellemesi
  useEffect(() => {
    const id = setInterval(() => {
      const s = sim.current;
      setPu((prev) => {
        if (prev.jet === s.jetT && prev.x2 === s.x2T && prev.mag === s.magT) return prev;
        return { jet: s.jetT, x2: s.x2T, mag: s.magT };
      });
    }, 200);
    return () => clearInterval(id);
  }, []);

  const showBanner = useCallback((text: string, tone: "good" | "bad" | "power", ms = 1600) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ text, tone });
    bannerTimer.current = setTimeout(() => setBanner(null), ms);
  }, []);

  // --- spawn yardımcıları ---

  const addEnts = useCallback((items: Ent[]) => {
    setEnts((prev) => [...prev, ...items]);
  }, []);

  const spawnGate = useCallback(() => {
    const pool = gamePool();
    if (pool.length < 3) { gateActive.current = false; return; }
    const target = pickNextGameItem(pool) || pool[0];
    const wrongs = pickN(pool.filter((p) => p.id !== target.id && p.emoji !== target.emoji), 2);
    if (wrongs.length < 2) { gateActive.current = false; return; }
    const items = shuffle([target, ...wrongs]);
    const targetLane = items.findIndex((i) => i.id === target.id);
    const s = sim.current;
    const localZ = GATE_Z - s.D;
    const noOncoming = !entsRef.current.some((e) => e.kind === "oncoming");
    const lanesOk = [0, 1, 2].every((l) => localZ + 13 <= laneEnd.current[l] - 10);
    const elevated = score >= 30 && noOncoming && lanesOk && Math.random() < 0.25;
    const batch: Ent[] = [];
    if (elevated) {
      // 3 şeritte rampalı trenler — pano tren üstü hizasında
      for (let l = 0; l < 3; l++) {
        const tz = localZ + 13;
        batch.push({ id: UID++, kind: "train", lane: l, localZ: tz, len: 17, ramp: true, color: TRAIN_COLORS[l % TRAIN_COLORS.length] });
        laneEnd.current[l] = Math.min(laneEnd.current[l], tz - 17);
      }
      // orta şeride tren üstü altınları
      batch.push({ id: UID++, kind: "coins", lane: 1, localZ: localZ + 4, count: 4, y: TRAIN_TOP + 0.7, taken: [false, false, false, false] });
    } else {
      // pano arkasına yer altını — trenle çakışmayan bir şeride
      const freeLanes = [0, 1, 2].filter((l) => localZ - 18 <= laneEnd.current[l] - 11);
      if (freeLanes.length) {
        const l = freeLanes[Math.floor(Math.random() * freeLanes.length)];
        batch.push({ id: UID++, kind: "coins", lane: l, localZ: localZ - 18, count: 4, y: 0.7, taken: [false, false, false, false] });
      }
    }
    batch.push({ id: UID++, kind: "gate", localZ, target, items, targetLane, elevated, crossed: false, resolution: null });
    addEnts(batch);
    setQuestion(target.translit || target.label);
    playItem(target);
  }, [score, addEnts]);

  const spawnRow = useCallback((localZ: number) => {
    const batch: Ent[] = [];
    const usedLanes = new Set<number>();
    // Şerit müsait mi: önceki trenin arkasından en az `gap` birim geride
    const laneClear = (l: number, gap = 4) => localZ <= laneEnd.current[l] - gap;
    const oncomingLanes = new Set(
      entsRef.current.filter((e) => e.kind === "oncoming").map((e) => e.lane!),
    );
    const lanes = shuffle([0, 1, 2]);
    const kind = Math.random();

    if (kind < 0.34) {
      // 1-2 park treni (bazısı rampalı, üstünde altın).
      // Aynı şeritte iki tren arası en az 14 birim — dar boşluk tuzağı olmasın.
      const n = Math.random() < 0.45 ? 2 : 1;
      for (let i = 0; i < n && i < 2; i++) {
        const l = lanes[i];
        const len = 8 + Math.floor(Math.random() * 5);
        if (!laneClear(l, 14) || oncomingLanes.has(l)) continue;
        const ramp = Math.random() < 0.35;
        batch.push({ id: UID++, kind: "train", lane: l, localZ, len, ramp, color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)] });
        laneEnd.current[l] = Math.min(laneEnd.current[l], localZ - len);
        usedLanes.add(l);
        if (ramp) {
          const c = Math.min(4, Math.floor((len - 3) / 1.7));
          batch.push({ id: UID++, kind: "coins", lane: l, localZ: localZ - len + 2, count: c, y: TRAIN_TOP + 0.7, taken: Array.from({ length: c }, () => false) });
        }
      }
    } else if (kind < 0.48 && oncomingLanes.size === 0 && score >= 10) {
      // Karşıdan gelen tren (aynı anda en fazla 1). İleri doğru tüm sahayı
      // kat edeceği için şeridinde HİÇ park treni olmamalı — yoksa içinden
      // geçip üstteki oyuncuya haksız çarpar.
      const l = lanes.find((cand) =>
        laneClear(cand, 5) &&
        !entsRef.current.some((e) => e.kind === "train" && e.lane === cand),
      );
      if (l !== undefined) {
        batch.push({ id: UID++, kind: "oncoming", lane: l, localZ: localZ - 14, len: 9, extraZ: 0 });
        usedLanes.add(l);
      }
    } else if (kind < 0.74) {
      // alçak bariyer (zıpla) — 1-2 şerit
      const n = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const l = lanes[i];
        if (!laneClear(l)) continue;
        batch.push({ id: UID++, kind: "low", lane: l, localZ });
        usedLanes.add(l);
      }
    } else {
      // üst tabela (kay) — 1-2 şerit
      const n = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const l = lanes[i];
        if (!laneClear(l)) continue;
        batch.push({ id: UID++, kind: "overhead", lane: l, localZ });
        usedLanes.add(l);
      }
    }
    // boş bir şeride altın dizisi (dizi +z yönüne uzanır — önceki trene taşmasın)
    if (Math.random() < 0.55) {
      const free = [0, 1, 2].filter((l) => !usedLanes.has(l) && !oncomingLanes.has(l) && laneClear(l, 11));
      if (free.length) {
        const l = free[Math.floor(Math.random() * free.length)];
        batch.push({ id: UID++, kind: "coins", lane: l, localZ, count: 5, y: 0.7, taken: Array.from({ length: 5 }, () => false) });
      }
    }
    if (batch.length) addEnts(batch);
  }, [score, addEnts]);

  const spawnAirCoins = useCallback(() => {
    const s = sim.current;
    addEnts([{ id: UID++, kind: "coins", lane: Math.floor(Math.random() * 3), localZ: -34 - s.D, count: 4, y: 3.1, taken: [false, false, false, false] }]);
  }, [addEnts]);

  // --- olaylar ---

  const gateCross = useCallback((gateId: number) => {
    const gate = entsRef.current.find((e) => e.id === gateId);
    if (!gate || gate.resolution) return;
    const s = sim.current;
    if (s.jetT > 0) { gateActive.current = false; return; } // uçarken pas
    const lane = nearestLane(s.x);
    const correct = lane === gate.targetLane;
    recordLetterMastery(gate.target!.id, correct);
    recordGameAnswer(gate.target!, correct);
    setEnts((prev) => prev.map((e) => (e.id === gateId ? { ...e, resolution: { lane, correct } } : e)));
    gateActive.current = false;

    if (correct) {
      playFeedback(true);
      setStreak((st) => st + 1);
      setScore((sc) => sc + (10 + Math.min(streakRef.current, 5) * 2) * (s.x2T > 0 ? 2 : 1));
      if (s.jetT <= 0 && s.x2T <= 0 && s.magT <= 0) {
        const r = Math.random();
        if (r < 0.15) { s.jetT = JET_TIME; showBanner("🚀 JETPACK! Altınları topla!", "power", 1800); }
        else if (r < 0.28) { s.x2T = X2_TIME; showBanner("⭐ 2X PUAN!", "power"); }
        else if (r < 0.42) { s.magT = MAG_TIME; showBanner("🧲 MIKNATIS!", "power"); }
      }
    } else {
      playFeedback(false);
      setStreak(0);
      setScore((sc) => Math.max(0, sc - 5));
      s.shake = 0.5;
      if (isSuper) enqueueRetryItem(gate.target!);
      showBanner(`Doğrusu: ${gate.target!.translit || gate.target!.label}`, "bad", 1800);
      setLives((l) => {
        const nl = l - 1;
        if (nl <= 0) setGameOver(true);
        return nl;
      });
    }
  }, [isSuper, showBanner]);

  const stumble = useCallback(() => {
    playFeedback(false);
    setStreak(0);
    setLives((l) => {
      const nl = l - 1;
      if (nl <= 0) setGameOver(true);
      return nl;
    });
  }, []);

  const onCoin = useCallback(() => {
    setScore((sc) => sc + 2 * (sim.current.x2T > 0 ? 2 : 1));
  }, []);

  const despawn = useCallback((ids: number[]) => {
    const set = new Set(ids);
    setEnts((prev) => prev.filter((e) => !set.has(e.id)));
  }, []);

  const onTimersEnd = useCallback(() => {
    const s = sim.current;
    setPu({ jet: s.jetT, x2: s.x2T, mag: s.magT });
  }, []);

  // --- kontroller ---

  const move = useCallback((dir: -1 | 1) => {
    const s = sim.current;
    if (!s.running) return;
    s.lane = Math.max(0, Math.min(2, s.lane + dir));
  }, []);
  const jump = useCallback(() => {
    const s = sim.current;
    if (!s.running || s.jetT > 0) return;
    if (s.grounded) { s.vy = JUMP_V; s.grounded = false; s.slideT = 0; }
  }, []);
  const slide = useCallback(() => {
    const s = sim.current;
    if (!s.running || s.jetT > 0) return;
    if (s.grounded) s.slideT = SLIDE_TIME;
  }, []);
  const replay = useCallback(() => {
    const gate = entsRef.current.find((e) => e.kind === "gate" && !e.resolution);
    const t = (gate?.target) ?? null;
    if (t) playItem(t);
  }, []);
  const start = useCallback(() => {
    if (gameOver) return;
    setStarted(true);
    setPaused(false);
  }, [gameOver]);

  const reset = useCallback(() => {
    setEnts([]); setScore(0); setStreak(0); setLives(3);
    setGameOver(false); setPaused(true); setStarted(false);
    setQuestion(null); setBanner(null); setPu({ jet: 0, x2: 0, mag: 0 });
    gateActive.current = false;
    laneEnd.current = [99, 99, 99];
    sim.current = {
      running: false, speed: BASE_SPEED, D: 0, lane: 1, x: 0, y: 0, vy: 0,
      grounded: true, slideT: 0, ghostT: 0, slowT: 0, jetT: 0, x2T: 0, magT: 0, shake: 0,
    };
    if (worldRef.current) worldRef.current.position.z = 0;
  }, []);

  // klavye
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); move(-1); }
      else if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); move(1); }
      else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
        e.preventDefault();
        if (paused && !gameOver) start(); else jump();
      }
      else if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); slide(); }
      else if (e.code === "KeyR") { e.preventDefault(); replay(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [move, jump, slide, replay, start, paused, gameOver]);

  // dokunma: 4 yönlü kaydırma + kenar dokunuşu
  const ptr = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    ptr.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = ptr.current;
    ptr.current = null;
    if (paused && !gameOver) { start(); return; }
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > 26 || Math.abs(dy) > 26) {
      if (Math.abs(dx) >= Math.abs(dy)) move(dx > 0 ? 1 : -1);
      else if (dy < 0) jump();
      else slide();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    if (rel < 0.34) move(-1);
    else if (rel > 0.66) move(1);
    else replay();
  };

  // ipucu: normal modda her zaman, süper modda yalnız seviye 1
  const hintLaneOf = (e: Ent) => {
    const lvl = getGameItemLevel(e.target!);
    return !isSuper || lvl === 1 ? e.targetLane! : -1;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🏃 ElifBâ Koşusu" backTo="/oyunlar" centered onReset={reset} />

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
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="relative w-full overflow-hidden rounded-2xl shadow-card border-4 border-info/40 select-none touch-none"
          style={{ aspectRatio: "4 / 5", maxHeight: "62vh", margin: "0 auto", contain: "layout paint size" }}
        >
          <Canvas
            dpr={[1, 1.75]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{ fov: 64, near: 0.1, far: 115, position: [0, 4.7, 8.6] }}
            onCreated={({ gl }) => { MAX_ANISO = gl.capabilities.getMaxAnisotropy(); }}
          >
            <color attach="background" args={["#bfe4f7"]} />
            <fog attach="fog" args={["#bfe4f7", 40, 95]} />
            <ambientLight intensity={0.85} />
            <directionalLight position={[4, 9, 4]} intensity={0.9} />
            <Ground />
            <Rails />
            <Sleepers sim={sim} />
            <Scenery sim={sim} />
            <Clouds sim={sim} />
            <Player sim={sim} />
            <group ref={worldRef}>
              {ents.map((e) => {
                switch (e.kind) {
                  case "train": return <TrainEnt key={e.id} e={e} />;
                  case "oncoming": return <OncomingEnt key={e.id} e={e} sim={sim} />;
                  case "low": return <LowBarrierEnt key={e.id} e={e} />;
                  case "overhead": return <OverheadEnt key={e.id} e={e} />;
                  case "coins": return <CoinsEnt key={e.id} e={e} />;
                  case "gate": return <GateEnt key={e.id} e={e} hintLane={hintLaneOf(e)} fontTick={fontTick} />;
                  default: return null;
                }
              })}
            </group>
            <Director
              sim={sim}
              entsRef={entsRef}
              worldRef={worldRef}
              gateActive={gateActive}
              onSpawnGate={spawnGate}
              onSpawnRow={spawnRow}
              onAirCoins={spawnAirCoins}
              onGateCross={gateCross}
              onStumble={stumble}
              onCoin={onCoin}
              onDespawn={despawn}
              onTimersEnd={onTimersEnd}
            />
          </Canvas>

          {/* güç rozetleri */}
          <div className="pointer-events-none absolute top-2 right-2 z-20 flex flex-col gap-1 items-end">
            {pu.jet > 0 && (
              <span className="rounded-full bg-info/90 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-soft">🚀 {Math.ceil(pu.jet)}s</span>
            )}
            {pu.x2 > 0 && (
              <span className="rounded-full bg-primary/90 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-soft">⭐2X {Math.ceil(pu.x2)}s</span>
            )}
            {pu.mag > 0 && (
              <span className="rounded-full bg-warning/90 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-soft">🧲 {Math.ceil(pu.mag)}s</span>
            )}
          </div>

          {/* duraklat */}
          {!paused && !gameOver && (
            <button
              onClick={() => setPaused(true)}
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

          {/* başlangıç — ilk açılışta tam talimat */}
          {paused && !started && !gameOver && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/85">
              <div className="text-5xl mb-2">🏃</div>
              <div className="text-xl font-extrabold text-info mb-1">Hazır mısın?</div>
              <div className="text-sm font-bold text-muted-foreground text-center px-6 leading-relaxed">
                Sesi dinle, doğru harfin panosundan geç!<br />
                ⬅➡ şerit • ⬆ zıpla • ⬇ kay<br />
                Engellerin üstünde koşabilirsin<br />
                <span className="text-info">Başlamak için dokun</span>
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
                className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-extrabold shadow-soft active:scale-95"
              >
                Tekrar Oyna
              </button>
            </div>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground">
          Kaydır: ⬅➡ şerit, ⬆ zıpla, ⬇ kay • Engellere zıpla, üstünde koş, altın topla!
        </p>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <button
            onClick={() => move(-1)}
            aria-label="Sola geç"
            className="rounded-2xl bg-primary text-primary-foreground py-4 font-extrabold shadow-soft active:scale-95 flex items-center justify-center"
          >
            <ArrowLeft className="h-7 w-7" />
          </button>
          <button
            onClick={jump}
            aria-label="Zıpla"
            className="rounded-2xl bg-info text-info-foreground py-4 font-extrabold shadow-soft active:scale-95 flex items-center justify-center"
          >
            <ArrowUp className="h-7 w-7" />
          </button>
          <button
            onClick={slide}
            aria-label="Kay"
            className="rounded-2xl bg-warning text-warning-foreground py-4 font-extrabold shadow-soft active:scale-95 flex items-center justify-center"
          >
            <ArrowDown className="h-7 w-7" />
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Sağa geç"
            className="rounded-2xl bg-primary text-primary-foreground py-4 font-extrabold shadow-soft active:scale-95 flex items-center justify-center"
          >
            <ArrowRight className="h-7 w-7" />
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

export default SubwayGame;
