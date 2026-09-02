# -*- coding: utf-8 -*-
"""ÖTÜMSÜZ SESLERİN KUYRUĞUNU KURTAR — yarıda kesilen k/t/s/f seslerini onarır.

⚠️ SORUN (kullanıcı bildirdi: "ek ik ük... tam k diyorken yarıda kesiliyor"):
`kes.py` parçaları `silencedetect` ile ayırıyor ve eşiği **-25 dB**. Ünlünün
enerjisi -15 dB civarında, ama ötümsüz bir ünsüz doğası gereği ÇOK daha
sessiz:

  · PATLAMALI (ك ت): önce ağız kapanır → GERÇEK SESSİZLİK (~0.26 sn), sonra
    patlama gelir ve o patlama yalnız -35..-40 dB. ffmpeg kapanmayı "kelime
    bitti" sanıp orada kesiyor; patlama eşiğin altında kaldığı için de
    "sessizlik"e dahil edilip ÇÖPE gidiyor. Sonuç: çocuk "e" duyuyor, "k"yı
    hiç duymuyor.
  · SIZMALI (ث ف): hışırtı 0.3-0.4 sn sürüyor ama -45..-60 dB. Eşiğin altına
    düştüğü anda kesiliyor, sesin çoğu gidiyor.

ÖLÇÜM (cezm kaydı, 84 parça): parça süresi ortancası 0.558 sn. En kısa dördü
Kef 0.386 · Te 0.393 · Se 0.402 · Fe 0.410 — hepsi ötümsüz. (Elif de kısa ama
uygulama cezm-Elif'i kullanmıyor.) Kef'te kesim 109.008'de bitiyor, patlama
109.19-109.33'te: tamamen dışarıda.

ÇÖZÜM: bu harflerde bitiş, kesimden İLERİYE doğru ÇOK ALÇAK bir eşikle
(-63 dB) aranır. Sessizlik tabanı -80..-120 dB olduğu için bu eşik tabanın
belirgin üstünde, en sessiz hışırtının (-61 dB) ise altında.
⚠️ EŞİĞİ BÜTÜN KAYITTA DÜŞÜRMEK ÇÖZÜM DEĞİL: -63 dB ile heceler birbirine
yapışır (nefes ve oda gürültüsü de konuşma sayılır) ve 84 parça tutmaz.
Düşük eşik yalnız BİLİNEN bitişin ilerisinde, sıradaki parçaya değmeyecek
şekilde kullanılır.
"""
import subprocess, sys, os
import numpy as np

SR = 16000
ESIK_DB = -63.0        # kuyruk arama eşiği (sessizlik tabanı -80 dB'nin üstü)
# ⚠️ SABIR, KAPANMA SESSİZLİĞİNDEN UZUN OLMAK ZORUNDA. Patlamalı bir ünsüzde
# ağız kapalıyken GERÇEK sessizlik oluyor; ölçüldü: Te'de 159 ms, Kef'te
# 202 ms. 120 ms'lik sabırla arama tam o boşlukta duruyor ve patlamayı hiç
# görmüyordu (ilk denemede Kef yalnız 52 ms kazandı). 320 ms hem bu boşluğu
# aşıyor hem de heceler arası 1.3-1.6 sn'lik gerçek duraklamanın çok altında.
# ⚠️ Boşluk uzun ama İÇİ BOŞSA hiçbir şey eklenmez: Be/Dal/Ta/Kaf'ta kesimden
# sonra 585 ms boyunca -120 dB var (dijital sessizlik) — o heceler zaten tam,
# araç onlara dokunmuyor. Ayraç "boşluk var mı" değil "boşluktan SONRA ses
# var mı" diye soruyor.
SESSIZ_MS = 320
PAY = 0.06             # bulunan bitişe eklenen küçük pay (sn)
EN_COK_UZATMA = 0.55   # emniyet: bir parça bundan fazla uzayamaz
GUVENLIK = 0.12        # sıradaki parçanın başına bu kadar yaklaşma


