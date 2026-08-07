// 🐞 Debug HUD — yalnız TEST MODUNDA (Ayarlar'da 1234) görünür.
//
// Amaç: gizli sistemleri ELLE doğrulamak. Cevap verdikçe canlı güncellenir;
// test/flashcard/oyunlar dahil her sayfada görünür. Gösterdikleri:
// - Uyarlanır zorluk: anlık doğruluk (son 12) + hangi bant (ısınma/normal/
//   zorlanıyor→kolay/uçuyor→zor) → cevaplayınca bandın değiştiğini gör.
// - Öğrenme seti kapısı (Problem 1): kaç harf öğrenilmekte (K), zorlanıyor mu,
//   yeni harf tanıtımı şu an kapalı mı → yeni harf akışının durduğunu gör.
// - ⭐ Ustalık merdiveni: L1-L5 dağılımı + vadesi gelen + mezun olan sayısı.
// - Son cevap: seviye geçişi, kanıt puanı (üretim 1 / tanıma ½), takvim günü
//   ve "aynı gün mü" bayrağı → rozet neden kıpırdamadı sorusu burada cevaplanır.
// - İleri yoklama (SPRT): sıradaki kilitli konu, biriken kanıt ve eşik çizgileri.
// - Son seçilen öğe: seviye + bilet (sıklık × bayatlık) + kaç gün bayat.
// - Yerleştirme (Problem 2): atlanan konular, ara-kontrol doğruluğu + oranı,
//   durum (deneme/onaylı/sallantı/zayıf) + son sorunun ara-kontrol olup olmadığı.
// - Karışıklık ısısı: çocuk hangi harfi hangisiyle karıştırıyor (Elif↔Lem
//   gibi) — ısı yükseldikçe o çift daha sık ve BİRLİKTE sorulur; üst üste
//   3 doğru ayrımda ısı düşer. "ok" sütunu ayrım sayacıdır.
// - Seri (affedici) + bugünkü öğrenilen/pratik sayısı (veli paneli verisi).
import { useEffect, useState } from "react";
import { useTestUnlock } from "@/lib/testUnlock";
import {
  getAdaptiveDebug, getLastPickInfo, getIntroGateInfo, getTopicSrs, getLastAnswerInfo,
  isDue, isGraduated, MASTERY,
  type AdaptiveDebug, type LastPickInfo, type IntroGateInfo, type LastAnswerInfo, type Level,
} from "@/data/srs";
import { nextLockedTopic, probeInfo, skipOffered, PROBE_LIMITS } from "@/lib/forwardProbe";
import { getPlacementDebug, getLastBackCheck, resetPlacement, type PlacementDebugRow } from "@/lib/placement";
import { getConfusionDebug, resetConfusion, CONFUSION_EVENT } from "@/lib/confusion";
import { currentReviewShare } from "@/lib/review";
import { getStreak } from "@/lib/streak";
import { skillIdsOf } from "@/lib/skills";
import { practiceItems, getUnlockedTopicIds } from "@/lib/unlock";
import { getAllTopics } from "@/data/subjects";
import { cn } from "@/lib/utils";

// Bütün alıştırmalı konularda seviye dağılımı + vade/mezuniyet sayacı.
// (Beceri anahtarıyla okunur — öğe id'siyle sayarsak Harekeler boş görünür.)
function ladderCounts() {
  const lvl: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let due = 0, mezun = 0;
  const now = Date.now();
  for (const t of getAllTopics()) {
    if (t.noPractice) continue;
    const srs = getTopicSrs("quiz", t.id);
    for (const sk of skillIdsOf(practiceItems(t.items))) {
      const e = srs[sk];
      if (!e || (e.seen ?? 0) === 0) continue;
      lvl[e.level as Level]++;
      if (isGraduated(e)) mezun++;
      else if (isDue(e, now)) due++;
    }
  }
  return { lvl, due, mezun };
}

