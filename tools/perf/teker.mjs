// TEKERLEK ÖLÇÜMÜ (Yarışı) — ön tekerlek gerçekten yerde mi, doğru mu dönüyor?
//
// ⚠️ NEDEN ÖLÇÜM: "tekerlekler havadaymış gibi" bildirimi göz kararıyla
// çözülmez; iki AYRI kusur aynı görüntüyü veriyor ve hangisinin ne kadar
// katkı yaptığı ancak sayıyla ayrılır:
//   (1) GÖVDE EĞİMİ tekerleği de eğiyorsa dış teker yerden KALKAR,
//   (2) yuvarlanma (X) ile direksiyon (Y) AYNI Euler'de ise direksiyon ekseni
//       yuvarlanmayla birlikte döner → tekerlek takla atıyormuş gibi salınır
//       (Unity forumlarında klasik "ön teker gimbal" sorunu).
//
// Ölçülen iki sayı, ikisi de yarışmacının kendi çerçevesinde:
//   · AKS EĞİMİ  — tekerlek aksının yatayla yaptığı açı (derece). Gerçek
//     tekerlekte 0'dır; büyükse tekerlek yan yatmış görünür.
//   · YERDEN AÇIKLIK — tekerleğin EN ALT noktasının y'si. 0 = yere basıyor,
//     + = havada, − = yere gömülü.
//
// Kullanım:  node tools/perf/teker.mjs
import * as THREE from "three";

const RAD = 0.62;        // ön tekerlek yarıçapı (CylinderGeometry 0.62)
const WX = 1.25;         // ön tekerleklerin yanal yeri (±)
const WZ = 1.25;         // ön tekerleklerin ileri yeri (+Z = ön)
const EGIM = 0.22;       // gövde eğimi katsayısı (drift × EGIM)
const DIR_K = 0.4;       // eski direksiyon katsayısı (drift × DIR_K)

/** Tekerleğin aksı (yerel X) ve en alt noktası — yarışmacı çerçevesinde. */
function olc(wheelNode, kok) {
  kok.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  wheelNode.getWorldQuaternion(q);
  const aks = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
  const merkez = new THREE.Vector3();
  wheelNode.getWorldPosition(merkez);
  // Aksı `aks` olan R yarıçaplı diskin en alt noktası:
  //   ymin = merkez.y − R·√(1 − aks.y²)
  const enAlt = merkez.y - RAD * Math.sqrt(Math.max(0, 1 - aks.y * aks.y));
  return { aksEgimi: Math.abs(Math.asin(THREE.MathUtils.clamp(aks.y, -1, 1))) * 180 / Math.PI, enAlt };
}

/** ESKİ kurulum: teker doğrudan gövdenin çocuğu; X (yuvarlanma) + Y (direksiyon) aynı Euler'de. */
function eski(drift, roll) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.rotation.z = -drift * EGIM;
  const w = new THREE.Group();
  w.position.set(-WX, RAD, WZ);          // sağ ön (yerel −X = sağ)
  w.rotation.x = -roll;
  w.rotation.y = -drift * DIR_K;
  body.add(w);
  return olc(w, group);
}

/** YENİ kurulum: gövde eğimi KABUKTA; teker göbeği (Y) ayrı, yuvarlanma (X) onun çocuğunda. */
function yeni(drift, roll, steer) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const shell = new THREE.Group();
  shell.rotation.z = -drift * EGIM;      // yalnız kabuk yatar
  body.add(shell);
  const hub = new THREE.Group();
  hub.position.set(-WX, RAD, WZ);
  hub.rotation.y = steer;
  body.add(hub);                          // ⚠️ kabuğun DEĞİL gövdenin çocuğu
  const w = new THREE.Group();
  w.rotation.x = -roll;
  hub.add(w);
  return olc(w, group);
}

const N = 240;
for (const drift of [0.25, 0.6, 1.0]) {
  let eEgimMax = 0, eEgimTop = 0, eAcikMax = 0;
  let yEgimMax = 0, yAcikMax = 0;
  for (let i = 0; i < N; i++) {
    const roll = (i / N) * Math.PI * 2 * 3;   // yuvarlanma açısı sürekli büyür
    const e = eski(drift, roll);
    const y = yeni(drift, roll, -drift * DIR_K);
    eEgimMax = Math.max(eEgimMax, e.aksEgimi); eEgimTop += e.aksEgimi;
    eAcikMax = Math.max(eAcikMax, e.enAlt);
    yEgimMax = Math.max(yEgimMax, y.aksEgimi);
    yAcikMax = Math.max(yAcikMax, Math.abs(y.enAlt));
  }
  console.log(`drift ${drift.toFixed(2)}`);
  console.log(`  ESKİ  aks eğimi: en çok ${eEgimMax.toFixed(1)}° · ortalama ${(eEgimTop / N).toFixed(1)}°   | yerden açıklık ${eAcikMax.toFixed(3)} (yarıçapın %${(eAcikMax / RAD * 100).toFixed(0)}'i)`);
  console.log(`  YENİ  aks eğimi: en çok ${yEgimMax.toFixed(1)}°                     | yerden açıklık ${yAcikMax.toFixed(3)}`);
}

// ---- ACKERMANN: iç tekerlek dıştakinden ne kadar fazla döner? ----
// cot δ_dış = cot δ_iç + iz/dingil.  Kart: iz 2.5, dingil 2.6 → oran 0.96,
// yani fark GÖZLE GÖRÜLÜR (gerçek binek araçta oran ~0.6 civarı).
const WHEELBASE = 2.6, TRACK_W = 2.5;
console.log("\nAckermann (dingil 2.6 · iz 2.5):");
for (const d of [0.10, 0.25, 0.42, 0.52]) {
  const R = WHEELBASE / Math.tan(d);
  const ic = Math.atan(WHEELBASE / Math.max(0.4, R - TRACK_W / 2));
  const di = Math.atan(WHEELBASE / (R + TRACK_W / 2));
  const g = (x) => (x * 180 / Math.PI).toFixed(1);
  console.log(`  ortalama ${g(d)}° → iç ${g(ic)}° · dış ${g(di)}°  (fark ${g(ic - di)}°)`);
}

// ---- KAVİS PAYI: bisiklet modeli δ = atan(L·κ) ----
// Pistin ölçülen eğrilikleri (kapı yerleştirme çalışmasından): kapı
// yaklaşımlarında κ ≤ 0.0102, en sert viraj ≈ 0.042.
console.log("\nkavis payı (δ = atan(L·κ)):");
for (const k of [0.0102, 0.019, 0.042]) {
  console.log(`  κ=${k} → ${(Math.atan(WHEELBASE * k) * 180 / Math.PI).toFixed(1)}°`);
}

// Strobe (araba tekerleği geriye dönüyor gibi) sınırı: N kollu göbek, dt sn kare.
console.log("\nstrobe sınırı — göbek kolu sayısına göre en yüksek görsel açısal hız (rad/sn):");
for (const kol of [2, 3, 5, 8]) {
  for (const fps of [60, 30]) {
    console.log(`  ${kol} kol @ ${fps}fps → ${(Math.PI / kol * fps).toFixed(1)} rad/sn`);
  }
}
console.log(`gerçek yuvarlanma hızı: v/R = 40/${RAD} = ${(40 / RAD).toFixed(1)} rad/sn (v=40 birim/sn)`);
