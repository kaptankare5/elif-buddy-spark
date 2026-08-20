# -*- coding: utf-8 -*-
"""HARF ADI DENETİMİ — ekranda yazan ad, hocanın SÖYLEDİĞİ adla aynı mı?

⚠️ NEDEN VAR: uygulama ط'ya "Tı", ظ'ya "Zı" yazıyordu ama hocanın kaydı
"ta" ve "za" diyor. Çocuk sesi duyup yazılı şıktan seçiyor; yazı ile ses
ayrı şey söyleyince soru ölçmek istediğini ölçmez. Kullanıcı bunu kulakla
yakaladı, bu araç ÖLÇEREK doğruluyor.

YÖNTEM — kıyas AYNI hoca + AYNI ünsüzle yapılır, tahmin yok:
  basic-NN.mp3          harfin ADI          (ölçülecek)
  hareke-NN-fetha.mp3   o harf + üstün      (= a / e, kova'ya göre)
  hareke-NN-esre.mp3    o harf + esre       (= ı / i)
  hareke-NN-otre.mp3    o harf + ötre       (= u / ü)
Adın ünlü çekirdeğinin mel spektral zarfı üç referansla karşılaştırılır;
en yakın olan, adın taşıdığı ünlüdür. Ünsüz her üçünde de aynı olduğu için
fark YALNIZ ünlüden gelir — formant kestirimine gerek kalmıyor.

⚠️ İKİ SAHTE UYUŞMAZLIK BEKLENİR, hata değildir: د ("Dal") ve ن ("Nun")
`ince` kovadadır, yani referansları e/i/ü'dür — adlarındaki a ve u
referans kümesinde YOKTUR, en yakın komşuya düşerler. Kalın kovadaki
harflerde böyle bir boşluk yok, ط/ظ/خ sonucu bu yüzden geçerlidir.

Ölçüm (2026-08): 28 harfin 23'ü tutuyor, 2'si yukarıdaki sahte uyuşmazlık,
kalan 3'ü GERÇEK:  خ yazı "ı" ↔ kayıt "a"  ·  ط "ı" ↔ "a"  ·  ظ "ı" ↔ "a".
ط ve ظ düzeltildi (Ta / Za). خ "Hı" olarak KALDI: kayıt "ha" diyor ama ح
zaten "Ha" — ikisine aynı adı yazmak sorunun İKİ doğru cevabı olması demek.

Çalıştırma:  python3 tools/ses/adlar.py     (kök dizinden; ffmpeg gerekir)
"""
import subprocess
import sys

import numpy as np

SR = 16000
SES = "public/audio/elifba"

# (harf no, uygulamadaki ad, kalınlık kovası) — kova elifba.ts ile aynı olmalı
LETTERS = [
    (1, "Elif", "ince"), (2, "Be", "ince"), (3, "Te", "ince"), (4, "Se", "ince"),
    (5, "Cim", "ince"), (6, "Ha", "ra"), (7, "Hı", "kalin"), (8, "Dal", "ince"),
    (9, "Zel", "ince"), (10, "Ra", "ra"), (11, "Ze", "ince"), (12, "Sin", "ince"),
    (13, "Şin", "ince"), (14, "Sad", "kalin"), (15, "Dad", "kalin"), (16, "Ta", "kalin"),
    (17, "Za", "kalin"), (18, "Ayn", "ra"), (19, "Ğayn", "kalin"), (20, "Fe", "ince"),
    (21, "Gaf", "kalin"), (22, "Kef", "ince"), (23, "Lem", "ince"), (24, "Mim", "ince"),
    (25, "Nun", "ince"), (26, "Vev", "ince"), (27, "He", "ince"), (28, "Ye", "ince"),
]
# Referans kümesinde o ünlü YOK — sahte uyuşmazlık beklenir (bkz. başlık).
BOSLUK = {8, 25}
# KABUL EDİLMİŞ İSTİSNA: uyuşmazlık gerçek ama yazıyı düzeltmek daha kötü.
ISTISNA = {7: "kayıt 'ha' diyor ama ح zaten 'Ha' — iki harfe aynı adı "
              "yazmak sorunun İKİ doğru cevabı olması demektir"}

