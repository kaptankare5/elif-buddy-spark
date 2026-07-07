# ElifBâ Koşusu — Tasarım Dokümanı (v2)

3D eğitici sonsuz koşu oyunu. Elifbâ harf öğrenimini, refleks ve akış (flow)
mekanikleriyle birleştirir. Karakter olarak koşan çocuk resmi kullanılır.

## 1. Çekirdek mekanikler

- **3 şerit, otomatik ileri koşu.** Karakter durmaz; oyuncu yalnızca tepki verir.
- **Dört yön kontrol:** sola/sağa kaydır = şerit değiştir, yukarı kaydır = zıpla,
  aşağı kaydır = eğilerek kay (roll).
- **Engeller iki tiptir:** çoğu **sabit (park halinde)** durur; bazıları **oyuncuya
  doğru hareket eder**. Engel içinden geçilmez, üstünden zıplamayla aşılır.
- **Yüksek platformda koşma:** bazı engellerin **rampası** vardır; rampadan çıkıp
  üstte koşulur, üstte altın/güç toplanır ve **platformdan platforma zıplanır**.
- **Bariyer çeşitleri:** alçak bariyer (üstünden zıpla), üst bariyer/tabela
  (altından kayarak geç). Her bariyer tipi farklı aksiyon ister — çeşitlilik
  akışın kalbidir.
- **Güçler:** Jetpack (her şeyin üstünden uç), Süper Ayakkabı (yüksek zıpla),
  Mıknatıs (altınları çek), 2x Çarpan.
- **Altınlar** çizgi ve kavis halinde dizilir; yüksek platformlarda da bulunur.
- **Hız zamanla artar**; çarpışma = kalp kaybı. Çocuk dostu: kalp sistemi.

## 2. Eğitim döngüsü (oyunun "neden"i)

1. Ses hedef harfi söyler (**"be"**) ve soru HUD'da **yazılı** olarak da durur:
   "🎯 Hangisi: **be**?" — oyuncu hem duyar hem okur, istediğinde 🔊 tekrar dinler.
2. İleride, ekranı kaplayan **3 büyük harf panosu** (beyaz tabela üzerinde koyu,
   çok büyük Arapça harf — uzaktan okunur) 3 şeride dizilir.
3. Oyuncu koşarken şerit/zıplama/kayma ile manevra yapıp **doğru panonun içinden
   geçer**.
4. Doğru → doğru sesi, puan + seri bonusu, bazen güç. Yanlış → yanlış sesi, kalp
   ve puan kaybı, **doğru cevap ekranda gösterilir** (yanlıştan öğrenme).
5. Her cevap SRS'e işlenir (`recordGameAnswer`); süper modda yanlışlar tekrar
   kuyruğuna girer; ipucu halkası normal modda hep, süper modda yalnız seviye
   1'de görünür.

Pano dalgaları arasındaki bölge **saf sonsuz koşudur**: engeller, bariyerler,
altınlar. Böylece soru-cevap ritmi (öğrenme) ile refleks koşusu (eğlence/flow)
nöbetleşe akar; oyuncu ne sıkılır ne bunalır.

## 3. Mekanikler

### Hareket
- 3 şerit (x = −3.3 / 0 / +3.3), şeritler arası yumuşak geçiş.
- **Zıplama:** balistik (v₀≈11, g≈−30) → tepe ~2.0 birim; yüksek platform (1.7) çıkar.
- **Kayma:** 0.8 sn eğilme; üst bariyerin altından geçirir; görsel squash.
- **Yüksek platformda koşma:** rampa ile çıkılan platform üstü koşulabilir zemindir.
- **Rampalı vagon:** engelin oyuncuya bakan ucunda rampa varsa koşarak çıkılır
  (çarpma yok, destek yüksekliği rampa boyunca 0→1.7 tırmanır).

### Engeller (pano dalgaları arasında)
| Engel | Doğru aksiyon | Yanlışsa |
|---|---|---|
| Sabit engel (rampasız) | Şerit değiştir **veya** üstüne zıpla | Tökezleme |
| Sabit engel (rampalı) | Rampadan çık, üstte altın topla | — |
| Hareketli engel | Şeridi boşalt | Tökezleme |
| Alçak bariyer | Üstünden **zıpla** | Tökezleme |
| Üst tabela | Altından **kay** | Tökezleme |

Kurallar: her engel sırasında **en az bir şerit boş**; pano dalgasının 15 birim
önü engelsiz (cevap manevrasına alan); aynı anda en fazla 1 hareketli engel.

### Tökezleme (çocuk dostu çarpışma)
Anında ölüm yok: çarpınca kalp −1, yanlış sesi, kamera sarsıntısı, 1.4 sn
"hayalet" (yanıp söner, engellerden geçer, hız düşer). 3 kalp bitince oyun biter.

### Pano dalgaları
- **Yer panosu (varsayılan):** direkli tabelalar zeminde.
- **Yüksek pano (skor>30, ~%25):** 3 şeritte de rampalı engeller; panolar
  yüksek platform hizasında — üstte koşu anı. Cevap yine şeritle.

### Güçler (doğru cevapta şansla, tek seferde bir güç)
- 🚀 **Jetpack** (4.5 sn): her şeyin üstünden uçar, havada altın dizileri.
- ⭐ **2x Puan** (12 sn).
- 🧲 **Mıknatıs** (10 sn): yakındaki altınları şerit fark etmeksizin toplar.

### Skor & zorluk
- Doğru pano: 10 + seri bonusu (2×'te iki katı). Yanlış: −5, seri sıfırlanır.
- Altın: +2. Hız 13'ten 24'e skorla tırmanır; engel sıklığı hafifçe artar.

## 4. Teknik

- **React Three Fiber** (`three` zaten bağımlılıkta), tek `<Canvas>`.
- **Arapça harfler canvas dokusuyla** (512px, beyaz pano + koyu harf): tarayıcı
  metin şekillendirmesi kullanıldığından harekeler kusursuz; troika'ya gerek yok.
- **Koşan çocuk karakteri** şeffaf PNG olarak yüklenir ve sprite/levha olarak
  sahneye yerleştirilir.
- **Tek dünya grubu** ileri kayar (`group.position.z = D`); tüm engel/pano/altın
  sabit yerel z'de durur → hareket tek yerde. Hareketli engeller ek yerel
  hızla ilerler.
- **Tek simülasyon döngüsü** (Director `useFrame`): fizik (y/vy/destek), çarpışma,
  spawn zamanlaması, kamera. React state yalnızca olaylarla değişir (spawn,
  cevap, altın) — 60fps re-render yok.
- Sekme arka planından dönüşte delta 0.05 sn'e kıstırılır (ışınlanma önlenir).

## 5. Kontroller

| Girdi | Aksiyon |
|---|---|
| ◀▶ kaydırma / ok tuşları / A-D / ekran kenarına dokun | Şerit |
| ▲ kaydırma / ↑ / W / Space | Zıpla |
| ▼ kaydırma / ↓ / S | Kay |
| Ekran ortasına dokun / 🔊 Dinle | Soruyu tekrar dinle |
| Alt buton sırası: ⬅ ⬆ ⬇ ➡ | Dokunmatik alternatif |
