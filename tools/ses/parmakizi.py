# -*- coding: utf-8 -*-
"""Ses parmak izi — "bu parça hangi harfin sesi?" sorusunu ÖLÇEREK doğrular.

⚠️ NEDEN GEREKLİ: yeni kayıtları harflere yanlış sırayla bağlamak sessizce
felaket olur — çocuk "be" sesini duyup "te"yi öğrenir. Dosya adlarındaki
sıraya ("eb ib üb diye gidiyor") güvenmek yetmez; sıra ÖLÇÜLEREK
doğrulanacak: her yeni parça, uygulamadaki 84 mevcut kayda tek tek
benzetilip en yakını bulunuyor. Doğruysa köşegen çıkar.

Yöntem: log-mel spektrogram → sabit uzunluğa (zamanda) yeniden örnekleme →
kosinüs benzerliği. Aynı kelimenin farklı çekimi yüksek, başka kelime düşük.
"""
import subprocess
import numpy as np

SR = 16000
NFFT = 512
HOP = 160          # 10 ms
BANT = 24
KARE = 24          # her klip bu kadar zaman dilimine indirgenir


def pcm(yol, bas=None, son=None):
    cmd = ["ffmpeg", "-v", "error"]
    if bas is not None: cmd += ["-ss", f"{bas:.3f}"]
    cmd += ["-i", yol]
    if son is not None: cmd += ["-t", f"{son - bas:.3f}"]
    cmd += ["-ac", "1", "-ar", str(SR), "-f", "s16le", "-"]
    o = subprocess.run(cmd, capture_output=True)
    return np.frombuffer(o.stdout, dtype="<i2").astype(np.float32) / 32768.0


def _melBank():
    def hz2mel(f): return 2595 * np.log10(1 + f / 700)
    def mel2hz(m): return 700 * (10 ** (m / 2595) - 1)
    dusuk, yuksek = 80.0, SR / 2
    noktalar = mel2hz(np.linspace(hz2mel(dusuk), hz2mel(yuksek), BANT + 2))
    bins = np.floor((NFFT + 1) * noktalar / SR).astype(int)
    fb = np.zeros((BANT, NFFT // 2 + 1), dtype=np.float32)
    for i in range(BANT):
        s, m, e = bins[i], bins[i + 1], bins[i + 2]
        if m == s: m = s + 1
        if e == m: e = m + 1
        fb[i, s:m] = np.linspace(0, 1, m - s)
        fb[i, m:e] = np.linspace(1, 0, e - m)
    return fb


MEL = _melBank()
# DCT-II matrisi (mel bantlarından kepstruma)
DCT = np.array([[np.cos(np.pi * k * (2 * n + 1) / (2 * BANT)) for n in range(BANT)]
                for k in range(BANT)], dtype=np.float32)
PENCERE = np.hanning(NFFT).astype(np.float32)


def izi(x):
    """log-mel spektrogram → (KARE, BANT) normalize matris."""
    if len(x) < NFFT: x = np.pad(x, (0, NFFT - len(x)))
    n = 1 + (len(x) - NFFT) // HOP
    if n < 2: n = 2
    kadr = np.stack([x[i * HOP:i * HOP + NFFT] for i in range(n)
                     if i * HOP + NFFT <= len(x)])
    if len(kadr) < 2: kadr = np.stack([np.pad(x, (0, max(0, NFFT - len(x))))[:NFFT]] * 2)
    S = np.abs(np.fft.rfft(kadr * PENCERE, axis=1)) ** 2
    M = np.log(S @ MEL.T + 1e-8)
    # ⚠️ KANAL/KONUŞMACI ORTALAMASI ÇIKARILMALI (cepstral mean normalization):
    # ham log-mel'de aynı kişinin her hecesi birbirine benziyor (farklı harfler
    # 0.95'e kadar çıkıyordu), ayrım yok oluyordu.
    M = M - M.mean(axis=0, keepdims=True)
    C = M @ DCT.T                      # MFCC; c0 (enerji) atılıyor
    C = C[:, 1:13]
    idx = np.linspace(0, len(C) - 1, KARE)
    Cr = np.stack([C[int(round(i))] for i in idx])
    Cr = Cr - Cr.mean(axis=0, keepdims=True)
    nrm = np.linalg.norm(Cr) + 1e-9
    return (Cr / nrm).ravel()


def benzer(a, b):
    return float(np.dot(a, b))
