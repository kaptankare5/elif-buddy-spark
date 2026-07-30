// SES BÜTÜNLÜĞÜ — "oyunda soru sorulmadı, sadece cevaplar vardı" regresyonu.
//
// Oyunların sorusu SESLE sorulur. Kaydı olmayan (ya da yolu diske uymayan)
// bir öğe soruya düşerse `playItem` tarayıcı TTS'ine düşer; TTS çoğu cihazda
// hiç ses çıkarmaz → çocuk kapıyı sessizce görür, ne sorulduğunu bilemez.
// Bu test iki şeyi sabitler:
//   1) item.audio dolu olan HER öğenin mp3'ü public/ altında gerçekten var.
//   2) Oyun havuzuna (gamePool) yalnız sesi olan öğeler girer.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
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
});