def pcm(yol):
    o = subprocess.run(["ffmpeg", "-v", "quiet", "-i", yol, "-ac", "1",
                        "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(o, dtype=np.float32)


def zarf(x, pencere=0.01):
    """10 ms'lik pencerelerde dBFS."""
    w = int(pencere * SR)
    n = len(x) // w
    r = np.sqrt(np.maximum(1e-12, (x[:n * w].reshape(n, w) ** 2).mean(1)))
    return 20 * np.log10(r + 1e-12), w


# İki aşamalı arama parametreleri (aşağıdaki nota bak)
EN_COK_BOSLUK = 0.30   # kapanma sessizliği en fazla bu kadar sürebilir
BITIS_SESSIZ = 0.10    # patlama/hışırtı başladıktan sonra bu kadar sessizlik = bitti


def gercekBitis(x, db, w, bas, son, sinir):
    """Parçanın GERÇEK bitişi — İKİ AŞAMALI arama.

    ⚠️ TEK AŞAMALI ARAMA YANLIŞ SONUÇ VERİYORDU: "eşiğin altında N ms kalırsa
    bitti" kuralıyla 320 ms sabır koyunca 84 parçanın 84'ü uzadı — araç artık
    heceden sonraki NEFES ve oda gürültüsünü de kuyruk sanıyordu. Kaybı olan
    dosyaları ayırt edemeyen bir ölçüm, bütün seti bozacak bir düzeltme
    demektir.

    Doğrusu iki soruyu ayrı sormak:
      1) Kesimden sonra, KAPANMA boşluğu kadar bir süre içinde (≤300 ms)
         yeniden ses başlıyor mu? Başlamıyorsa kayıp YOK — dokunma.
         (Ölçüldü: Be/Dal/Ta/Kaf'ta boşluk 585 ms ve içi -120 dB.)
      2) Başlıyorsa, o ses nerede bitiyor? Artık kısa bir sabır (100 ms)
         yeter, çünkü aradığımız şey zaten başlamış durumda.
    """
    iSinir = int(min(sinir - GUVENLIK, len(x) / SR) * SR / w)
    i0 = int(son * SR / w)
    # 1) boşluğu aş: ilk sesi bul
    basla = None
    for i in range(i0, min(i0 + int(EN_COK_BOSLUK * SR / w), iSinir, len(db))):
        if db[i] > ESIK_DB:
            basla = i
            break
    if basla is None:
        return son + PAY          # kayıp yok, yalnız küçük pay
    # 2) sesin bitişini bul
    sonSes = basla
    sessiz = 0
    for i in range(basla, min(iSinir, len(db))):
        if db[i] > ESIK_DB:
            sonSes = i
            sessiz = 0
        else:
            sessiz += 1
            if sessiz * w / SR >= BITIS_SESSIZ:
                break
    return min(sonSes * w / SR + PAY, sinir - GUVENLIK, son + EN_COK_UZATMA)


# ---------------------------------------------------------------- üretim

KAYNAK = ("/home/user/kaptankare5/sound/Dünya 1. ses kuran/"
          "cezim eb ib üb elif harfiyle başlıyor hoca.m4a")

# ⚠️ YALNIZ KANITI OLAN HARFLER ONARILIR (harf numarası).
# Ayraç 62/84 parçayı "uzayabilir" diye işaretledi ama bunların çoğu heceden
# sonraki NEFES sesi; eşik tek başına ikisini ayıramıyor. Ölçülebilir kanıt
# iki şartın BİRLİKTE sağlanması: (1) parça ailenin ortancasından belirgin
# kısa (kelime erken bitmiş), (2) kesimden hemen sonra gerçek bir patlama/
# hışırtı var. Bunu sağlayan dört harf ötümsüz: ت ث ف ك.
# Ölçüm (parça ortancası 0.558 sn): Kef 0.386 · Te 0.393 · Se 0.402 · Fe 0.410.
# Kalan aday harfler RAPOR EDİLİR, körlemesine yeniden yazılmaz — 62 dosyayı
# doğrulanmamış bir kurala göre değiştirmek bütün seti bozma riskidir.
ONARILACAK = {3: "Te", 4: "Se", 20: "Fe", 22: "Kef"}

# uret.py ile AYNI kodlama ve payları kullan (mp3 · 44100 · stereo · 192k).
BAS_PAY = 0.03      # uret.py: max(0, a - 0.15 + 0.12)


def uret(hedefKlasor, harfler=None, yaz=True):
    import kes
    harfler = harfler or ONARILACAK
    p, top = kes.parcalar(KAYNAK, -25, 0.2)
    x = pcm(KAYNAK)
    db, w = zarf(x)
    os.makedirs(hedefKlasor, exist_ok=True)
    rapor = []
    for harfNo, ad in harfler.items():
        for j, suf in enumerate(("e", "i", "u")):
            k = (harfNo - 1) * 3 + j
            b, e = p[k]
            sinir = p[k + 1][0] if k + 1 < len(p) else top
            yeni = gercekBitis(x, db, w, b, e, sinir)
            bas = max(0, b - BAS_PAY)
            isim = f"cezm-{harfNo - 1:02d}-{suf}.mp3"
            hedef = os.path.join(hedefKlasor, isim)
            if yaz:
                subprocess.run(
                    ["ffmpeg", "-v", "error", "-y", "-ss", f"{bas:.3f}", "-i", KAYNAK,
                     "-t", f"{yeni + BAS_PAY - bas:.3f}", "-ac", "2", "-ar", "44100",
                     "-b:a", "192k", "-af",
                     "afade=t=in:st=0:d=0.02,"
                     f"afade=t=out:st={max(0, yeni + BAS_PAY - bas - 0.03):.3f}:d=0.03",
                     hedef], check=True)
            rapor.append((ad, suf, isim, e - b, yeni - b, (yeni - e) * 1000))
    return rapor


if __name__ == "__main__":
    hedef = sys.argv[1] if len(sys.argv) > 1 else "yeni_kuyruk"
    for ad, suf, isim, es, ye, kz in uret(hedef):
        print(f"{ad:<5}{suf:<3}{isim:<18} {es:.3f}s → {ye:.3f}s  (+{kz:.0f} ms)")
    print(f"\n→ {hedef}/")
