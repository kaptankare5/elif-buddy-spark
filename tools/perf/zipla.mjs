// ZIPLAMA YAYI ÖLÇÜMÜ — asimetrik yerçekimi bölüm tasarımını bozuyor mu?
//
// ⚠️ NEDEN: Macera'nın blokları "zıplama tepesi ≈115px" varsayımıyla
// yerleştirildi ve uçurumlar havada kalma süresine göre. Yerçekimini
// değiştirmek ikisini de kaydırabilir — değiştirmeden ÖNCE ölçülmeli.
//
// Çalıştırma: node tools/perf/zipla.mjs
const GRAVITY = 1900, JUMP_V = -660, MAX_FALL = 1500, SPEED = 250;
const APEX_ESIK = 130, APEX_CARPAN = 0.55, DUSUS_CARPANI = 2.0;
const DT = 1 / 240; // ölçüm adımı (oyun 60 fps, burada çözünürlük için ince)

function sim(asimetrik) {
  let y = 0, vy = JUMP_V, t = 0, tepe = 0;
  while (t < 3) {
    const k = !asimetrik ? 1
      : Math.abs(vy) < APEX_ESIK ? APEX_CARPAN : vy > 0 ? DUSUS_CARPANI : 1;
    vy = Math.min(vy + GRAVITY * k * DT, MAX_FALL);
    y += vy * DT;
    t += DT;
    tepe = Math.min(tepe, y);
    if (y >= 0) break;              // başladığı yüksekliğe döndü
  }
  return { tepe: -tepe, sure: t, mesafe: SPEED * t };
}

const eski = sim(false), yeni = sim(true);
const yuzde = (a, b) => `${(((b - a) / a) * 100).toFixed(1)}%`;
console.log("                 eski      yeni     fark");
console.log(`tepe (px)      ${eski.tepe.toFixed(1).padStart(7)}  ${yeni.tepe.toFixed(1).padStart(7)}   ${yuzde(eski.tepe, yeni.tepe)}`);
console.log(`havada (sn)    ${eski.sure.toFixed(3).padStart(7)}  ${yeni.sure.toFixed(3).padStart(7)}   ${yuzde(eski.sure, yeni.sure)}`);
console.log(`yatay (px)     ${eski.mesafe.toFixed(0).padStart(7)}  ${yeni.mesafe.toFixed(0).padStart(7)}   ${yuzde(eski.mesafe, yeni.mesafe)}`);

// Tepede geçirilen süre: "asılı kalma" gerçekten arttı mı?
function apexSuresi(asimetrik) {
  let vy = JUMP_V, t = 0, apex = 0;
  while (t < 3 && vy < MAX_FALL) {
    const k = !asimetrik ? 1
      : Math.abs(vy) < APEX_ESIK ? APEX_CARPAN : vy > 0 ? DUSUS_CARPANI : 1;
    if (Math.abs(vy) < APEX_ESIK) apex += DT;
    vy += GRAVITY * k * DT;
    t += DT;
    if (vy > 400) break;
  }
  return apex;
}
console.log(`\ntepede (|vy|<${APEX_ESIK}) geçen süre: ${apexSuresi(false).toFixed(3)} → ${apexSuresi(true).toFixed(3)} sn`);
console.log("(uzun apex = havada nişan alma kolaylığı; hızlı iniş = tepkisellik)");
