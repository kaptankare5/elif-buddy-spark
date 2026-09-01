# Performans ölçüm araçları

```
acilis.mjs    açılış hızı: eski paket ile yeni paketi yan yana koyar
oyunlar.mjs   14 oyunu tek tek açar, oynatır: fps · takılma · hata
3b.mjs        3B oyunların CİHAZDAN BAĞIMSIZ maliyeti: çizim çağrısı, üçgen
juice.mjs     ses/titreşim gerçekten çıkıyor mu (WebAudio çağrısı sayılır)
yogunluk.mjs  dakikada kaç harf soruluyor + ilk soruya kadar geçen süre
```

Kullanım:

```bash
npx vite build && npx vite preview --port 4173 --host 127.0.0.1 &
node tools/perf/oyunlar.mjs                 # hepsi
OYUN=subway,kart CPU=1 node tools/perf/oyunlar.mjs   # daralt / yavaşlatmayı kapat
node tools/perf/3b.mjs
```

## ⚠️ Tuzaklar — ölçüm yalan söyleyebilir

- **BU SANDBOXTA GPU YOK** (swiftshader = yazılım rasterleştirici). 3B oyunların
  fps'i gerçek telefonu TEMSİL ETMEZ: CPU profilinde %83 `(program)` çıkıyor,
  yani yazılım rasterleştirme. 3B için `3b.mjs`'in ölçtüğü **çizim çağrısı** ve
  **üçgen** sayısına bak — onlar cihazdan bağımsız.
- **Oyunu GERÇEKTEN başlatmadan ölçme.** Partisi ve Yarışı bölüm/pist seçme
  ekranıyla açılıyor; orada rAF boşta döndüğü için ölçüm "60 fps, min 60"
  veriyordu — oyun hiç çalışmamıştı. `oyunlar.mjs` menü düğmesine basar ve 3B
  oyunlarda canvas yoksa satırı `⚠ MENÜDE` diye işaretler.
- **FCP gözlemcisi sayfa AÇILMADAN bağlanmalı** (`addInitScript`); `goto`
  sonrası `getEntriesByName` 0 döndürüyor, boyanma çoktan olmuş oluyor.
- **Supabase istekleri kesilmeli**: sandboxta ağ yok, `networkidle` 13 sn şişiyor.
- **CPU 4x yavaşlatılır** (orta sınıf Android taklidi). Geliştirme makinesinde
  her oyun 60 fps veriyor, çocuğun telefonunda vermiyor.

## Öğrenme yoğunluğu ölçümü (`yogunluk.mjs`)

Bir harfin mp3'ünün çalması = o harfin sorulduğu an. Oyunun öğretme hızının
doğrudan ölçüsü. Ölçüldü (60 sn, rastgele oynayan bot):

```
balon 154⚠ · koşusu 58⚠ · hafıza 32 · quiz 23 · kutu 10
üçlü-eşle 8 · kuş 8 · yılan 7 · uzay 7 · üçlü-eşleştir 4 · yarışı 3
parti 2 · yapboz 1 · macera 0⚠
```

⚠ **Üç sayı temsili değil:** Balon'da bot saniyede ~4 dokunuyor (tavan değer);
Koşusu'nda başlıksız tarayıcıda ses çalma başarısız olunca kapı soruyu tekrar
deniyor (şişiyor); Macera'daki 0 botun platform atlayamamasından (oyunun değil).

⚠ **İLK SORUYA KADAR GEÇEN SÜRE de ölçülür** — bu, "ilk 90 saniyede eğlenceye
ulaş" kuralının öğrenme karşılığı. Uzay Savaşı 22.9 sn, Yapboz 43.5 sn,
Üçlü Eşleştir 49.6 sn: çocuk yarım dakikadan uzun süre hiç harf duymuyor.

## Tekerlek ölçümü (`teker.mjs`)

Yarışı'nda "ön tekerlekler havadaymış gibi" bildirimi göz kararıyla
çözülemezdi: **iki ayrı kusur aynı görüntüyü** veriyordu ve payları ancak
sayıyla ayrıldı. Araç, oyunun düğüm hiyerarşisini three.js ile birebir kurup
tekerleğin aksını ve en alt noktasını ölçer.

