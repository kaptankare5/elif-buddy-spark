// DENETİM KARTI — Flashcard'ın öz-beyanını YANSIZ ölçer.
//
// Sorun: Flashcard'da çocuk cevabı gördükten sonra "Biliyorum" diyor ve bunu
// kimse doğrulamıyor. 8 yaş altı çocuklar performanslarını ısrarla abartıyor
// (yanlış bildikleri soruların ~%19'unu "doğru bilmiştim" diye hatırlıyorlar)
// ve geri bildirim bunu düzeltmiyor. Yani "üretim kanıtı" dediğimiz şey,
// çocuk dürüst değilse hiçbir şey ölçmüyor.
//
// Çözüm POLİSLİK DEĞİL ÖRNEKLEME: her cevabı doğrulamaya çalışmıyoruz, arada
// bir gerçek bir soru sorup çocuğun beyanının ne kadar tuttuğunu ölçüyoruz.
// Bu, yes/no kelime testlerindeki "yanlış alarm düzeltmesi"nin aynısı: kişinin
// "evet" deme eğilimini ölçüp puanı ona göre kırpıyorlar.
//
// ⚠️ DENETİM SORUSU SRS'E YAZILMAZ ve çocuğa hiçbir cezası yoktur (kullanıcı
// kararı). Tek etkisi: Flashcard'ın ustalık puanını ölçekleyen GÜVEN
// katsayısı. Yalan söyleyen çocuk kendini yavaşlatmış olur, dürüst çocuk hiç
// etkilenmez — kimse suçlanmadan sistem kendini kalibre eder.
//
// ⚠️ YÖN: denetim sorusu normal testin AYNASIDIR. Normal test "sesi duy →
// şekli seç" der; denetim "şekli gör → sesi seç" der. Bu, Elifbâ kitabının
// sorduğu yöndür ve ayrı öğrenilen bir beceridir (Webb 2009: sınav yönü
// çalışma yönüyle eşleşince sonuç en iyi; harf bilgisinde ad→harf ile
// harf→ses ayrı beceriler). Denetimin değeri de buradan geliyor: ölçtüğü
// şeyden BAĞIMSIZ — ne öz-beyana ne de normal testin yönüne dayanıyor.

const KEY_BASE = "elifba-audit-v1";

/** Kaç normal sorudan sonra bir denetim gelsin. */
export const HER_KACTA = 20;
/** Denetim sorusunun şık sayısı → şansla tutturma olasılığı 1/3. */
export const SIK_SAYISI = 3;
const SANS = 1 / SIK_SAYISI;

/**
 * Güven katsayısının TABANI. Neden 0 değil: üretim puanı (1) bu katsayıyla
 * çarpılıyor; taban 0.5 olunca en güvenilmez çocukta bile Flashcard bir oyun
 * cevabı kadar (MASTERY.RECOGNITION) değer taşır — DEĞERSİZ olmaz. Çocuk
 * yalan söylese de kart çevirerek harfe maruz kalıyor, o maruziyet gerçek.
 */
const MIN_GUVEN = 0.5;

/**
 * Önsel güven: hiç denetim yapılmamışken katsayı 1.0 olmalı (masumiyet
 * karinesi). Bu sanal gözlem sayısı, ilk birkaç denetimin katsayıyı sert
 * savurmasını da engeller.
 *
 * ⚠️ 3 İLE BAŞLAMIŞTI, YETMEDİ: şans düzeltmesi farkı BÜYÜTÜYOR, o yüzden
 * tek bir şanssız denetim güveni 1.00 → 0.63'e indiriyordu (testi var).
 * Çocuk dikkati dağıldığı için bir soruyu kaçırmış olabilir; bunu "yalan
 * söylüyor" diye okumak haksız. 8 ile bir hafta kadar (≈10 denetim) gerçek
 * veri önseli dengeler — karar birikmiş kanıta dayanır, tek atışa değil.
 */
const ONSEL_N = 8;

interface AuditState {
  /** Son denetimden bu yana kaç normal soru soruldu. */
  sayac: number;
  dogru: number;
  toplam: number;
}

// Hoca Modu: denetim kaydı öğrenciye özeldir. Açılışta doğrudan okunur
// (confusion.ts ile aynı desen), sonra srs.ts'teki setActiveStudentScope
// buradan çağırır — bağımlılık tek yönlü kalsın diye.
let _scope: string | null = null;
try {
  if (typeof localStorage !== "undefined") {
    _scope = localStorage.getItem("elifba-active-student-v1");
  }
} catch { /* ignore */ }

export function setAuditScope(sid: string | null) { _scope = sid || null; }

const KEY = () => (_scope ? `${KEY_BASE}-student-${_scope}` : `${KEY_BASE}-guest`);

function load(): AuditState {
  if (typeof window === "undefined") return { sayac: 0, dogru: 0, toplam: 0 };
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return { sayac: 0, dogru: 0, toplam: 0 };
    const s = JSON.parse(raw) as Partial<AuditState>;
    return { sayac: s.sayac ?? 0, dogru: s.dogru ?? 0, toplam: s.toplam ?? 0 };
  } catch { return { sayac: 0, dogru: 0, toplam: 0 }; }
}

function save(s: AuditState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch { /* ignore */ }
}

/** Normal bir soru/kart soruldu — denetim sayacını ilerlet. */
export function noteQuestion() {
  const s = load();
  s.sayac += 1;
  save(s);
}

/** Şimdi denetim sorusu zamanı mı? */
export function auditDue(): boolean {
  return load().sayac >= HER_KACTA;
}

/** Denetim cevabını işle. SRS'e YAZILMAZ — yalnız güven katsayısını günceller. */
export function recordAudit(correct: boolean) {
  const s = load();
  s.sayac = 0;
  s.toplam += 1;
  if (correct) s.dogru += 1;
  save(s);
}

/**
 * Çocuğun ÖZ-BEYANINA ne kadar güveniliyor (MIN_GUVEN..1).
 *
 * Şans düzeltmesi: 3 şıkta rastgele basan çocuk zaten 1/3 tutturur, o yüzden
 * ham oran doğrudan kullanılamaz. Klasik düzeltme:
 *     gerçek = (gözlenen − şans) / (1 − şans)
 * Örnek: denetimlerin %60'ını geçen çocuğun gerçek bilgisi
 *     (0.60 − 0.33) / 0.67 ≈ %40.
 */
export function reliability(): number {
  const s = load();
  const p = (s.dogru + ONSEL_N) / (s.toplam + ONSEL_N);   // önselle yumuşatılmış
  const duzeltilmis = (p - SANS) / (1 - SANS);
  if (!Number.isFinite(duzeltilmis)) return 1;
  return Math.max(MIN_GUVEN, Math.min(1, duzeltilmis));
}

/** Test paneli için ham sayılar. */
export function auditDebug() {
  const s = load();
  return { ...s, guven: reliability(), esik: HER_KACTA };
}

export function resetAudit() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY()); } catch { /* ignore */ }
}
