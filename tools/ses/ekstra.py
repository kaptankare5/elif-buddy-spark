# -*- coding: utf-8 -*-
"""EKSTRA ALIŞTIRMA kayıtlarını keser ve uygulamanın dosya adlarını verir.

Kaynak: kaptankare5/sound → "Dünya 1. ses kuran ekstralar ekstra alıştırma/"

⚠️ EŞİK HER DOSYADA AYRI — gözle değil SAYIYLA bulundu (uygulamadaki öğe
sayısını tutturan ikili aranır, sonra hizası ÖLÇÜLEREK doğrulanır):
  · şedde  -35 dB / d=1.0 ŞART. -28/0.8 de 14 parça veriyor AMA yanlış 14:
    şeddeli kelimeyi ortadan bölüp SON kelimeyi tamamen kaçırıyor (kayıt
    31.6 sn, kesim 28.7'de bitiyor). Parça sayısının tutması TEK BAŞINA
    doğruluk kanıtı DEĞİLDİR — kayma denetimi şart (aşağı bak).
  · elif-lâm -38 dB / d=0.5: رَبِّ şeddeli, kısa sessizlikte ikiye bölünüyor.

⚠️ HİZA ÖLÇÜLEREK DOĞRULANDI (parmakizi.py + kayma denetimi). Her ekstranın
bir hecesi zaten çekirdek kayıtta var; ekstra o ailenin BÜTÜN çekirdek
kayıtlarına benzetilip beklenenin sırasına bakıldı. Ofset 0 ile ±1 arasında
uçurum yoksa ölçüm hiçbir şey kanıtlamaz:
    cezm    ofset 0 → 6.1/81   · ±1 → 37.6 / 38.1   (rastgele 40)
    şedde   ofset 0 → 9.0/81   · ±1 → 32.9 / 34.3
    med     ofset 0 → 8.2/84   · ±1 → 38.5 / 27.7   (verideki mevcut eşleme)
    tenvin  ofset 0 → 12.4/84  · ±1 → 34.6 / 28.1   (İLK hece ile — son hece
            ayırt edici değil, 8 öğenin 6'sı "tün"/"ten" ile bitiyor)
  zamir ve elif-lâm'da çekirdek karşılığı yok; orada HECE↔SÜRE korelasyonu
  kullanıldı: 0.953 ve 0.890 (kelimeler 2-5 hece arasında değişiyor).

⚠️ KAZANÇ ŞART: bu çekim mevcut kayıtlardan 9-20 dB KISIK. Her aile KENDİ
çekirdeğinin seviyesine getirilir — oyunda ekstra ile çekirdek arka arkaya
çalıyor, seviye zıplarsa çocuk irkiliyor (eski şedde 11 dB kısıktı, aynı
hataya düşmeyelim).
"""
import json, os, subprocess, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from kes import parcalar

KLASOR = "/workspace/kaptankare5/sound/Dünya 1. ses kuran ekstralar ekstra alıştırma"
CIKTI = "yeni_ekstralar"
CEK = "public/audio/elifba"

# (dosya, ad şablonu, adet, eşik, minSessizlik, seviyesi eşitlenecek çekirdek aile)
ISLER = [
    ("cezim ekstralar alıştırma.m4a",     "cezm-ekstra-{n:02d}.mp3",   14, -28, 0.2, "cezm"),
    ("şedde ekstra alıştırmalar.m4a",     "sedde-ekstra-{n:02d}.mp3",  14, -35, 1.0, "sedde"),
    ("med ekstralar alıştırmalar.m4a",    "med-ekstra-{n:02d}.mp3",    14, -38, 0.2, "med"),
    ("tenvin ekstralar alıştırmalar.m4a", "tenvin-ekstra-{n:02d}.mp3",  8, -30, 0.2, "tenvin"),
    ("zamir ve lafzatullah.m4a",          "zamir-{n:02d}.mp3",          8, -40, 0.2, None),
    ("eliflam rakısı ve ra.m4a",          "eliflam-{n:02d}.mp3",        8, -38, 0.5, None),
]

# ⚠️ PAY GENİŞ (0.10 sn her iki uçta). Bu çekim çekirdek kayıtlardan kısık;
# dar payla (uret.py'deki 0.03 sn) sağlık denetimi 4 klipte "başı/sonu kırpık"
# dedi — kesimin hemen dışında sözün %35-40'ı duruyordu. Kelimeler arası
# boşluk ~1.5-2 sn olduğu için geniş pay bitişik kelimeyi İÇERİ ALMAZ.
PAY = 0.10
SR = 16000
GENEL_HEDEF = -26.5      # çekirdek ailelerin ortalaması (zamir/elif-lâm için)


def _pcm(yol, bas=None, son=None):
    c = ["ffmpeg", "-v", "error"]
    if bas is not None: c += ["-ss", f"{bas:.3f}"]
    c += ["-i", yol]
    if son is not None: c += ["-t", f"{son - bas:.3f}"]
    c += ["-ac", "1", "-ar", str(SR), "-f", "s16le", "-"]
    return np.frombuffer(subprocess.run(c, capture_output=True).stdout,
                         dtype="<i2").astype(np.float32) / 32768.0


def dbfs(x):
    return 20 * np.log10(max(float(np.sqrt(np.mean(x ** 2))) if len(x) else 0, 1e-9))


def aile_seviyesi(onek):
    v = [dbfs(_pcm(os.path.join(CEK, f)))
         for f in sorted(os.listdir(CEK)) if f.startswith(onek + "-") and f.endswith(".mp3")][:40]
    return float(np.mean(v))


def kes(kaynak, bas, son, hedef, kazanc_db):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{bas:.3f}", "-i", kaynak,
         "-t", f"{son - bas:.3f}", "-ac", "2", "-ar", "44100", "-b:a", "192k",
         "-af", f"volume={kazanc_db:.2f}dB,afade=t=in:st=0:d=0.02,"
                f"afade=t=out:st={max(0, son - bas - 0.03):.3f}:d=0.03",
         hedef], check=True)


if __name__ == "__main__":
    os.makedirs(CIKTI, exist_ok=True)
    top = 0
    for ad, sablon, adet, esik, ms, aile in ISLER:
        kaynak = os.path.join(KLASOR, ad)
        p, _ = parcalar(kaynak, esik, ms)
        if len(p) != adet:
            print(f"✗ {ad}: {len(p)} parça, {adet} bekleniyordu — DURDURULDU")
            sys.exit(1)
        ham = float(np.mean([dbfs(_pcm(kaynak, a, b)) for a, b in p]))
        hedef_db = aile_seviyesi(aile) if aile else GENEL_HEDEF
        kazanc = hedef_db - ham
        tepe = max(float(np.abs(_pcm(kaynak, a, b)).max()) for a, b in p) * (10 ** (kazanc / 20))
        if tepe > 0.95:
            print(f"✗ {ad}: kazanç sonrası tepe {tepe:.2f} — KIRPILIR, durduruldu")
            sys.exit(1)
        for i, (a, b) in enumerate(p):
            kes(kaynak, max(0, a - PAY), b + PAY,
                os.path.join(CIKTI, sablon.format(n=i + 1)), kazanc)
        print(f"{adet:>3} dosya ← {ad[:32]:<34} ham {ham:6.1f} → hedef {hedef_db:6.1f} dBFS "
              f"(kazanç {kazanc:+5.1f} dB · tepe {tepe:.2f})")
        top += adet
    print(f"\nTOPLAM {top} dosya → {CIKTI}/")