```
drift 1.00
  ESKİ  aks eğimi: en çok 35.5° · ortalama 16.4°  | yerden açıklık 0.373 (yarıçapın %60'ı)
  YENİ  aks eğimi: en çok  0.0°                   | yerden açıklık 0.000
```

- **Gövde eğimi tekerleği de yatırıyordu.** Gerçek araçta gövde süspansiyon
  üzerinde yatar, lastik yerde kalır → eğim artık `shell` düğümünde,
  tekerlekler `body`nin doğrudan çocuğu.
- **Yuvarlanma (X) ile direksiyon (Y) aynı Euler'deydi.** three.js "XYZ"
  sırasında matris Rx·Ry olur; direksiyon ekseni, sürekli büyüyen yuvarlanma
  açısıyla devriliyordu (Unity forumlarındaki klasik "ön teker gimbal"
  sorunu). Artık göbek (Y) ve tekerlek (X) AYRI düğüm.

Araç ayrıca Ackermann farkını (iç teker dıştan daha çok döner) ve göbek
deseninin **strobe sınırını** yazdırır: `n` kollu göbek karede π/n'den fazla
dönerse tekerlek geriye dönüyormuş gibi görünür (wagon-wheel etkisi), bu
yüzden görsel açısal hız `π/(n·dt)` ile kelepçelenir.

## Kırpma (`kirp.mjs`)

`node tools/perf/kirp.mjs kaynak.png cikti.png X Y EN BOY [ZOOM]` — telefon
ölçüsünde çekilen karede tekerlek göbeği gibi küçük ayrıntılar birkaç piksel
kalıyor; "düzeldi mi" sorusu göz kararına düşmesin diye bölgeyi büyütür.

## Ses zaman çizelgesi (`sesZaman.mjs`)

`juice.mjs` yalnız "ses çıktı mı" diye sayıyor. Bir SIRA tasarlarken bu
yetmiyor — yarış geri sayımının doğru ANDA ve doğru PERDEDE çaldığı
görülmeli. Araç WebAudio'nun osilatör frekans çağrılarını ve `start(t)`
zamanını sarmalayıp çizelgeyi yazdırır:

```
node tools/perf/sesZaman.mjs /oyunlar/kart "Bahçe Turu" 6000

   t      tür       dalga      perde (Hz)
  0.00   ton       square     700        ← tik "3"
  0.02   ton       sawtooth   88 → 132   ← ızgarada gaz blibi
  1.16   ton       square     700        ← tik "2"  (aynı perde)
  2.15   ton       square     700        ← tik "1"
  3.21   ton       square     1046       ← BAŞLA (tiz + uzun)
  3.21   ton       sawtooth   110 → 460  ← motor kalkışı
  3.27   gürültü   -          —          ← lastik cıyaklaması
```

⚠️ **İlk ölçüm bir hata yakaladı**: tikler 1.0 sn yerine **2.0 sn** arayla
çalıyordu. Sebep sesin kendisi değildi — geri sayım sayacı fizik dt'siyle
besleniyordu ve `DT_MAX` (0.05) 20 fps'in altındaki her kareyi kırpıyordu,
yani "3-2-1" yavaş cihazda 3.2 yerine 5.8 sn sürüyordu.

## Rota taraması (`tarama.mjs`)

`node tools/perf/tarama.mjs [cikti-dizini]` — 41 rotanın hepsini (bütün
sayfalar + 12 konu + 14 oyun) tek tek açar, **konsol hatalarını** toplar,
"sayfa boş mu / 404 mü" diye bakar ve her biri için ekran görüntüsü kaydeder.

⚠️ **NEDEN GEREKLİ:** birim testleri mantığı denetler, ekran görüntüsü
görünüşü — ama *"sayfa açılınca patlıyor mu"* ikisinin arasında kalıyor.
React'te bir render hatası, o bileşen test edilmiyorsa testlerde hiç
görünmez; ekran görüntüsünde de yalnız boş bir alan olarak çıkar ve
"tasarım böyle" sanılır. Bu araç `pageerror` (yakalanmamış istisna) ile
`console.error`'ı ayrı ayrı dinler.

⚠️ Ağ/kaynak hataları (`net::`, `Failed to load resource`) AYIKLANIR: bu
ortamda Google Fonts ve YouTube'a çıkış kapalı, onları saymak gerçek
hataları gürültüye gömüyordu.
