# -*- coding: utf-8 -*-
"""Hocanın tek parça kayıtlarını uygulamanın dosya adlarına çevirir.

EŞLEME — ölçülerek doğrulandı (bkz. hizalama testleri):
  · Bütün seriler ELİF'ten başlıyor ve müfredat sırasında gidiyor.
  · Hareke/med/tenvin: 28 harf × (fetha, esre, ötre) = 84.
  · Cezm ve şedde kayıtları da 84 (Elif dahil) ama UYGULAMA Elif'i kullanmıyor:
    cezm-01 = Be, sedde-01 = Be. Bu yüzden ilk 3 parça atlanıyor ve
    dosya numarası harf numarasının BİR EKSİĞİ oluyor.
  · Kodlama mevcut dosyalarla aynı: mp3, 44100 Hz, stereo, 192 kbps.
"""
import json, os, subprocess, sys

KLASOR = "/workspace/kaptankare5/sound/Dünya 1. ses kuran"
CIKTI = "yeni_sesler"
SUF3 = ("fetha", "esre", "otre")

# (dosya, hedef ad şablonu, harf ofseti, ek sonekler)
#   ofset 0  → dosya no = harf no        (basic, hareke, med, tenvin)
#   ofset 1  → dosya no = harf no − 1, Elif atlanır (cezm, şedde)
ISLER = [
    ("elifba uzatmasız hoca.m4a", "basic-{n:02d}.mp3", 0, None),
    ("elifba uzatmalı hoca.m4a", "basic-uzun-{n:02d}.mp3", 0, None),
    ("e i ü hoca.m4a", "hareke-{n:02d}-{s}.mp3", 0, SUF3),
    ("med ee ii üü  bee bii büühoca.m4a", "med-{n:02d}-{s}.mp3", 0, SUF3),
    ("tenvin en in ün hoca.m4a", "tenvin-{n:02d}-{s}.mp3", 0, SUF3),
    ("cezim eb ib üb elif harfiyle başlıyor hoca.m4a", "cezm-{n:02d}-{s}.mp3", 1, ("e", "i", "u")),
    ("şedde ebbe ibbe ğbbe hoca elifle başlıyor.m4a", "sedde-{n:02d}-{s}.mp3", 1, SUF3),
    ("ha hırıltılı uzatmalı harf hoca.m4a", "ha-hiriltili.mp3", 0, None),
]

PAY = 0.15   # parçanın iki ucuna bırakılan pay (sn) — kuyruğu kesmesin


def kes(kaynak, bas, son, hedef):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{bas:.3f}", "-i", kaynak,
         "-t", f"{son - bas:.3f}", "-ac", "2", "-ar", "44100", "-b:a", "192k",
         "-af", "afade=t=in:st=0:d=0.02,"
                f"afade=t=out:st={max(0, son - bas - 0.03):.3f}:d=0.03",
         hedef], check=True)


if __name__ == "__main__":
    kesim = json.load(open("kesim.json"))
    os.makedirs(CIKTI, exist_ok=True)
    top = 0
    for ad, sablon, ofset, sufs in ISLER:
        P = kesim[ad]["parcalar"]
        kaynak = os.path.join(KLASOR, ad)
        yazilan = 0
        for i, (a, b) in enumerate(P):
            if sufs:
                harf = i // 3 + 1
                s = sufs[i % 3]
            else:
                harf, s = i + 1, None
            n = harf - ofset
            if n < 1:                      # cezm/şedde: Elif atlanır
                continue
            isim = sablon.format(n=n, s=s) if "{" in sablon else sablon
            kes(kaynak, max(0, a - PAY + 0.12), b + PAY - 0.12,
                os.path.join(CIKTI, isim))
            yazilan += 1
        print(f"{yazilan:>3} dosya  ←  {ad}")
        top += yazilan
    print(f"\nTOPLAM {top} dosya → {CIKTI}/")
