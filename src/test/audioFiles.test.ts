// SES BÜTÜNLÜĞÜ — "oyunda soru sorulmadı, sadece cevaplar vardı" regresyonu.
//
// Oyunların sorusu SESLE sorulur. Kaydı olmayan (ya da yolu diske uymayan)
// bir öğe soruya düşerse `playItem` tarayıcı TTS'ine düşer; TTS çoğu cihazda
// hiç ses çıkarmaz → çocuk kapıyı sessizce görür, ne sorulduğunu bilemez.
// Bu test iki şeyi sabitler:
//   1) item.audio dolu olan HER öğenin mp3'ü public/ altında gerçekten var.
//   2) Oyun havuzuna (gamePool) yalnız sesi olan öğeler girer.
import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { getAllTopics } from "@/data/subjects";
import { gamePool } from "@/pages/games/_shared";

const items = getAllTopics().flatMap((t) => t.items);

describe("ses dosyaları", () => {
  it("item.audio yolları diskte var", () => {
    const eksik = items
      .filter((i) => i.audio)
      .filter((i) => !existsSync(resolve(process.cwd(), "public", i.audio!.replace(/^\//, ""))))
      .map((i) => `${i.id} → ${i.audio}`);
    expect(eksik).toEqual([]);
  });

  it("oyun havuzunda sessiz öğe yok (kilit tamamen açıkken bile)", () => {
    // Ayarlar'daki test kilidi (1234) bütün konuları açar; kayıtsız öğeler
    // o zaman havuza giriyor ve kapı sessiz geliyordu.
    localStorage.setItem("elifba-test-unlock-v1", "1");
    const havuz = gamePool();
    expect(havuz.length).toBeGreaterThan(100);
    expect(havuz.filter((i) => !i.audio).map((i) => i.id)).toEqual([]);
  });

  it("med konusunun hece kartları sessiz değil", () => {
    // 84 med-*.mp3 hoca kaydı diskte duruyordu ama veri onları hiç
    // bağlamamıştı: bütün konu (38/38) sessizdi.
    const med = getAllTopics().find((t) => t.id === "med")!;
    const heceler = med.items.filter((i) => [...(i.emoji ?? "")].length === 3);
    expect(heceler.length).toBeGreaterThan(20);
    expect(heceler.filter((i) => !i.audio)).toEqual([]);
  });

  /**
   * ⚠️ ÖTÜMSÜZ ÜNSÜZ YARIDA KESİLMESİN (kullanıcı bildirdi: "ek ik ük... tam
   * k diyorken yarıda kesiliyor").
   *
   * SEBEP: `tools/ses/kes.py` parçaları -25 dB eşikli `silencedetect` ile
   * ayırıyor. Ünlü -15 dB civarında ama ötümsüz bir ünsüz çok daha sessiz:
   * ك ت'de önce ağız kapanıyor (GERÇEK sessizlik, Kef'te 202 ms ölçüldü),
   * sonra gelen patlama yalnız -36 dB — eşiğin altında kaldığı için
   * "sessizlik"e dahil edilip atılıyordu. ث ف'de ise hışırtı -45..-60 dB
   * bandında 0.3-0.4 sn sürüyor, eşiğin altına düşer düşmez kesiliyordu.
   *
   * ÖLÇÜM (cezm ailesi, 84 parça, ortanca süre 0.558 sn): kesikler
   * Kef 0.386 · Te 0.393 · Se 0.402 · Fe 0.410 — hepsi ötümsüz.
   * `tools/ses/kuyruk.py` ile yeniden kesildi; kurtarılan kuyruğun tayf
   * merkezi 1.6-6.2 kHz (ünlüler 0.4-1.3 kHz), yani gerçekten ÜNSÜZ.
   *
   * Bekçi DOSYA BOYUTUNA bakar: 192 kbps sabit bit hızında boyut süreyle
   * doğru orantılı, mp3 çözmeye gerek yok. Kesik dosyalar ~12 kB idi.
   */
  it("cezimli ötümsüz ünsüzler (ك ت ث ف) yarıda kesik değil", () => {
    const boy = (ad: string) =>
      statSync(resolve(process.cwd(), "public/audio/elifba", ad)).size;
    // Aile ortancası — kıyas ölçütü sabit sayı DEĞİL, ailenin kendisi.
    const hepsi = [...Array(27)].map((_, i) => boy(`cezm-${String(i + 1).padStart(2, "0")}-e.mp3`));
    const ortanca = [...hepsi].sort((a, b) => a - b)[Math.floor(hepsi.length / 2)];
    // Kef=22 → cezm-21, Te=3 → cezm-02, Se=4 → cezm-03, Fe=20 → cezm-19
    for (const [ad, no] of [["Te", 2], ["Se", 3], ["Fe", 19], ["Kef", 21]] as const) {
      for (const s of ["e", "i", "u"] as const) {
        const d = `cezm-${String(no).padStart(2, "0")}-${s}.mp3`;
        expect(boy(d), `${ad} (${d}) ailenin çok altında — ünsüz yine kesilmiş`)
          .toBeGreaterThan(ortanca * 0.8);
      }
    }
  });
});
