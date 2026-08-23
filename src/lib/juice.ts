// OYUN HİSSİ ("juice") — aynı oyun, daha lezzetli.
//
// Juice = oyun kurallarını DEĞİŞTİRMEDEN geri bildirimi zenginleştirmek:
// toplarken çıt sesi, vuruşta titreşim, doğru cevapta ekranın hafifçe
// sarsılması. Kullanıcı tespiti: "koşu oyununda para toplarken ses çıkmıyor"
// — ölçtük, 15 oyunun 12'sinde HİÇ sfx yoktu ve titreşim hiçbirinde yoktu.
//
// ⚠️ MÜZİK YOK (İslami hassasiyet, audio.ts'teki kuralla aynı): hepsi tek
// atımlık bildirim tonu. Melodi değil, geri bildirim.
//
// ⚠️ SES ÜRETİMİ audio.ts'teki `tone`'dan gelir. Burada ikinci bir
// AudioContext açmak mobil tarayıcıda ses kilidini (autoplay unlock) bozar.
import { tone, gurultu } from "@/lib/audio";
import { titre, type Titresim } from "@/lib/titresim";

export type JuiceSfx =
  | "topla"    // para/harf toplama — seri ile TİZLEŞİR
  | "guc"      // güç kazanma
  | "zipla"
  | "carp"     // engele çarpma
  | "patlat"   // balon/kutu patlatma
  | "kaydir"   // şerit değiştirme / savurma
  | "ates"     // atış (Uzay Savaşı)
  | "seri"     // seri kilometre taşı (5, 10, 15…)
  | "camur"    // çamura basma — ıslak "şlop"
  | "bitis";   // bölüm/oyun bitişi

/**
 * ⚠️ SERİ ARTTIKÇA TİZLEŞİR (Mario'nun para sesi kuralı): aynı sesi 40 kez
 * duymak tekdüze; her toplayışta yarım ses yukarı çıkmak "biriktiriyorum"
 * hissi verir. 12 adımda tavan yapar, yoksa duyulamaz frekanslara çıkıyor.
 */
const SERI_TAVAN = 12;
function seriPerdesi(seri = 0): number {
  return Math.pow(2, Math.min(seri, SERI_TAVAN) / 24);   // yarım ses = 2^(1/24)… çeyrek ton
}

/**
 * Her ses türünün VARSAYILAN titreşimi.
 *
 * ⚠️ SIK YAPILAN HAREKETLER TİTREMEZ (`zipla`, `kaydir`, `ates`): Uçan Kuş'ta
 * ölçtük, 26 saniyede 62 kanat çırpışı oluyor — her birinde titremek hem
 * rahatsız edici hem pil yakıcı. Titreşim ÖNEMLİ anlara ayrılır.
 * ⚠️ VARSAYILAN sfx'in İÇİNDE: 15 oyunda tek tek `titre()` çağırmak
 * unutulmaya açıktı (ölçtük — 4 oyunda ses vardı, titreşim yoktu).
 */
const VARSAYILAN_TITRESIM: Partial<Record<JuiceSfx, Titresim>> = {
  topla: "hafif",
  guc: "basari",
  carp: "sert",
  patlat: "hafif",
  seri: "basari",
  bitis: "basari",
  // ⚠️ Çamur TİTREMEZ: çamurun içinde her adımda çalıyor (saniyede ~2-3 kez).
  // "Sık yapılan hareket titremez" kuralı — yukarıdaki nota bak.
};

