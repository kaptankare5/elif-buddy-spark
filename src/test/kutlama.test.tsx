/**
 * KUTLAMA KAPATILABİLİR OLMALI — kullanıcı şikâyeti: "bildirim geliyor,
 * kapatamıyorum, 2-3 saniye ekranda duruyor".
 *
 * ⚠️ SEBEP: en dıştaki katmanda `pointer-events-none` vardı; dokunuş arkaya
 * geçiyor, kutlamanın kendisi hiç tıklanamıyordu. Beklemekten başka yol yoktu.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UnlockCelebration } from "@/components/UnlockCelebration";

vi.mock("@/components/Buddy", () => ({ Buddy: () => <div data-testid="buddy" /> }));
// Ses gerçekten ÇAĞRILIYOR mu — jsdom'da AudioContext yok, sessizce yutulurdu.
const sesler: string[] = [];
vi.mock("@/lib/juice", () => ({ sfx: (k: string) => { sesler.push(k); } }));

describe("UnlockCelebration", () => {
  beforeEach(() => vi.useFakeTimers());
  // ⚠️ act() içinde boşalt: bekleyen zamanlayıcı state güncelliyor,
  // dışarıda çalışınca React uyarı basıyor.
  afterEach(() => { act(() => { vi.runOnlyPendingTimers(); }); vi.useRealTimers(); });

  const gec = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it("kapatma düğmesiyle kapanır", () => {
    const done = vi.fn();
    render(<UnlockCelebration title="Yeni bölüm!" onDone={done} />);
    gec(400);                                   // açılış kilidi geçsin
    fireEvent.click(screen.getByLabelText("Kapat"));
    expect(done).toHaveBeenCalled();
  });

  it("ekrana dokununca kapanır", () => {
    const done = vi.fn();
    render(<UnlockCelebration title="Yeni bölüm!" onDone={done} />);
    gec(400);
    fireEvent.pointerDown(screen.getByLabelText("Kutlamayı kapat"));
    expect(done).toHaveBeenCalled();
  });

  it("AÇILIŞ ANINDA kapanmaz — son cevabın dokunuşu kutlamayı yutmasın", () => {
    // Çocuğun son cevabı verdiği dokunuşun bırakma olayı, kutlama açıldıktan
    // SONRA geliyor; koruma payı olmasa kutlama görünmeden kaybolurdu.
    const done = vi.fn();
    render(<UnlockCelebration title="Yeni bölüm!" onDone={done} />);
    fireEvent.pointerDown(screen.getByLabelText("Kutlamayı kapat"));
    expect(done).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ SÜRE 1-2 SANİYE BANDINDA (kullanıcı şartı: "1 2 saniye sonra otomatik
   * kapansın"). 2.6 sn'den 2.2'ye indirildi; kapatma düğmesi ve ekrana
   * dokunma zaten daha hızlı çıkış veriyor.
   */
  it("dokunulmazsa kendiliğinden kapanır (2.2 sn)", () => {
    const done = vi.fn();
    render(<UnlockCelebration title="Yeni bölüm!" onDone={done} />);
    gec(2100);
    expect(done).not.toHaveBeenCalled();
    gec(200);
    expect(done).toHaveBeenCalledTimes(1);
  });

  /** Kutlamanın SESİ olmalı — sessiz bir kutlama fark edilmiyor. */
  it("açılışta kutlama sesi çalar, tür seçilebilir", () => {
    sesler.length = 0;
    render(<UnlockCelebration title="x" onDone={vi.fn()} />);
    expect(sesler, "varsayılan ses çalmadı").toEqual(["kutlama"]);
    sesler.length = 0;
    render(<UnlockCelebration title="x" onDone={vi.fn()} sound="kilit" />);
    expect(sesler).toEqual(["kilit"]);
    sesler.length = 0;
    render(<UnlockCelebration title="x" onDone={vi.fn()} sound={false} />);
    expect(sesler, "sound={false} sessiz olmalı — arka arkaya kutlamada ikincisi").toEqual([]);
  });

  /**
   * ⚠️ GERİ SAYIM GÖRÜNÜR: çocuk kutlamanın kapanacağını önceden görmeli,
   * yoksa "bir şey yapmam mı lazım?" diye bekliyor. Halka kapatma
   * düğmesinin çevresinde daralır.
   */
  it("kendiliğinden kapanırken geri sayım halkası çizilir ve daralır", () => {
    const { container } = render(<UnlockCelebration title="x" onDone={vi.fn()} />);
    const halka = () => container.querySelector("circle") as SVGCircleElement | null;
    expect(halka(), "geri sayım halkası yok").not.toBeNull();
    const ilk = Number(halka()!.getAttribute("stroke-dashoffset"));
    gec(1100);
    const sonra = Number(halka()!.getAttribute("stroke-dashoffset"));
    expect(sonra, "halka ilerlemiyor — geri sayım görünmüyor").toBeGreaterThan(ilk);
  });

  /**
   * ⚠️ TEKLİF KENDİLİĞİNDEN KAPANMAZ. "Sonraki konuya geçmek ister misin?"
   * bir bildirim değil sorudur; 2 saniyede kaybolursa çocuk hiç görmemiş
   * olur. Eylemli kutlamada halka da çizilmez.
   */
  it("eylem (teklif) varsa kendiliğinden KAPANMAZ ve halka çizilmez", () => {
    const done = vi.fn();
    const gec2 = vi.fn();
    const { container } = render(
      <UnlockCelebration title="Konu bitti" onDone={done}
        action={{ label: "Sonraki konu", onClick: gec2 }} />,
    );
    expect(container.querySelector("circle"), "teklifte geri sayım halkası olmamalı").toBeNull();
    gec(6000);
    expect(done, "teklif kendiliğinden kapandı — çocuk soruyu görmeden kayboldu").not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Sonraki konu"));
    expect(gec2).toHaveBeenCalled();
  });

  it("teklif reddedilebilir (Şimdi değil)", () => {
    const done = vi.fn();
    render(
      <UnlockCelebration title="Konu bitti" onDone={done}
        action={{ label: "Sonraki konu", onClick: vi.fn() }} />,
    );
    gec(400);
    fireEvent.click(screen.getByText("Şimdi değil"));
    expect(done).toHaveBeenCalled();
  });

  it("konfeti dokunuşu yutmaz (pointer-events-none)", () => {
    const { container } = render(<UnlockCelebration title="x" onDone={vi.fn()} />);
    const konfeti = container.querySelectorAll("span.animate-confetti");
    expect(konfeti.length).toBeGreaterThan(0);
    konfeti.forEach((k) => expect(k.className).toContain("pointer-events-none"));
  });

  it("en dıştaki katmanda pointer-events-none KALMAMALI", () => {
    const { container } = render(<UnlockCelebration title="x" onDone={vi.fn()} />);
    expect(container.firstElementChild!.className).not.toContain("pointer-events-none");
  });
});
