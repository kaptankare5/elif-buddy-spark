# Hoca kayıtlarını kesme araçları

Hoca kayıtları **tek parça** geliyor (bir dosyada 28 harf ya da 84 hece arka
arkaya). Bu klasördeki üç betik onları uygulamanın beklediği tek tek mp3'lere
çeviriyor.

Kaynak: `github.com/kaptankare5/sound` → `Dünya 1. ses kuran/` (8 adet .m4a)

```
kes.py         sessizlikten böler; her dosya için BEKLENEN parça sayısını
               tutturan eşik/süre ikilisini arar → kesim.json
uret.py        kesim.json'a göre keser, uygulamanın dosya adlarını verir
               (mp3 · 44100 Hz · stereo · 192 kbps — mevcut dosyalarla aynı)
parmakizi.py   "bu parça hangi harfin sesi?" — MFCC parmak iziyle ÖLÇER
denetle.py     üzerine yazmadan önce sağlık denetimi (süre/sessizlik/kırpık)
```

Çalıştırma (ffmpeg + numpy gerekir):

```bash
cd tools/ses && python3 kes.py && python3 uret.py     # → yeni_sesler/ (471 dosya)
```

## ⚠️ Eşleme kuralları — ölçülerek doğrulandı

- **Bütün seriler ELİF'ten başlar** ve müfredat sırasında gider.
- Hareke / med / tenvin: 28 harf × (fetha, esre, ötre) = **84** parça,
  dosya numarası = harf numarası.
- **Cezm ve şedde kayıtları da 84** (Elif dahil) ama uygulama Elif'i
  kullanmıyor: `cezm-01` = Be, `sedde-01` = Be. Bu yüzden ilk 3 parça atlanır
  ve **dosya numarası harf numarasının bir eksiğidir**.
- Sıra tahmin edilmedi, **ölçüldü**: her parça mevcut kayıtlara MFCC parmak
  iziyle benzetildi. Kayma denetimi (`cezm`): ofset 0 → ortalama sıra 10.7,
  ofset ±1 → 30-31. Şedde'de Elif'li varsayım 11.5, Elif'siz 28.3.
  Yani sıralama doğru, üstelik bu kayıt mevcutlardan **AYRI BİR ÇEKİM**
  (aynı çekim olsaydı benzerlik 1.0 çıkardı).

## ⚠️ Tuzaklar

- **`silencedetect` bilimsel gösterim yazar** (`silence_start: 8.33333e-05`).
  Sade `[\d.]+` deseni üssü yutup 8.33 saniye sanıyordu → dosyanın başındaki
  sessizlik 8 saniyelik sahte bir parça oluyordu.
- **Şeddede eşik gevşek olmalı**: "ebbe" hecesinin ortasında (şeddede) duraklama
  var, `d=0.2` ile kelime ortadan ikiye bölünüyor (84 yerine 126 parça çıkıyor).
  `d=0.55-0.8` aralığında sonuç sabit: 84.
- **Hırıltılı ha'nın kuyruğu çok hafif**: -25 dB eşikle hırıltının kendisi
  kesiliyor (1.10 sn yerine 0.37 sn kalıyor). -45 dB gerekiyor.
- **Parmak izinde kanal ortalaması çıkarılmalı** (cepstral mean normalization);
  ham log-mel'de aynı kişinin bütün heceleri birbirine benziyor (farklı harfler
  0.95'e kadar çıkıyordu), ayrım yok oluyordu.

## Hangi aileler yenilendi

`hareke` `med` `tenvin` `cezm` `sedde` `basic` → **hepsi yeni çekim** (439 dosya).
⚠️ `basic` (harf adları) sonradan eklendi ve AYRI PARAMETRE ister: kesim eşiği
**-40 dB** (ötekilerde -25 dB sözün ilk hecesini kesiyordu) ve **+3.8 dB
kazanç** (ham kesim -26.8 dBFS ile bütün ailelerin altındaydı).
⚠️ `basic-uzun` (28 uzatmalı harf adı) **eklenmeyecek — bir daha da eklenmesin**
(kullanıcı kararı): uzatmayı zaten **7. konu (Med Harfleri)** öğretiyor, orada
84 kayıt var. Harf adını bir de uzatmalı okutmak aynı şeyi ikinci kez, üstelik
konu dışında öğretmek olurdu. `ha-hiriltili` de aynı sebeple dışarıda: karşılık
gelen bir kart yok.

