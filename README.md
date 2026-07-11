# Elifmim

Çocuklar için Arapça harf, hareke, med ve tenvin öğrenme uygulaması.

## Geliştirme

```bash
npm install
cp .env.example .env   # Supabase bilgilerini doldur
npm run dev            # http://localhost:8080
```

Supabase (hesap, cihazlar arası devam, istatistik) kurulumu için:
**[docs/supabase-kurulum.md](docs/supabase-kurulum.md)**

## Özellikler

- 600+ gerçek hoca kaydıyla harf/hece sesleri, 11 oyun, SRS tabanlı öğrenme
- **Hesap (e-posta + Google):** ilerleme buluta yedeklenir, cihaz verisi
  silinse bile kaybolmaz
- **Hoca Modu + bulut senkronu:** hoca öğrencilerini ekler, 6 haneli bağlantı
  koduyla öğrenci başka cihazda (velinin telefonunda) kaldığı yerden devam eder
- **Hoca Paneli (`/hoca`):** öğrenci başına öğrenilen harfler, doğruluk,
  sıradaki harf ve seviye haritası
- **Admin istatistikleri (`/admin`):** öğrenme hızı (dakikada yeni harf),
  harf başına öğrenme süresi, DAU, retention, yaş dağılımı
- Capacitor ile mobil uygulamaya çevrilmeye hazır (bkz. kurulum dokümanındaki
  Capacitor notları)
