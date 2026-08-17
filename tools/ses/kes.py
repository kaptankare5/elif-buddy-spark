# -*- coding: utf-8 -*-
"""Hocanın tek parça kayıtlarını sessizlikten bölüp tek tek mp3'e çevirir.

⚠️ Sessizlik eşiği DOSYAYA GÖRE değişir: uzatmalı okuyuşta harfin sonu
yavaşça sönüyor, sert eşik onu ortadan kesiyor. Bu yüzden her dosya için
beklenen parça sayısı biliniyor ve eşik/ minimum sessizlik parametreleri
o sayıyı tutturacak şekilde ARANIYOR — gözle değil, sayıyla doğrulanıyor.
"""
import re, subprocess, sys, os, json

def sure(yol):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", yol], capture_output=True, text=True)
    return float(o.stdout.strip())


def sessizlikler(yol, esik, minSure):
    o = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", yol, "-af",
         f"silencedetect=noise={esik}dB:d={minSure}", "-f", "null", "-"],
        capture_output=True, text=True)
    # ⚠️ ffmpeg süreyi BİLİMSEL GÖSTERİMLE de yazıyor ("8.33333e-05").
    # Sade [\d.]+ deseni üssü yutup 8.33 saniye sanıyordu → dosyanın başındaki
    # sessizlik 8 saniyelik sahte bir parça oluyordu.
    SAYI = r"([-+0-9.eE]+)"
    bas = [float(x) for x in re.findall("silence_start: " + SAYI, o.stderr)]
    son = [float(x) for x in re.findall("silence_end: " + SAYI, o.stderr)]
    return bas, son


def parcalar(yol, esik, minSure, pay=0.12):
    """Konuşma aralıkları [(bas, son)] — sessizliklerin arası."""
    top = sure(yol)
    bas, son = sessizlikler(yol, esik, minSure)
    # sessizlik aralıklarını (s,e) olarak eşle
    araliklar = []
    for i, b in enumerate(bas):
        e = son[i] if i < len(son) else top
        araliklar.append((b, e))
    out = []
    imlec = 0.0
    for b, e in araliklar:
        if b - imlec > 0.08:
            out.append((max(0, imlec - pay), min(top, b + pay)))
        imlec = e
    if top - imlec > 0.08:
        out.append((max(0, imlec - pay), top))
    return out, top


def ara(yol, hedef):
    """Beklenen parça sayısını tutturan (eşik, minSure) ikilisini bul."""
    en_iyi = None
    for esik in (-25, -28, -30, -32, -35, -38, -40, -45, -50):
        for ms in (0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60):
            p, top = parcalar(yol, esik, ms)
            fark = abs(len(p) - hedef)
            aday = (fark, -ms, esik, ms, len(p), p)
            if en_iyi is None or aday[:2] < en_iyi[:2]:
                en_iyi = aday
            if fark == 0:
                return esik, ms, p
    return en_iyi[2], en_iyi[3], en_iyi[5]


if __name__ == "__main__":
    KLASOR = "/workspace/kaptankare5/sound/Dünya 1. ses kuran"
    HEDEF = {
        "elifba uzatmasız hoca.m4a": 28,
        "elifba uzatmalı hoca.m4a": 28,
        "e i ü hoca.m4a": 84,
        "cezim eb ib üb elif harfiyle başlıyor hoca.m4a": 84,
        # ⚠️ ŞEDDE 84: kayıt ELİF ile başlıyor (28 harf × 3). Uygulama Elif'i
        # kullanmıyor (sedde-01 = Be), ilk 3 parça artıyor.
        "şedde ebbe ibbe ğbbe hoca elifle başlıyor.m4a": 84,
        "med ee ii üü  bee bii büühoca.m4a": 84,
        "tenvin en in ün hoca.m4a": 84,
        "ha hırıltılı uzatmalı harf hoca.m4a": 1,
    }
    rapor = {}
    for ad, hedef in HEDEF.items():
        yol = os.path.join(KLASOR, ad)
        esik, ms, p = ara(yol, hedef)
        sureler = [round(b - a, 2) for a, b in p]
        rapor[ad] = dict(hedef=hedef, bulunan=len(p), esik=esik, minSure=ms,
                         parcalar=[[round(a, 3), round(b, 3)] for a, b in p])
        isaret = "OK " if len(p) == hedef else "!! "
        print(f"{isaret}{ad}")
        print(f"    hedef {hedef:>3}  bulunan {len(p):>3}   eşik {esik}dB  d={ms}")
        print(f"    parça süreleri: min {min(sureler):.2f}  ort "
              f"{sum(sureler)/len(sureler):.2f}  maks {max(sureler):.2f}")
    json.dump(rapor, open("kesim.json", "w"), ensure_ascii=False, indent=1)
    print("\nkesim.json yazıldı")
