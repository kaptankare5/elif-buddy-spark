# -*- coding: utf-8 -*-
"""Yeni kesilen dosyaların SAĞLIK DENETİMİ — üzerine yazmadan önce.

414 çalışan kaydın üzerine yazılacak; kötü kesilmiş tek dosya bile çocuğun
duyduğu sesi bozar. Her dosya için bakılan:
  · süre makul mü (çok kısa = hece kesilmiş, çok uzun = iki hece birleşmiş)
  · sessiz mi (tepe genlik taban altında → kesim boşluğa denk gelmiş)
  · BAŞI/SONU kırpılmış mı (ilk/son 25 ms hâlâ yüksek enerjideyse söz kesilmiş)
"""
import subprocess, sys, os
import numpy as np

SR = 16000


def pcm(yol):
    o = subprocess.run(["ffmpeg", "-v", "error", "-i", yol, "-ac", "1",
                        "-ar", str(SR), "-f", "s16le", "-"], capture_output=True)
    return np.frombuffer(o.stdout, dtype="<i2").astype(np.float32) / 32768.0


def denetle(klasor, onek):
    dosyalar = sorted(f for f in os.listdir(klasor) if f.startswith(onek))
    sorun = []
    sureler, tepeler = [], []
    for f in dosyalar:
        x = pcm(os.path.join(klasor, f))
        if len(x) == 0:
            sorun.append((f, "BOŞ")); continue
        sure = len(x) / SR
        tepe = float(np.abs(x).max())
        sureler.append(sure); tepeler.append(tepe)
        kenar = int(0.025 * SR)
        bas = float(np.abs(x[:kenar]).max()) if len(x) > 2 * kenar else 0
        son = float(np.abs(x[-kenar:]).max()) if len(x) > 2 * kenar else 0
        if sure < 0.25: sorun.append((f, f"ÇOK KISA {sure:.2f} sn"))
        elif sure > 3.0: sorun.append((f, f"ÇOK UZUN {sure:.2f} sn"))
        if tepe < 0.02: sorun.append((f, f"SESSİZ (tepe {tepe:.3f})"))
        elif bas > 0.30 * tepe: sorun.append((f, f"BAŞI KIRPIK ({bas/tepe:.0%})"))
        elif son > 0.30 * tepe: sorun.append((f, f"SONU KIRPIK ({son/tepe:.0%})"))
    print(f"{onek:<8} {len(dosyalar):>4} dosya · süre {min(sureler):.2f}-{max(sureler):.2f} "
          f"(ort {np.mean(sureler):.2f}) · tepe ort {np.mean(tepeler):.2f} · "
          f"{'SORUN YOK' if not sorun else str(len(sorun)) + ' SORUN'}")
    for f, s in sorun[:8]:
        print(f"      {f}: {s}")
    return sorun


if __name__ == "__main__":
    klasor = sys.argv[1] if len(sys.argv) > 1 else "yeni_sesler"
    hepsi = []
    for onek in ("hareke-", "med-", "tenvin-", "cezm-", "sedde-", "basic-"):
        hepsi += denetle(klasor, onek)
    print(f"\nTOPLAM SORUN: {len(hepsi)}")