// Sıradaki KİLİTLİ konunun yoklama durumu (SPRT kanıt birikimi).
function probeState() {
  // "Şu anki konu" = açık konuların sonuncusu; yoklama onun ARDINDAKİ
  // kilitli konuyu ölçer.
  // ⚠️ TEST KİLİDİ (1234) BÜTÜN KONULARI AÇAR → kilitli konu kalmaz ve ileri
  // yoklama hiç çalışmaz. Panel test modunda göründüğü için bu bölüm hep boş
  // görünüyordu; bunu "veri yok" diye değil, SEBEBİYLE söylemek gerekiyor.
  const acik = getUnlockedTopicIds();
  const topics = getAllTopics().filter((t) => !t.noPractice && t.items.length > 0);
  const kilitli = topics.some((t) => !acik.has(t.id));
  // Kayıtlı kanıtı olan konular (kilit açılsa bile geçmiş yoklamalar durur)
  const kayitli = topics
    .map((t) => ({ topicId: t.id, ...probeInfo(t.id), teklif: skipOffered(t.id) }))
    .filter((r) => r.n > 0);
  const bos = { maskeli: !kilitli, kayitli, sira: null as null | { topicId: string; llr: number; n: number; teklif: boolean } };
  if (!kilitli) return bos;
  for (let i = topics.length - 1; i >= 0; i--) {
    if (!acik.has(topics[i].id)) continue;
    const next = nextLockedTopic(topics[i].id);
    if (!next) break;
    const p = probeInfo(next.id);
    return { ...bos, sira: { topicId: next.id, llr: p.llr, n: p.n, teklif: skipOffered(next.id) } };
  }
  return bos;
}

function todayCounts() {
  const d = new Date(); d.setHours(0, 0, 0, 0); const t0 = d.getTime();
  let learned = 0, practiced = 0;
  for (const t of getAllTopics()) {
    if (t.noPractice) continue;
    const srs = getTopicSrs("quiz", t.id);
    // Beceri anahtarıyla oku (skills.ts) — öğe id'siyle sayarsak
    // Harekeler/Şedde gibi konularda hiçbir şey görünmez.
    for (const sk of skillIdsOf(practiceItems(t.items))) {
      const e = srs[sk];
      if (!e) continue;
      if ((e.lastSeen ?? 0) >= t0) practiced++;
      if ((e.learnedAt ?? 0) >= t0) learned++;
    }
  }
  return { learned, practiced };
}

// Karışıklık çiftini okunur yap: "1|23" → "Elif↔Lem", "05:init|med" → "Cim başta↔ortada"
const FORM_TR: Record<string, string> = { init: "başta", med: "ortada", fin: "sonda" };
let _names: Map<number, string> | null = null;
function letterName(n: number): string {
  if (!_names) {
    _names = new Map();
    const harfler = getAllTopics().find((t) => t.id === "harfler");
    for (const it of harfler?.items ?? []) {
      const m = it.id.match(/^l1-(\d{2})$/);
      if (m) _names.set(parseInt(m[1], 10), it.translit || it.label);
    }
  }
  return _names.get(n) ?? `#${n}`;
}
function prettyPair(pair: string): string {
  if (pair.includes(":")) {
    const [nn, forms] = pair.split(":");
    const [a, b] = forms.split("|");
    return `${letterName(parseInt(nn, 10))} ${FORM_TR[a] ?? a}↔${FORM_TR[b] ?? b}`;
  }
  const [a, b] = pair.split("|").map(Number);
  return `${letterName(a)}↔${letterName(b)}`;
}