VOWELS = {
    "ince":  {"fetha": "e", "esre": "i", "otre": "ü"},
    "kalin": {"fetha": "a", "esre": "ı", "otre": "u"},
    "ra":    {"fetha": "a", "esre": "i", "otre": "u"},
}


def oku(yol):
    p = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", yol, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True)
    if p.returncode != 0 or not p.stdout:
        sys.exit(f"okunamadı: {yol}")
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)


def cekirdek(x, win=0.050):
    """Ünlü çekirdeği = en yüksek enerjili 50 ms. Ünsüzler (patlamalı/sürtünmeli)
    ünlüden belirgin biçimde sessizdir, tepe her zaman ünlüye düşer."""
    n = int(win * SR)
    hop = n // 5
    if len(x) < n:
        return x * np.hanning(len(x))
    E = np.array([np.sum(x[i:i + n] ** 2) for i in range(0, len(x) - n, hop)])
    if E.max() <= 0:
        return x[:n]
    k = int(np.argmax(E))
    return x[k * hop:k * hop + n] * np.hanning(n)


def melbank(nfft=1024, nb=26, lo=150, hi=4000):
    mel = lambda f: 2595 * np.log10(1 + f / 700)
    inv = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = inv(np.linspace(mel(lo), mel(hi), nb + 2))
    bins = np.floor((nfft + 1) * pts / SR).astype(int)
    B = np.zeros((nb, nfft // 2 + 1))
    for i in range(nb):
        a, b, c = bins[i], bins[i + 1], bins[i + 2]
        if b > a:
            B[i, a:b] = np.linspace(0, 1, b - a)
        if c > b:
            B[i, b:c] = np.linspace(1, 0, c - b)
    return B


BANK = melbank()


def zarf(yol):
    """Ünlünün mel spektral zarfı; ortalaması alınıp normalize edilir
    (seviye farkı ölçüme karışmasın)."""
    x = cekirdek(oku(yol))
    X = np.abs(np.fft.rfft(x, 1024)) ** 2
    v = np.log(BANK @ X + 1e-10)
    v = v - v.mean()
    return v / (np.linalg.norm(v) + 1e-12)


def yazili_unlu(ad):
    """Yazılı adın SON hecesindeki ünlü."""
    for c in reversed(ad.lower()):
        if c in "aeıioöuü":
            return c
    return "?"


def main():
    print(f"{'no':>2} {'ad':<5} {'yazı':>4} {'kayıt':>5} {'d':>6} {'2.':>6}  durum")
    kotu = []
    for n, ad, kova in LETTERS:
        a = zarf(f"{SES}/basic-{n:02d}.mp3")
        d = {s: 1 - float(a @ zarf(f"{SES}/hareke-{n:02d}-{s}.mp3"))
             for s in ("fetha", "esre", "otre")}
        sira = sorted(d, key=d.get)
        duyulan = VOWELS[kova][sira[0]]
        yazilan = yazili_unlu(ad)
        if duyulan == yazilan:
            durum = "✓"
        elif n in BOSLUK:
            durum = f"~ referansta '{yazilan}' yok (beklenen)"
        elif n in ISTISNA:
            durum = f"! istisna — {ISTISNA[n]}"
        else:
            durum = "✗ YAZI ile SES AYRI ŞEY SÖYLÜYOR"
            kotu.append((n, ad, yazilan, duyulan))
        print(f"{n:>2} {ad:<5} {yazilan:>4} {duyulan:>5} {d[sira[0]]:6.3f} {d[sira[1]]:6.3f}  {durum}")

    if kotu:
        print("\nGERÇEK UYUŞMAZLIK (istisna olarak kayıtlı değil):")
        for n, ad, y, s in kotu:
            print(f"  {n:>2} {ad}: ekranda '{y}', kayıtta '{s}'")
    else:
        print("\nAçıkta uyuşmazlık yok (istisnalar yukarıda '!' ile işaretli).")
    return 1 if kotu else 0


if __name__ == "__main__":
    sys.exit(main())
