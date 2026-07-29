import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <main className="container mx-auto max-w-2xl">
        <Link to="/" className="text-primary text-sm font-semibold underline">← Ana sayfa</Link>
        <h1 className="mt-4 mb-2 text-3xl font-extrabold text-primary">Gizlilik Politikası</h1>
        <p className="text-sm text-muted-foreground mb-6">Endless Mum — Son güncelleme: 2026</p>

        <section className="space-y-4 text-sm leading-relaxed text-foreground">
          <h2 className="text-xl font-bold mt-6">Toplanan Veriler</h2>
          <p>
            Bu uygulama, kullanıcının ilerlemesini kaydetmek amacıyla güvenli bulut altyapısı kullanır.
            Normal kullanımda, kullanıcıya özel anonim bir kimlik (ID) oluşturulur.
          </p>
          <p>
            Kapalı test sürecinde veya kullanıcıların oyunla ilgili sorun bildirmek, öneri sunmak ya da
            benzeri amaçlarla bize e-posta, WhatsApp veya benzeri yollarla ulaşması durumunda; bu iletişim
            bilgileri (ör. e-posta adresi, isim) uygulamadaki anonim ID ile ilişkilendirilebilir.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Konularla ilgili doğru/yanlış cevaplar</li>
            <li>Kullanıcının karşılaştığı içerikler (harf, kelime, kavram vb.)</li>
            <li>Öğrenilme seviyeleri (kutu seviyeleri)</li>
            <li>Toplam oynama süresi</li>
            <li>Kapalı test veya iletişim sırasında alınabilecek kişisel bilgiler (yalnızca gönüllü paylaşıldığında)</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">Verilerin Kullanımı</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Kullanıcının hangi içerikleri öğrendiğini anlamak</li>
            <li>Uygulamada kişiye özel içerik sunmak</li>
            <li>İlerlemeyi devam ettirmek</li>
            <li>Kullanıcı sorunlarını çözmek, öneri ve danışma taleplerine yanıt vermek</li>
            <li>Uygulamanın işlevselliğini ve eğitim kalitesini artırmak</li>
          </ul>

          <h2 className="text-xl font-bold mt-6">Kişisel Bilgi Alınıyor mu?</h2>
          <p>
            Evet. Kapalı test sürecinde ve kullanıcılar bizimle doğrudan iletişime geçtiğinde, kişisel
            olarak tanımlanabilir bilgiler (ör. e-posta adresi) toplanabilir. Bu bilgiler yalnızca destek,
            geliştirme ve iletişim amaçlı kullanılır, üçüncü kişilerle izinsiz paylaşılmaz.
          </p>

          <h2 className="text-xl font-bold mt-6">Veriler Kimseyle Paylaşılır mı?</h2>
          <p>
            Veriler, yalnızca uygulamanın geliştirilmesi ve iyileştirilmesi için yetkilendirilmiş kişilerle
            (ör. danışmanlar, ekip üyeleri) paylaşılabilir. Bu kişiler de gizlilik kurallarına uymak zorundadır.
            Veriler, kullanıcı onayı olmadan üçüncü taraflara satılmaz veya pazarlama amacıyla paylaşılmaz.
          </p>

          <h2 className="text-xl font-bold mt-6">Çocuklar İçin Güvenli mi?</h2>
          <p>
            Uygulama her yaşa uygundur. Ancak 13 yaş altı kullanıcılar için ebeveyn gözetimi önerilir.
            Hesap oluşturma ve veri paylaşımı işlemleri yalnızca veli sıfatıyla gerçekleştirilebilir.
          </p>

          <h2 className="text-xl font-bold mt-6">Verilerimi Nasıl Silebilirim?</h2>
          <p>
            Verilerinizin silinmesini istiyorsanız aşağıdaki iletişim adresinden bize ulaşabilirsiniz.
            Uygulamayı kaldırmanız yalnızca cihazınızdaki yerel verileri siler; bulutta tutulan veriler
            ve iletişim bilgileri otomatik olarak silinmez.
          </p>

          <h2 className="text-xl font-bold mt-6">İletişim</h2>
          <p>
            Gizlilikle ilgili sorular ve veri silme talepleri için:{" "}
            <a href="mailto:yamik21@itu.edu.tr" className="text-primary underline">yamik21@itu.edu.tr</a>
          </p>
        </section>
      </main>
    </div>
  );
}
