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

  it("dokunulmazsa kendiliğinden kapanır (2.6 sn)", () => {
    const done = vi.fn();
    render(<UnlockCelebration title="Yeni bölüm!" onDone={done} />);
    gec(2500);
    expect(done).not.toHaveBeenCalled();
    gec(200);
    expect(done).toHaveBeenCalledTimes(1);
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
