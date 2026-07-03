## Hedef
Hesap açıkken harf seviyeleri, tekrar sistemi ve ilerleme ekranı artık tarayıcı verisine bağlı kalmayacak; her cevap kullanıcının kendi hesabına bağlı backend kaydına yazılacak ve ekranlar aynı kullanıcı kaydından okuyacak.

## Bulduğum ana sorun
- `letter_stats` ve `answer_events` tablolarında `user_id` alanı var; yani veri kullanıcıya bağlanabilecek şekilde tasarlanmış.
- Ama Data API izinleri görünmüyor: `information_schema.role_table_grants` sonucu boş. Bu, uygulamanın hesap açıkken tabloyu okuyamamasına/yazamamasına ve ekranların 0 göstermesine yol açabilir.
- `record_letter_answer` fonksiyonu şu an `SECURITY INVOKER`; tablo izinleri eksik olduğunda fonksiyon içindeki kayıt işlemleri de takılabilir.
- Backend’de geçmiş kayıtlar var, fakat son cevap kayıtları artık düzenli akmıyor görünüyor.

## Uygulama planı

1. **Backend tablo izinlerini kesinleştir**
   - `letter_stats` ve `answer_events` için giriş yapmış kullanıcıya okuma/yazma/güncelleme izinlerini açıkça vereceğim.
   - `service_role` için yönetim erişimini açıkça vereceğim.
   - Anon erişim açmayacağım; bu ilerleme verileri sadece giriş yapan kullanıcıya ait olmalı.

2. **Kayıt fonksiyonunu kullanıcı bazlı ve güvenilir yap**
   - `record_letter_answer` fonksiyonunu, giriş yapan kullanıcının `auth.uid()` değerini kullanarak kayıt yapacak şekilde koruyacağım.
   - Fonksiyon cevabı `letter_stats.user_id = auth.uid()` altında güncelleyecek.
   - Doğru cevapta seviye `1→2→3→4`, yanlış cevapta `4→3→2→1` olarak backend’de güncellenecek.
   - Fonksiyon çalıştırma iznini giriş yapmış kullanıcıya açıkça vereceğim.

3. **Okuma tarafını kullanıcı hesabına sabitle**
   - `hydrateSrsFromCloud`, `getCloudSrsState` ve ilerleme ekranı okumaları sadece aktif kullanıcının `user_id` değerine göre çalışacak.
   - Veri yüklenmeden ekranda `0` gösterilmeyecek; yükleme durumu korunacak.
   - Veri gelince seviye kutuları ve toplam ilerleme doğrudan backend’den gelen kullanıcı verisine göre hesaplanacak.

4. **Test/oyun cevap kayıtlarını bekletmeden backend’e yazdır**
   - Oyunlarda `recordSrsAnswer` şu an async çağrılıp beklenmiyor; hata sessiz kalabiliyor.
   - Bunu görünür ve güvenilir hale getireceğim: kayıt başarısız olursa event/console üzerinden net hata üretilecek, başarılı olursa ilgili ekranlar tekrar yüklenecek.

5. **Seviye kutularını backend state’e bağla**
   - Konu/test üstündeki Seviye 1/2/3/4 kutuları sadece local cache’e güvenmeyecek.
   - Hesap açıkken önce backend state kullanılacak; local cache sadece hızlı ekran güncellemesi için ikinci kaynak olacak.

6. **Doğrulama**
   - Migration sonrası izinleri tekrar sorgulayacağım.
   - Bir kullanıcı için `letter_stats` satırlarının `user_id` altında geldiğini kontrol edeceğim.
   - `record_letter_answer` fonksiyonunun yeni cevap sonrası ilgili kullanıcının satırını artırdığını doğrulayacağım.
   - Progress ekranındaki yükleme bittikten sonra 0 yerine gerçek kullanıcı verisinin görünmesi hedeflenecek.

## Teknik detay
- Etkilenecek ana dosyalar: `src/data/srs.ts`, `src/data/cloudSync.ts`, `src/lib/gameProgress.ts`, `src/pages/Progress.tsx`, `src/pages/Topic.tsx`.
- Backend değişikliği migration ile yapılacak.
- Yeni tablo oluşturulmayacak; mevcut `letter_stats` ve `answer_events` kullanıcı bazlı kayıt kaynağı olarak kullanılacak.