Ölçüm: bütün aileler −20.9…−25.5 dBFS aralığında (4.6 dB), `basic` −24.2.
Eski `sedde` −31.9 idi, yani **11 dB kısıktı** — oyunda o kartlara gelince ses
düşüyordu; yeni sette bu kalktı.

## ⚠️ Ötümsüz ünsüzler yarıda kesiliyordu (`kuyruk.py`)

Kullanıcı bildirdi: **"ek ik ük… tam k diyorken yarıda kesiliyor"**.

**Sebep.** `kes.py` parçaları `silencedetect` ile **-25 dB** eşikte ayırıyor.
Ünlünün enerjisi ~-15 dB, ama ötümsüz bir ünsüz doğası gereği çok daha sessiz
ve iki ayrı şekilde kayboluyor:

| tür | ne oluyor | ölçüm (Kef "ek") |
|---|---|---|
| **patlamalı** ك ت | önce ağız kapanır → GERÇEK sessizlik, sonra patlama gelir ama -36 dB | ünlü 108.74-108.90 · kapanma 108.90-**109.19** · patlama **109.20-109.34** · kesim **109.008**'de bitiyor |
| **sızmalı** ث ف | hışırtı 0.3-0.4 sn sürüyor ama -45..-60 dB | Se'de 310 ms, Fe'de 250 ms hışırtı dışarıda kalıyor |

Yani patlama/hışırtı eşiğin altında olduğu için ffmpeg onu "sessizlik"e dahil
edip ATIYORDU. Çocuk "e" duyuyor, "k"yı hiç duymuyor.

**Kimler etkilendi.** Parça süresi ortancası 0.558 sn; en kısa dördü
**Kef 0.386 · Te 0.393 · Se 0.402 · Fe 0.410** — hepsi ötümsüz. (Elif de kısa
ama uygulama cezm-Elif'i kullanmıyor.) **Yalnız CEZM ailesi etkilendi**: hece
orada ünsüzle BİTİYOR. hareke/med/tenvin/şedde'de aynı harf hecenin BAŞINDA
(`ke`, `kâ`, `ken`, `ekke`) — ölçüldü, Kef'in süresi o ailelerde ortancayla
birebir aynı (hareke 0.783 ↔ 0.784, med 1.123 ↔ 1.123).

**Çözüm.** `kuyruk.py` bitişi İKİ AŞAMALI arar: (1) kesimden sonra ≤300 ms
içinde ses yeniden başlıyor mu? (2) başlıyorsa nerede bitiyor? Eşik -63 dB —
sessizlik tabanı (-80..-120 dB) ile en sessiz hışırtı (-61 dB) arasında.

⚠️ **TEK AŞAMALI ARAMA BÜTÜN SETİ BOZARDI**: "N ms sessizlik = bitti" kuralıyla
sabır 320 ms yapılınca **84 parçanın 84'ü** uzadı — araç heceden sonraki NEFES
sesini de kuyruk sanıyordu. İki aşamalı hâli 62'ye indirdi ama o da yetmez:
kalan çoğunluk zaten normal süreli, uzayan kısım nefes. Bu yüzden **yalnız
KANITI OLAN dört harf** onarıldı (kısa parça + arkasından gelen gerçek ses).
Kalanlar körlemesine yeniden yazılmadı.

⚠️ **DOĞRULAMA TAYFLA YAPILIR, süreyle değil.** Eklenen kuyruğun gerçekten
ünsüz olduğu tayf ağırlık merkeziyle ölçüldü: kuyruklar **1.6-6.2 kHz**,
ünlüler 0.4-1.3 kHz. Üstelik sıralama fonetiğe uyuyor — **/k/ (art damak)
en pes (1.6-3.2 kHz), /θ/ ve /t/ (diş) en tiz (4.3-6.2 kHz)**.

⚠️ **KAZANÇ EKLENMEZ.** Tepe değerleri eski dosyalarla BİREBİR aynı (ünlüye
dokunulmuyor); ortalama RMS 3-5 dB düşüyor çünkü sessiz ünsüz ortalamaya
giriyor. Kazanç eklemek ünlüyü ailenin üstüne çıkarırdı.

```bash
cd tools/ses && python3 kuyruk.py yeni_kuyruk     # → 12 dosya
```
Bekçi: `src/test/audioFiles.test.ts` → "cezimli ötümsüz ünsüzler yarıda kesik değil"
(dosya boyutu ailenin ortancasının %80'inin altına düşemez).