export function sfx(kind: JuiceSfx, opts?: { seri?: number; titresim?: Titresim | false }) {
  const t = opts?.titresim === undefined ? VARSAYILAN_TITRESIM[kind] : opts.titresim;
  if (t) titre(t);
  const k = seriPerdesi(opts?.seri);
  switch (kind) {
    case "topla":
      tone(1320 * k, 0.05, "triangle", 0, 0.13);
      tone(1980 * k, 0.07, "triangle", 0.04, 0.11);
      break;
    case "guc":
      tone(784, 0.08, "triangle", 0, 0.16);
      tone(1046, 0.08, "triangle", 0.07, 0.16);
      tone(1568, 0.16, "triangle", 0.14, 0.17);
      break;
    case "zipla":
      tone(420, 0.07, "sine", 0, 0.11);
      tone(700, 0.06, "sine", 0.04, 0.09);
      break;
    case "carp":
      tone(190, 0.10, "square", 0, 0.13);
      tone(120, 0.16, "sine", 0.05, 0.12);
      break;
    case "patlat":
      tone(900, 0.04, "square", 0, 0.10);
      tone(300, 0.09, "sine", 0.02, 0.12);
      break;
    case "kaydir":
      tone(560, 0.05, "sine", 0, 0.07);
      tone(760, 0.05, "sine", 0.03, 0.06);
      break;
    case "ates":
      // ⚠️ KISIK ve KISA: oyuncu saniyede birkaç kez ateş ediyor; normal
      // seviyede çalarsa harflerin sesini bastırıyor.
      tone(880, 0.04, "square", 0, 0.05);
      tone(520, 0.05, "square", 0.02, 0.04);
      break;
    case "seri":
      tone(1046, 0.07, "triangle", 0, 0.15);
      tone(1318, 0.07, "triangle", 0.06, 0.15);
      tone(1568, 0.07, "triangle", 0.12, 0.15);
      tone(2093, 0.18, "triangle", 0.18, 0.14);
      break;
    case "camur": {
      /**
       * ÇAMUR "ŞLOP"U — periyodik bir ton DEĞİL, SÜZÜLMÜŞ GÜRÜLTÜ. Çamur
       * sesinin ıslaklığı, ayak gömülüp çıkarken filtre kesme frekansının
       * hızla süpürülmesinden ve yüksek rezonanstan (Q) geliyor. Altta kısa
       * bir hava kabarcığı "blop"u var.
       * ⚠️ Her adım HAFİFÇE FARKLI (`r`): aynı şlop üst üste çalınca mekanik
       * duyuluyor; gerçek çamur her adımda başka ses çıkarır.
       */
      const r = 0.85 + Math.random() * 0.3;
      gurultu({ dur: 0.17, bas: 240 * r, tepe: 900 * r, son: 170, q: 7, gain: 0.11 });
      tone(96 * r, 0.1, "sine", 0.01, 0.09);
      tone(150 * r, 0.07, "sine", 0.05, 0.05);
      break;
    }
    case "bitis":
      tone(659, 0.10, "triangle", 0, 0.17);
      tone(880, 0.10, "triangle", 0.09, 0.17);
      tone(1046, 0.10, "triangle", 0.18, 0.17);
      tone(1318, 0.26, "triangle", 0.27, 0.18);
      break;
  }
}

// Titreşim ayrı modülde (döngüsel import olmasın — audio.ts de kullanıyor).
export { titresimAcik, setTitresimAcik } from "@/lib/titresim";
export { titre } from "@/lib/titresim";
export type { Titresim } from "@/lib/titresim";

// ------------------------------------------------------------ ekran sarsıntısı

/**
 * Kısa ekran sarsıntısı için CSS sınıfı üretir.
 *
 * ⚠️ TRANSFORM İLE, layout ile DEĞİL: `top/left` oynatmak her karede yeniden
 * yerleşim tetikliyor ve zaten kasan cihazda kareyi düşürüyor. `translate`
 * yalnız derleme (composite) katmanında çalışır.
 * ⚠️ Sarsıntı OYUN ALANINA uygulanır, `body`'ye değil: bütün sayfayı
 * sarsmak yazıyı okunmaz yapıyor ve mide bulandırıyor (kullanıcı çocuk).
 */
// ⚠️ TEK KAYNAK: görsel taraf `gameFeel.ts`'e taşındı (travma modeli, donma
// karesi, ezilme-uzama, parçacıklar). Burası yalnız geriye dönük yeniden
// dışa aktarım — eskiden burada tanımlıydı ve HİÇBİR oyun kullanmıyordu.
export { SARSINTI_SINIFI, useSarsinti, createSarsinti, createHitstop } from "@/lib/gameFeel";
