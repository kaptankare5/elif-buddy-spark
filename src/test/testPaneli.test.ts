/**
 * TEST PANELİ BEKÇİSİ — "tüm konuları aç" ile "debug göstergeleri" AYRI
 * anahtarlar olmak zorunda.
 *
 * ⚠️ NEDEN TEST (kullanıcı şartı): ikisi tek düğmeydi. Debug HUD'ını açmak
 * isteyen veli, aynı hareketle bütün konuları da açıyordu ve uygulamayı
 * NORMAL OYUNCU gibi test edemiyordu — kilitler, bölüm açılışları ve
 * ilerleme hissi kayboluyordu. Bu testin asıl işi, debug tek başına açıkken
 * kilitlerin GERÇEKTEN yerinde durduğunu doğrulamak.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  tryUnlockWithCode, closeTestPanel, isTestPanelOpen,
  isTestUnlockActive, isDebugActive, setTestUnlockActive, setDebugActive,
} from "@/lib/testUnlock";
import { getUnlockedTopicIds } from "@/lib/unlock";
import { getAllTopics } from "@/data/subjects";

const TUM_KONU = getAllTopics().length;

beforeEach(() => localStorage.clear());

describe("kod paneli açar, anahtarları AÇMAZ", () => {
  it("yanlış kod hiçbir şey yapmaz", () => {
    expect(tryUnlockWithCode("0000")).toBe(false);
    expect(isTestPanelOpen()).toBe(false);
  });

  it("doğru kod paneli açar ama iki anahtar da KAPALI başlar", () => {
    expect(tryUnlockWithCode("1234")).toBe(true);
    expect(isTestPanelOpen()).toBe(true);
    expect(isTestUnlockActive(), "kod girmek 'her şeyi aç' demek değil").toBe(false);
    expect(isDebugActive()).toBe(false);
  });
});

describe("iki anahtar birbirinden bağımsız", () => {
  beforeEach(() => { tryUnlockWithCode("1234"); });

  it("debug açılınca kilitler AÇILMAZ — normal oyuncu gibi test", () => {
    setDebugActive(true);
    expect(isDebugActive()).toBe(true);
    expect(isTestUnlockActive()).toBe(false);
    // Asıl kanıt: konu kilidi hâlâ çalışıyor, ilk konudan ötesi kapalı.
    const acik = getUnlockedTopicIds();
    expect(acik.size, "debug kilitleri açmamalı").toBeLessThan(TUM_KONU);
  });

  it("kilit açılınca debug AÇILMAZ", () => {
    setTestUnlockActive(true);
    expect(isTestUnlockActive()).toBe(true);
    expect(isDebugActive()).toBe(false);
    expect(getUnlockedTopicIds().size).toBe(TUM_KONU);
  });

  it("biri kapanınca öteki açık kalır", () => {
    setDebugActive(true);
    setTestUnlockActive(true);
    setTestUnlockActive(false);
    expect(isDebugActive(), "kilidi kapatmak debug'ı düşürmemeli").toBe(true);
    expect(getUnlockedTopicIds().size).toBeLessThan(TUM_KONU);
  });
});

describe("panelin kapatılması", () => {
  it("paneli kapatmak her iki anahtarı da etkisiz kılar", () => {
    tryUnlockWithCode("1234");
    setDebugActive(true);
    setTestUnlockActive(true);
    closeTestPanel();
    expect(isTestPanelOpen()).toBe(false);
    expect(isTestUnlockActive()).toBe(false);
    expect(isDebugActive()).toBe(false);
    expect(getUnlockedTopicIds().size).toBeLessThan(TUM_KONU);
  });
});

/**
 * ⚠️ ESKİ CİHAZ: bölünmeden önce tek anahtar vardı (`elifba-test-unlock-v1`)
 * ve "1" ikisini birden demekti. Güncellemeden sonra o cihazda hiçbir şey
 * kaybolmamalı — panel açık, iki anahtar da açık gelmeli.
 */
describe("eski tek anahtardan göç", () => {
  it("eski kayıt panel + iki anahtar olarak okunur", () => {
    localStorage.setItem("elifba-test-unlock-v1", "1");
    expect(isTestPanelOpen()).toBe(true);
    expect(isTestUnlockActive()).toBe(true);
    expect(isDebugActive()).toBe(true);
  });

  it("göç bir kez olur, sonra anahtarlar bağımsız", () => {
    localStorage.setItem("elifba-test-unlock-v1", "1");
    isTestPanelOpen();            // göç tetiklenir
    setDebugActive(false);
    expect(isDebugActive(), "kapatılan debug göçle geri gelmemeli").toBe(false);
    expect(isTestUnlockActive()).toBe(true);
  });
});