const LVL_COLOR = ["#94a3b8", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#f0b429"];
const STATUS_COLOR: Record<string, string> = {
  deneme: "#a855f7", // mor — deneme süresi (yoğun yoklama)
  onaylı: "#22c55e", // yeşil — sağlıklı
  sallantı: "#f59e0b", // amber — pekiştir
  zayıf: "#ef4444", // kırmızı — geri çekiliyor
};

export function DebugHud() {
  const [active] = useTestUnlock();
  const [open, setOpen] = useState(true);
  const [adaptive, setAdaptive] = useState<AdaptiveDebug>(() => getAdaptiveDebug());
  const [pick, setPick] = useState<LastPickInfo | null>(() => getLastPickInfo());
  const [gate, setGate] = useState<IntroGateInfo | null>(() => getIntroGateInfo());
  const [placement, setPlacement] = useState<PlacementDebugRow[]>(() => getPlacementDebug());
  const [lastBc, setLastBc] = useState(() => getLastBackCheck());
  const [streak, setStreak] = useState(() => getStreak());
  const [today, setToday] = useState(() => todayCounts());
  const [conf, setConf] = useState(() => getConfusionDebug());
  const [ladder, setLadder] = useState(() => ladderCounts());
  const [ans, setAns] = useState<LastAnswerInfo | null>(() => getLastAnswerInfo());
  const [probe, setProbe] = useState(() => probeState());

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      setAdaptive(getAdaptiveDebug());
      setPick(getLastPickInfo());
      setGate(getIntroGateInfo());
      setPlacement(getPlacementDebug());
      setLastBc(getLastBackCheck());
      setStreak(getStreak());
      setToday(todayCounts());
      setConf(getConfusionDebug());
      setLadder(ladderCounts());
      setAns(getLastAnswerInfo());
      setProbe(probeState());
    };
    // her cevap srs event'i yayar; ayrıca güvenlik için 800ms poll
    window.addEventListener("elifba-srs-quiz-updated", refresh);
    window.addEventListener("elifba-srs-games-updated", refresh);
    window.addEventListener("elifba-progress-updated", refresh);
    window.addEventListener("elifba-placement-updated", refresh);
    window.addEventListener(CONFUSION_EVENT, refresh);
    const id = setInterval(refresh, 800);
    return () => {
      window.removeEventListener("elifba-srs-quiz-updated", refresh);
      window.removeEventListener("elifba-srs-games-updated", refresh);
      window.removeEventListener("elifba-progress-updated", refresh);
      window.removeEventListener("elifba-placement-updated", refresh);
      window.removeEventListener(CONFUSION_EVENT, refresh);
      clearInterval(id);
    };
  }, [active]);

  if (!active) return null;

  const accPct = adaptive.accuracy === null ? "—" : `%${Math.round(adaptive.accuracy * 100)}`;
  const correctN = adaptive.recent.filter(Boolean).length;
  const bandColor =
    adaptive.band.includes("ZORLAN") ? "#3b82f6" :
    adaptive.band.includes("UÇUYOR") ? "#ef4444" :
    adaptive.band.includes("ISINMA") ? "#a855f7" : "#22c55e";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-2 bottom-20 z-[60] rounded-full bg-black/80 text-white text-[11px] font-extrabold px-3 py-1.5 shadow-lg"
      >🐞 Debug</button>
    );
  }

  return (
    <div className="fixed left-2 bottom-20 z-[60] w-[214px] rounded-xl bg-black/85 text-white shadow-2xl backdrop-blur border border-white/10 text-[11px] leading-tight font-mono">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
        <span className="font-extrabold text-[10px] tracking-wide">🐞 TEST DEBUG</span>
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-sm leading-none">×</button>
      </div>
      <div className="p-2.5 space-y-2">
        {/* Uyarlanır zorluk */}
        <div>
          <div className="text-white/50 text-[9px] uppercase mb-0.5">Uyarlanır Zorluk</div>
          <div className="font-extrabold" style={{ color: bandColor }}>{adaptive.band}</div>
          <div className="text-white/80">Doğruluk: <b>{accPct}</b> ({correctN}/{adaptive.count})</div>
          <div className="text-white/60 text-[10px]">eski-konu bakım payı ~%{Math.round(currentReviewShare() * 100)}</div>
          <div className="flex gap-0.5 mt-1">
            {adaptive.recent.slice(-12).map((c, i) => (
              <span key={i} className={cn("h-2 w-2 rounded-full")} style={{ background: c ? "#22c55e" : "#ef4444" }} />
            ))}
            {adaptive.recent.length === 0 && <span className="text-white/40">henüz cevap yok</span>}
          </div>
        </div>
        {/* Öğrenme seti kapısı (Problem 1) */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="text-white/50 text-[9px] uppercase mb-0.5">Öğrenme Seti (yeni harf kapısı)</div>
          {gate ? (
            <>
              <div className="text-white/80">
                Öğrenilmekte: <b className={cn(gate.inProgress >= gate.k && "text-amber-400")}>{gate.inProgress}</b>/{gate.k}
                {gate.struggling && <span className="text-blue-400"> · zorlanıyor</span>}
              </div>
              <div className="font-extrabold" style={{ color: gate.gated ? "#f59e0b" : "#22c55e" }}>
                {gate.gated ? "⛔ yeni harf DURDU" : gate.nextUnseen ? "✅ yeni harf açık" : "— hepsi görüldü"}
              </div>
              {gate.nextUnseen && <div className="text-white/50 text-[10px] truncate">sıradaki: {gate.nextUnseen}</div>}
            </>
          ) : <div className="text-white/40">henüz veri yok</div>}
        </div>
        {/* ⭐ USTALIK MERDİVENİ — 5 basamak + kanıt kuru + takvim.
            Bunlar görünmez çalışıyordu: çocuk doğru yapıyor, rozet kıpırdamıyor,
            sebebi belli olmuyordu. Burada "puan kaç, gün sayıldı mı, neden
            değişmedi" tek bakışta okunur. */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="text-white/50 text-[9px] uppercase mb-0.5">⭐ Ustalık Merdiveni</div>
          <div className="flex gap-0.5 mb-1">
            {([1, 2, 3, 4, 5] as const).map((l) => (
              <span key={l} className="flex-1 rounded text-center font-extrabold text-black py-0.5"
                style={{ background: LVL_COLOR[l] }}>{ladder.lvl[l]}</span>
            ))}
          </div>
          <div className="text-white/60 text-[10px]">
            vadesi gelen <b className={cn(ladder.due > 0 && "text-amber-400")}>{ladder.due}</b>
            {" · "}mezun <b>{ladder.mezun}</b>
            {" · "}L5 için <b>{MASTERY.NEEDED}</b> puan + <b>{MASTERY.MIN_DAYS}</b> gün
          </div>
        </div>
        {/* Son cevaba ne oldu (kanıt kuru + aynı gün kuralı elle doğrulanabilsin) */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="text-white/50 text-[9px] uppercase mb-0.5">Son Cevap</div>
          {ans ? (
            <>
              <div className="text-white/80 truncate">
                {ans.correct ? "✅" : "❌"} {ans.skillId}
                <span className="text-white/50"> · {ans.evidence === "production" ? "üretim (1p)" : "tanıma (½p)"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1 font-extrabold text-black" style={{ background: LVL_COLOR[Math.min(5, ans.levelBefore)] }}>L{ans.levelBefore}</span>
                <span className="text-white/50">→</span>
                <span className="rounded px-1 font-extrabold text-black" style={{ background: LVL_COLOR[Math.min(5, ans.levelAfter)] }}>L{ans.levelAfter}</span>
                {ans.levelAfter === ans.levelBefore && <span className="text-white/40 text-[10px]">değişmedi</span>}
              </div>
              <div className="text-white/60 text-[10px]">
                puan {ans.masteryBefore.toFixed(1)} → <b>{ans.masteryAfter.toFixed(1)}</b>/{MASTERY.NEEDED}
                {" · "}gün <b>{ans.step}</b>/{MASTERY.MIN_DAYS}
              </div>
              {/* ⚠️ "yeni gün" yalnız DOĞRU cevapta puan demek. Yanlışta gün
                  bilgisi anlamsız — orada olan şey puanın yarılanmasıdır. */}
              <div className="text-[10px]" style={{ color: !ans.correct ? "#ef4444" : ans.newDay ? "#22c55e" : "#f59e0b" }}>
                {!ans.correct ? "💥 yanlış — puan yarıya indi, seviye −2"
                  : ans.newDay ? "🗓 yeni gün — puan sayıldı"
                  : "🗓 AYNI GÜN — puan sayılmadı"}
                {ans.correct && !ans.fluent && <span className="text-amber-400"> · yavaş</span>}
              </div>
            </>
          ) : <div className="text-white/40">henüz cevap yok</div>}
        </div>
        {/* İleri yoklama (SPRT) — kilitli sıradaki konuyu gizlice ölçer */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="text-white/50 text-[9px] uppercase mb-0.5">İleri Yoklama (SPRT)</div>
          {probe.maskeli && (
            <div className="text-amber-400 text-[10px] mb-0.5">
              ⚠ test kilidi açık — her konu açık, yoklama çalışmaz
            </div>
          )}
          {probe.sira && (
            <>
              <div className="text-white/80 truncate">sıradaki: {probe.sira.topicId}</div>
              <div className="text-white/60 text-[10px]">
                kanıt <b style={{ color: probe.sira.llr >= PROBE_LIMITS.UST_CIZGI ? "#22c55e" : probe.sira.llr <= PROBE_LIMITS.ALT_CIZGI ? "#ef4444" : "#e5e7eb" }}>
                  {probe.sira.llr.toFixed(2)}
                </b> · {probe.sira.n} yoklama
              </div>
              {probe.sira.teklif && <div className="text-emerald-400 text-[10px]">✔ atlama teklifi verildi</div>}
            </>
          )}
          {!probe.maskeli && !probe.sira && <div className="text-white/40">kilitli konu yok</div>}
          {probe.kayitli.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {probe.kayitli.map((r) => (
                <div key={r.topicId} className="flex justify-between gap-1 text-[10px] text-white/60">
                  <span className="truncate">{r.topicId}</span>
                  <span><b>{r.llr.toFixed(2)}</b>/{r.n}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-white/40 text-[10px]">
            atlama ≥ {PROBE_LIMITS.UST_CIZGI.toFixed(2)} · bırak ≤ {PROBE_LIMITS.ALT_CIZGI.toFixed(2)}
          </div>
        </div>
        {/* Son seçim: sıklık × bayatlık */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="text-white/50 text-[9px] uppercase mb-0.5">Son Seçilen Öğe</div>
          {pick ? (
            <>
              <div className="text-white/80 truncate">{pick.id}</div>
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1 font-extrabold text-black" style={{ background: LVL_COLOR[Math.min(5, pick.level)] }}>
                  {pick.level === 0 ? "YENİ" : `L${pick.level}`}
                </span>
                <span className="text-white/80">bilet <b>{pick.ticket}</b></span>
              </div>
              <div className="text-white/60 text-[10px]">
                sıklık {pick.weight} × aciliyet {pick.stale}{pick.fragile ? " × kırılgan1.5" : ""}
                {pick.conf ? ` × karışıklık${(1 + 1.6 * pick.conf).toFixed(1)}` : ""} · {pick.days}g
              </div>
              {pick.retr !== undefined && (
                <div className="text-white/60 text-[10px]">
                  R <b style={{ color: pick.retr < 0.5 ? "#ef4444" : pick.retr < 0.8 ? "#f59e0b" : "#22c55e" }}>%{Math.round(pick.retr * 100)}</b>
                  {" "}· yarı-ömür <b>{pick.hl}g</b>
                </div>
              )}
              {pick.fragile && <div className="text-amber-400 text-[10px]">⚠ yavaş-doğru (akıcılık düşük)</div>}
            </>
          ) : <div className="text-white/40">henüz seçim yok</div>}
        </div>
        {/* Yerleştirme / ara-kontrol (Problem 2) */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-white/50 text-[9px] uppercase">Yerleştirme · Ara-kontrol</span>
            {placement.length > 0 && (
              <button
                onClick={() => resetPlacement()}
                className="text-[9px] text-white/40 hover:text-white/80 underline"
              >sıfırla</button>
            )}
          </div>
          {placement.length === 0 ? (
            <div className="text-white/40">atlanmış konu yok</div>
          ) : (
            <div className="space-y-1">
              {placement.map((p) => (
                <div key={p.topicId} className="flex items-center justify-between gap-1">
                  <span className="truncate text-white/80 max-w-[92px]" title={p.title}>{p.title}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="rounded px-1 font-extrabold text-black" style={{ background: STATUS_COLOR[p.status] }}>
                      {p.status}
                    </span>
                    <span className="text-white/60 text-[10px]">
                      {p.bcAcc === null ? "—" : `%${Math.round(p.bcAcc * 100)}`}·{Math.round(p.pressure * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 text-[10px]">
            <span className="text-white/50">Son soru: </span>
            {lastBc && Date.now() - lastBc.at < 4000 ? (
              <b style={{ color: lastBc.correct ? "#22c55e" : "#ef4444" }}>
                ARA-KONTROL ({lastBc.topicId}) {lastBc.correct ? "✓" : "✗"}
              </b>
            ) : <span className="text-white/40">normal konu</span>}
          </div>
        </div>
        {/* Karışıklık ısısı — hangi harfi neyle karıştırıyor */}
        <div className="border-t border-white/10 pt-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-white/50 text-[9px] uppercase">Karışıklık Isısı</span>
            {(conf.letters.length > 0 || conf.forms.length > 0) && (
              <button
                onClick={() => resetConfusion()}
                className="text-[9px] text-white/40 hover:text-white/80 underline"
              >sıfırla</button>
            )}
          </div>
          {conf.letters.length === 0 && conf.forms.length === 0 ? (
            <div className="text-white/40">karışıklık ölçülmedi</div>
          ) : (
            <div className="space-y-0.5">
              {[...conf.letters, ...conf.forms].slice(0, 5).map((r) => (
                <div key={r.pair} className="flex items-center justify-between gap-1">
                  <span className="truncate text-white/80 max-w-[104px]" title={r.pair}>{prettyPair(r.pair)}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span
                      className="rounded px-1 font-extrabold text-black"
                      style={{ background: r.heat > 0.6 ? "#ef4444" : r.heat > 0.25 ? "#f59e0b" : "#eab308" }}
                    >{r.heat.toFixed(2)}</span>
                    <span className="text-white/50 text-[10px]">ok{r.ok}/3</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Seri + bugün */}
        <div className="border-t border-white/10 pt-1.5 flex justify-between">
          <div><span className="text-white/50">Seri</span> <b>🔥{streak.count}</b></div>
          <div><span className="text-white/50">Bugün</span> <b>{today.learned}</b>y <b>{today.practiced}</b>p</div>
        </div>
      </div>
    </div>
  );
}
