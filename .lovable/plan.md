## Amaç
Google/e-posta ile giriş/kayıt akışları arka planda çalışır kalsın, ancak kullanıcı hiçbir yerde giriş/kayıt butonu veya e-posta alanı görmesin. Misafir modu tek deneyim olacak.

## Yapılacak UI değişiklikleri

1. **`src/pages/Settings.tsx`** — `AccountCard` bileşenini render eden satırı kaldır (import'u da). Hesap kartı görünmesin.

2. **`src/pages/Index.tsx`** — Sağ üstteki "Giriş" / "Hesap" ikon butonunu kaldır (session'a bağlı `to="/giris"` linkini). Ayarlar zaten alt menüde erişilebilir.

3. **`src/pages/Progress.tsx`** — Misafir kullanıcıya gösterilen "Giriş yap" çağrısı bloğunu kaldır (satır 40–48 civarı). Bulut senkron uyarısını nötr bir metne indir ya da tamamen gizle.

4. **`src/pages/Auth.tsx`** — Route dursun ama sayfa doğrudan `/` adresine `<Navigate replace />` ile yönlensin (kimse yanlışlıkla `/giris` URL'sine gidip formu göremesin). Dosyanın geri kalanı silinmesin; ileride tekrar açmak kolay olsun.

5. **`src/pages/Paywall.tsx`** — `if (!session) navigate("/giris")` satırını, giriş sayfası artık boş olduğu için, toast ile "Şu an giriş kapalı" mesajına çevir veya satın alma butonlarını misafir için gizle. (En sade: bu kontrol bloğunu kaldır, satın alma akışı zaten `useSubscription` üzerinden gerekiyorsa öylece durur.)

## Dokunulmayacaklar
- `src/App.tsx` route tanımı (Auth route dursun, sadece içerik yönlendirsin).
- `src/hooks/useAuth.tsx`, `supabase` client, `lovable.auth.*`, `AccountCard.tsx` dosyası — silinmez, sadece render edilmez. Böylece geri açmak tek satırlık iş olur.
- Öğrenci profili (Hoca modu) ve SRS akışı etkilenmez.

## Doğrulama
- `/`, `/ayarlar`, `/ilerleme`, `/oyunlar` sayfalarında hiçbir giriş/Google butonu ya da e-posta alanı görünmemeli.
- `/giris` adresine elle gidildiğinde anasayfaya dönülmeli.
- Uygulama misafir olarak sorunsuz çalışmalı; tsc temiz olmalı.
