# -*- coding: utf-8 -*-
"""GEÇİCİ ÇÖZÜM — "ley" kartının sesini hocanın KENDİ iki kaydından birleştirir.

⚠️ BU KALICI OLMAMALI. Kullanıcı kararı: "şimdilik yap ama bir ara hatırlat,
onu hocanın gerçek sesiyle değiştirelim". Doğru kayıt gelince bu dosya
`cezm-ekstra-03.mp3` yerine KONULACAK ve bu betik gereksizleşecek.
Takip: docs/gelecek-ozellikler.md

SORUN (ölçüldü): `cezm-ekstra-03.mp3` kartta "ley" (لَيْ) yazıyor ama kayıtta
açık ünlü HİÇ YOK — F1 dosyanın tamamında 231-306 Hz, yani "lî/liy". Aynı
kayıttaki öteki "e"li kelimeler 578-708 Hz'e çıkıyor (men 649 · ye' 708 ·
lem 582 · yes 578), dolayısıyla mesele ne kesim ne hiza: hoca orada
"ley" dememiş.
⚠️ Hiza denetlendi: 14 kelimenin 13'ünde beklenen ünlü ölçümle tutuyor
(bütün a'lar, bütün i/ü/u'lar). Yani parçalar doğru yerde, yalnız 3. kaydın
içeriği kartla uyuşmuyor.
⚠️ İLK ÖLÇÜMÜM YANLIŞTI: parçanın ilk yarısının ortancasına bakınca 5 kelime
"uyuşmuyor" çıkmıştı — hepsi /l/ /m/ /y/ ile başlayanlar. O ünsüzlerin F1'i
düşük olduğu için ünlüyü değil ONLARI ölçüyordum. Ölçüt "parçanın TAMAMINDA
F1'in ulaştığı en yüksek değer" olunca 13/14 tuttu.

BİRLEŞTİRME: /l/ + "ey"
  · /l/  ← hareke-23-fetha.mp3 ("le", Lem+üstün) 0.075-0.278
  · "ey" ← cezm-27-e.mp3 (Ye'nin cezimlisi) 0.125-sonu
⚠️ "le" + "ey" diye UÇ UCA EKLENMEZ: o "le-ey" olur, iki heceli. Alınan şey
"le"nin yalnız /l/ ünsüzü; ünlü ve kapanış tek parça hâlinde "ey"den gelir.
⚠️ PERDE UYUMU ÖLÇÜLDÜ: ek yerinde "le"nin F0'ı ~140 Hz, "ey"in ünlü başı
137 Hz — aynı hoca, neredeyse aynı perde, dolayısıyla ek yerinde sıçrama
duyulmuyor. 30 ms çapraz geçişle de tıkırtı önleniyor.
"""
import subprocess, sys, os
import numpy as np

SR = 44100          # kaynak mp3'lerle aynı — yeniden örnekleme kaybı olmasın
CEK = "../../public/audio/elifba"
L_KAYNAK = "hareke-23-fetha.mp3"      # "le"
EY_KAYNAK = "cezm-27-e.mp3"           # "ey"
L_BAS, L_SON = 0.060, 0.278           # /l/ ünsüzü (ölçüldü)
EY_BAS = 0.125                        # "ey"in ünlü başlangıcı (ölçüldü)
CAPRAZ = 0.030                        # çapraz geçiş süresi
# ⚠️ KAZANÇ ŞART: kaynaklar ÇEKİRDEK kayıtlar, ekstra ailesi ise daha kısık
# (ekstra.py bütün ekstraları çekirdeğin seviyesine getirirken bu farkı
# kapatıyor). Ham birleşim -18.9 dBFS çıkıyor, ekstra ailesinin ortancası
# -24.4; aradaki 5.5 dB'yi kapatmazsak oyunda bu kart tek başına yüksek
# çalar ve çocuk irkilir (eski şedde kayıtlarındaki 11 dB'lik hatanın aynısı).
KAZANC_DB = -5.5


def pcm(yol, sr=SR):
    o = subprocess.run(["ffmpeg", "-v", "quiet", "-i", yol, "-ac", "1",
                        "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(o, dtype=np.float32).astype(np.float64)


def birlestir():
    kok = os.path.join(os.path.dirname(os.path.abspath(__file__)), CEK)
    l = pcm(os.path.join(kok, L_KAYNAK))
    ey = pcm(os.path.join(kok, EY_KAYNAK))
    a = l[int(L_BAS * SR):int(L_SON * SR)]
    b = ey[int(EY_BAS * SR):]
    n = int(CAPRAZ * SR)
    n = min(n, len(a) // 2, len(b) // 2)
    # eşit güçlü (kök-kosinüs) çapraz geçiş — doğrusal geçiş ortada ses düşürür
    t = np.linspace(0, np.pi / 2, n)
    sonA, basB = np.cos(t), np.sin(t)
    out = np.concatenate([a[:-n], a[-n:] * sonA + b[:n] * basB, b[n:]])
    # uçlarda kısa sönüm (tıkırtı olmasın)
    k = int(0.012 * SR)
    out[:k] *= np.linspace(0, 1, k)
    out[-k:] *= np.linspace(1, 0, k)
    return out


def yaz(hedef, x, kazanc_db=0.0):
    x = x * (10 ** (kazanc_db / 20))
    tepe = np.abs(x).max()
    if tepe > 0.99:
        x = x * (0.99 / tepe)
    ham = (x.astype(np.float32)).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR),
                    "-ac", "1", "-i", "pipe:0", "-ac", "2", "-ar", "44100",
                    "-b:a", "192k", hedef], input=ham, check=True)


if __name__ == "__main__":
    hedef = sys.argv[1] if len(sys.argv) > 1 else "ley.mp3"
    kz = float(sys.argv[2]) if len(sys.argv) > 2 else KAZANC_DB
    x = birlestir()
    yaz(hedef, x, kz)
    print(f"{hedef}  süre {len(x)/SR:.3f} sn  kazanç {kz:+.1f} dB")
