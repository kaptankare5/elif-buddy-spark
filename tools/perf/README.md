# Performans ölçüm araçları

```
acilis.mjs    açılış hızı: eski paket ile yeni paketi yan yana koyar
oyunlar.mjs   15 oyunu tek tek açar, oynatır: fps · takılma · hata
3b.mjs        3B oyunların CİHAZDAN BAĞIMSIZ maliyeti: çizim çağrısı, üçgen
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
