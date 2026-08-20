import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteHead } from "@/components/RouteHead";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/settings";
import { playFeedback } from "@/lib/audio";
import { Volume2, Vibrate, GraduationCap, Shield, Trash2, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { useGameMode, FREE_PLAY_MIN_SEEN } from "@/lib/gameMode";
import { freePlaySeenCount } from "@/pages/games/_shared";
import { cn } from "@/lib/utils";
import { ASK_MODES, useAskMode, FLASH_PRESETS, useFlashMs, yaziliSik } from "@/lib/askMode";
import { ZORLUKLAR, useZorluk, type Zorluk } from "@/lib/zorluk";
import { titresimAcik, setTitresimAcik } from "@/lib/titresim";
import { FlashKalibre } from "@/components/FlashKalibre";
import { consentGiven, setConsent, deleteMyAnalytics, updateMyProfile } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
// import { AccountCard } from "@/components/AccountCard"; // UI gizlendi
import { clearLocalProgress, hydrateSrsFromCloud } from "@/data/srs";
import { ConfirmDestructive } from "@/components/ConfirmDestructive";
import { toast } from "sonner";
import { useTestUnlock, useDebugMode, useTestPanel, tryUnlockWithCode, closeTestPanel } from "@/lib/testUnlock";
import { KeyRound, Users, Ruler } from "lucide-react";
import { useStudents, addStudent, removeStudent, switchStudent } from "@/lib/students";


const Settings = () => {
  const [s, set] = useSettings();
  const [mode, setMode] = useGameMode();
  const [ask, setAsk] = useAskMode();
  const [zorluk, setZorluk] = useZorluk();
  const [titresim, setTitresimState] = useState(titresimAcik);
  const [flashMs, setFlashMs] = useFlashMs();
  const [kalibre, setKalibre] = useState(false);
  // ⚠️ OKUMA ONAYI: Şimşek/Tabela şıkları LATİN harfle yazılı. Çocuk Türkçe
  // okuyamıyorsa bu modlar onun için ölçüm bile yapamaz — her soruyu
  // rastgele işaretler ve SRS bunu "bilmiyor" sanır. Mod ilk kez seçilirken
  // veliye BİR KEZ soruluyor.
  const [okumaSor, setOkumaSor] = useState<null | (typeof ASK_MODES)[number]["id"]>(null);
  const modSec = (id: (typeof ASK_MODES)[number]["id"]) => {
    if (yaziliSik(id) && !yaziliSik(ask)) setOkumaSor(id);
    else setAsk(id);
  };
  const { session } = useAuth();
  const [consent, setConsentState] = useState(consentGiven());
  const [confirmCloudDel, setConfirmCloudDel] = useState(false);
  const [confirmDeviceDel, setConfirmDeviceDel] = useState(false);
  const [deviceScope, setDeviceScope] = useState<"active" | "guest" | "all">(session ? "active" : "guest");
  const [testUnlock, setTestUnlock] = useTestUnlock();
  const [debugMode, setDebugMode] = useDebugMode();
  const testPanel = useTestPanel();
  // Serbest Oyun kilidi: havuz yalnız GÖRÜLMÜŞ harflerden kurulduğu için
  // yeterince harf tanınmadan oyun 4 şık bile kuramaz.
  const seenCount = freePlaySeenCount();
  const freeReady = seenCount >= FREE_PLAY_MIN_SEEN;
  // Şart bozulduysa (ilerleme silindi vb.) sessizce Süper Öğrenme'ye dön.
  useEffect(() => {
    if (!freeReady && mode === "normal") setMode("super");
  }, [freeReady, mode, setMode]);
  const [unlockCode, setUnlockCode] = useState("");
  const { students, active: activeStudent } = useStudents();
  const [studentName, setStudentName] = useState("");

  const submitStudent = () => {
    const s = addStudent(studentName);
    if (s) { setStudentName(""); toast.success(`${s.name} eklendi ${s.emoji}`); }
    else toast.error("İsim boş olamaz.");
  };

  const submitUnlockCode = () => {
    if (tryUnlockWithCode(unlockCode)) {
      toast.success("Test paneli açıldı — hangi anahtarı istediğini seç.");
      setUnlockCode("");
    } else {
      toast.error("Kod yanlış.");
    }
  };

  useEffect(() => {
    const fn = () => setConsentState(consentGiven());
    window.addEventListener("miniakil:consent-changed", fn);
    return () => window.removeEventListener("miniakil:consent-changed", fn);
  }, []);
  const toggleConsent = async (v: boolean) => {
    setConsent(v); setConsentState(v);
    if (session) await updateMyProfile({ analytics_consent: v });
  };

  const doCloudDelete = async () => {
    const res = await deleteMyAnalytics();
    if (res.ok) toast.success("Analitik verilerin silindi. Öğrenme ilerlemen korunuyor.");
    else toast.error("Silme başarısız: " + (res.error ?? "bilinmeyen hata"));
  };

  const doDeviceDelete = async () => {
    clearLocalProgress(deviceScope);
    if (session?.user.id) await hydrateSrsFromCloud(session.user.id).catch(() => {});
    toast.success("Cihazdaki önbellek silindi; hesap verisi yeniden yüklendi.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      <RouteHead
        title="Ayarlar — ElifMim"
        description="Ses, titreşim, oyun modu, hoca modu ve gizlilik tercihlerini yönet."
        path="/ayarlar"
        noindex
      />
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="⚙️ Ayarlar" backTo="/" centered />

        {/* <AccountCard /> — hesap UI şimdilik gizli */}

        <div className="space-y-3">
          {/* Veli Paneli — veliye yönelik günlük özet + övgü tetikleyicisi */}
          <Link
            to="/veli"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-info to-primary p-4 text-white shadow-card transition-bouncy hover:-translate-y-1"
          >
            <span className="text-3xl">👪</span>
            <div className="flex-1">
              <div className="text-base font-extrabold text-shadow-soft">Veli Paneli</div>
              <div className="text-[11px] font-semibold opacity-90">Çocuğunuz bugün ne öğrendi? Günlük özet →</div>
            </div>
          </Link>

          {/* Ölçüm Modu — çocuk hangi harf hallerini önceden biliyor? */}
          <Link
            to="/olcum"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-warning to-topic-pink p-4 text-white shadow-card transition-bouncy hover:-translate-y-1"
          >
            <Ruler className="h-8 w-8 shrink-0" />
            <div className="flex-1">
              <div className="text-base font-extrabold text-shadow-soft">📏 Ölçüm Modu</div>
              <div className="text-[11px] font-semibold opacity-90">Başta/ortada/sonda hallerinden hangilerini zaten biliyor? →</div>
            </div>
          </Link>

          {/* Araştırma modülü — mevcut ilerlemeye hiç dokunmaz.
              ⚠️ Bu blok LOVABLE tarafından eklendi; bir kez benim commit'imde
              ezildi (ben Settings.tsx'i kendi dalımdan alıp main'e yazdım,
              Lovable'ınki dalımda yoktu). main'e dosya taşırken o dosyayı
              Lovable de değiştirmiş mi diye BAKMAK gerekiyor. */}
          <Link
            to="/deney"
            className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40 transition-bouncy hover:-translate-y-1"
          >
            <span className="text-3xl">🧪</span>
            <div className="flex-1">
              <div className="text-base font-extrabold text-foreground">Aktarım Deneyi (araştırma)</div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                Ayrı ölçüm aracı — öğrenme ilerlemesine yazmaz →
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <Volume2 className="h-7 w-7 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-foreground">Ses Efektleri</h3>
              <p className="text-xs text-muted-foreground">Doğru/yanlış kısa sesler</p>
            </div>
            <Switch
              checked={s.sound}
              onCheckedChange={(v) => { set({ sound: v }); if (v) setTimeout(() => playFeedback(true), 100); }}
            />
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <Vibrate className="h-7 w-7 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-foreground">Titreşim</h3>
              <p className="text-xs text-muted-foreground">Yanlış cevapta telefon titrer</p>
            </div>
            <Switch
              checked={s.vibrate}
              onCheckedChange={(v) => { set({ vibrate: v }); if (v) setTimeout(() => playFeedback(false), 100); }}
            />
          </div>

          {/* Oyun Modu — Serbest Oyun en az FREE_PLAY_MIN_SEEN görülmüş harften
              sonra açılır: havuzu yalnız görülmüş harfler olduğu için daha
              azıyla oyun 4 şık kuramaz. */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <div className="flex items-center gap-3 mb-3">
              <GraduationCap className="h-7 w-7 text-primary" />
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-foreground">Oyun Modu</h3>
                <p className="text-xs text-muted-foreground">Öğrenme zorluğunu seç</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => freeReady && setMode("normal")}
                disabled={!freeReady}
                className={cn(
                  "rounded-2xl p-3 border-2 font-extrabold text-sm text-left transition-bouncy",
                  !freeReady
                    ? "bg-muted/30 border-border text-muted-foreground opacity-60"
                    : mode === "normal"
                      ? "bg-primary text-primary-foreground border-primary shadow-soft"
                      : "bg-muted/40 border-border text-foreground",
                )}
              >
                {freeReady ? "🎮 Serbest Oyun" : "🔒 Serbest Oyun"}
                <div className="text-[10px] font-bold text-muted-foreground mt-1">
                  {freeReady
                    ? "Sadece eğlence"
                    : `${seenCount}/${FREE_PLAY_MIN_SEEN} harf — önce biraz öğrenelim`}
                </div>
              </button>
              <button
                onClick={() => setMode("super")}
                className={cn(
                  "rounded-2xl p-3 border-2 font-extrabold text-sm text-left transition-bouncy relative",
                  mode === "super"
                    ? "bg-warning text-warning-foreground border-warning shadow-soft"
                    : "bg-muted/40 border-border text-foreground",
                )}
              >
                ⚡ Süper Öğrenme
                <div className="text-[10px] font-bold text-muted-foreground mt-1">Her zaman test, hep ilerleme</div>
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              <b>Süper Öğrenme:</b> her oyun cevabı harfin seviyesine işler. Bir harfi
              ilk kez görüyorsan doğru şık parlamaz — gerçekten biliyor musun, onu
              ölçüyoruz; sonraki karşılaşmalarda zorlanırsan ipucu halkası gelir.
              <br />
              <b>Serbest Oyun:</b> seviye değişmez, ipuçları hep açıktır ve
              <b> yalnız daha önce gördüğün harfler</b> çıkar — yeni bir harfle ilk
              tanışma her zaman Süper Öğrenme'de, Test'te veya Flashcard'da olur.
              <br />
              <b>Yıldızlar nasıl kazanılır:</b> ilk dört yıldız hızlı gelir —
              harfi ilk kez bilmek ⭐⭐⭐, hemen ardından bir doğru daha
              <b>⭐⭐⭐⭐ "öğrendi"</b> yapar, aynı oturumda olabilir.
              <b>⭐⭐⭐⭐⭐ "ustalaştı"</b> ise <b>ayrı günlere yayılmış</b>
              tekrarla verilir; aynı gün üst üste doğru yapmak saymaz.
              <b>Flashcard</b> (harfi gör, adını kendin söyle) <b>5 günde</b>,
              oyun ve test (şıktan seçme) <b>6 günde</b> kazandırır: şıkta şansla
              tutturmak ve eleyerek bulmak mümkün olduğu için tek cevap yarım
              sayılır. İkisi karışık oynanırsa kanıtlar toplanır. Yani oyun da
              son yıldızı verir — sadece daha uzun yoldan.
            </p>
          </div>

          {/* OYUN ZORLUĞU */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-primary/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🎚️</span>
              <h3 className="font-extrabold text-foreground text-sm">Oyun zorluğu</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
              <b>15 oyunun hepsinde</b> geçerli. Hız oyunlarında (Koşusu, Macera,
              Parti, Yarışı…) başlangıç hızını, ne kadar çabuk zorlaştığını ve
              <b>can sayısını</b>; Hızlı Quiz'de <b>süreyi</b>; Hafıza, Üçlü Eşleştir,
              Kutu Boşalt ve Yapboz'da <b>tahtanın büyüklüğünü</b> belirler.
              Oyunlar sabit hızda gitmiyor: doğru cevap verdikçe hızlanıyorlar.
              Zorluk oyuna <b>girerken</b> dondurulur.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ZORLUKLAR) as Zorluk[]).map((z) => (
                <button
                  key={z}
                  onClick={() => setZorluk(z)}
                  className={cn(
                    "rounded-2xl p-2 border-2 text-left transition-bouncy",
                    zorluk === z ? "bg-primary/15 border-primary shadow-soft" : "bg-muted/40 border-border",
                  )}
                >
                  <div className="text-xs font-extrabold text-foreground">
                    {ZORLUKLAR[z].emoji} {ZORLUKLAR[z].ad}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground leading-tight mt-0.5">
                    {ZORLUKLAR[z].aciklama}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              ⚠️ Kolay modda <b>şık sayısı azalır</b> (2 şık). Şansla doğru yapma
              ihtimali arttığı için bu kolaylık <b>yalnız yeni öğrenilen harflerde</b>
              geçerlidir; çocuğun bildiği harflerde şık sayısı düşmez ve az şıklı
              doğru cevap <b>daha az kanıt</b> sayılır — seviye şansla şişmez.
            </p>
          </div>

          {/* Titreşim — oyun hissi (juice) */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-primary/30">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📳</span>
                  <h3 className="font-extrabold text-foreground text-sm">Titreşim</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Oyunlarda para toplarken, çarparken ve doğru cevapta telefon
                  hafifçe titrer. Bilgisayarda ve çoğu iPhone'da etkisizdir.
                </p>
              </div>
              <button
                onClick={() => { setTitresimAcik(!titresim); setTitresimState(!titresim); }}
                role="switch"
                aria-checked={titresim}
                aria-label="Titreşim"
                className={cn(
                  "relative h-11 w-[76px] shrink-0 rounded-full border-2 transition-bouncy",
                  titresim ? "bg-primary/20 border-primary" : "bg-muted border-border",
                )}
              >
                <span className={cn(
                  "absolute top-1 h-7 w-7 rounded-full bg-card shadow-card transition-bouncy",
                  titresim ? "left-[42px]" : "left-1",
                )} />
                <span className={cn(
                  "absolute inset-y-0 flex items-center text-[10px] font-extrabold",
                  titresim ? "left-3 text-primary" : "right-3 text-muted-foreground",
                )}>{titresim ? "AÇIK" : "KAPALI"}</span>
              </button>
            </div>
          </div>

          {/* DENEYSEL: oyunda soru sorma yöntemi */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-gold/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🧪</span>
              <h3 className="font-extrabold text-foreground text-sm">Oyunda soru yöntemi (deneme)</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
              Şu an oyunlar <b>sesi duyup harfi seçtiriyor</b>. Asıl hedef ise tersi:
              harfi <b>görüp adını söylemek</b> (Elifbâ kitabının sorduğu yön).
              Dört yeni yöntem soruyu bu yöne çevirir:
            </p>
            <ul className="text-[11px] text-muted-foreground mb-3 leading-snug list-disc pl-4 space-y-0.5">
              <li><b>Şimşek / Tabela</b> — şıklar harfin <b>yazılı adı</b>
                (Latin harfi okumayı gerektirir).</li>
              <li><b>Ses Şıkları</b> — harf ekranda durur, şıklar 🔊 düğmesidir.
                Çocuk dinleyip eşleştirir; <b>okuma gerekmez</b>. İlk dokunuş
                dinletir, ikinci dokunuş seçer.</li>
              <li><b>Şekil Eşleme</b> — harfin <b>başka bir hâli</b> asılır
                (ـبـ gibi), şıklar harflerin yalın hâlidir. Bunu ses hiç
                soramaz: bir harfin başta/ortada/sonda hâlleri aynı kaydı
                çalıyor, o yüzden 84 şekil oyunlarda hiç ölçülemiyordu.</li>
            </ul>
            <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
              Şu oyunlarda çalışır: <b>Yarışı, Partisi, Hızlı Quiz, Balon,
              Uzay Savaşı, Uçan Kuş, Kutu Boşalt, Elifbâ Macerası, Yılan</b>.
              Doğru bilince harfin <b>gerçek okunuşu</b> da çalar — yazı Latin
              harfle olduğu için sesi duymadan yarım kalıyordu.
              Hafıza/Eşleştirme/Üçlü/Yapboz'da soru zaten görsel olduğu için
              bu yöntemler geçerli değil.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ASK_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => modSec(m.id)}
                  className={cn(
                    "rounded-2xl p-2 border-2 text-left transition-bouncy",
                    ask === m.id
                      ? "bg-gold/20 border-gold shadow-soft"
                      : "bg-muted/40 border-border",
                  )}
                >
                  <div className="text-xs font-extrabold text-foreground">{m.ad}</div>
                  <div className="text-[10px] font-bold text-muted-foreground leading-tight mt-0.5">
                    {m.aciklama}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              ⚠️ <b>Şimşek</b> ve <b>Tabela</b> Latin harflerini okuyabilmeyi
              gerektirir; çocuk henüz Türkçe okuyamıyorsa <b>Ses Şıkları</b>
              ya da <b>Şekil Eşleme</b> uygun. Ses Şıkları ve Şekil Eşleme
              yalnız sıra tabanlı oyunlarda çalışır (Balon, Hızlı Quiz, Kutu
              Boşalt); kaçma/vurma oyunlarında şıkkın kendisi engel olduğu için
              Klasiğe düşer. Değişiklik <b>bir sonraki oyunda</b> geçerli olur.
            </p>

            {ask === "flash" && (
              <div className="mt-3 rounded-2xl border-2 border-border/60 bg-muted/30 p-2.5">
                <h4 className="text-xs font-extrabold text-foreground mb-1">⚡ Şimşek süresi</h4>
                <div className="grid grid-cols-4 gap-1.5">
                  {FLASH_PRESETS.map((f) => (
                    <button
                      key={f.ms}
                      onClick={() => setFlashMs(f.ms)}
                      className={cn(
                        "rounded-xl px-1 py-1.5 border-2 transition-bouncy",
                        flashMs === f.ms ? "bg-gold/20 border-gold shadow-soft" : "bg-card border-border",
                      )}
                    >
                      <div className="text-[11px] font-extrabold text-foreground">{f.ad}</div>
                      <div className="text-[9px] font-bold text-muted-foreground">{(f.ms / 1000).toFixed(1)} sn</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setKalibre(true)}
                  className="mt-2 w-full rounded-xl border-2 border-primary/40 bg-primary/10 px-3 py-2 text-xs font-extrabold text-primary"
                >
                  📏 Bu çocuk için ölç — doğru süreyi bul
                </button>
                <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                  Harf oyunun <b>tam ortasında</b> parlar; öncesinde küçük bir halka
                  bakışı oraya çeker. Harfi <b>tanımak</b> için 0.3 sn zaten yeter
                  (yetişkinde ~0.05 sn, çocukta 2-3 katı). Asıl sınır <b>bakış</b>:
                  gözü başka yere çevirmek 8 yaşında ~0.4 sn sürüyor — bu yüzden
                  harf ortada beliriyor. <b>Çocuk için 0.5 sn öneriliyor</b>;
                  0.3 sn'yi deneyip <i>kaçırıyor mu</i> diye bakın.
                </p>
              </div>
            )}
          </div>

          {/* Test paneli — ⚠️ KİLİT ve DEBUG AYRI ANAHTARLAR (kullanıcı şartı):
              ikisi birlikteyken HUD'ı açmak isteyen veli bütün konuları da
              açmış oluyor ve uygulamayı normal oyuncu gibi test edemiyordu. */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <div className="flex items-center gap-3 mb-3">
              <KeyRound className="h-7 w-7 text-primary" />
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-foreground">Test Paneli</h3>
                <p className="text-xs text-muted-foreground">
                  {testPanel
                    ? "İki ayrı anahtar — istediğini aç, ötekini kapalı bırak"
                    : "Kod gir, test anahtarları görünsün"}
                </p>
              </div>
            </div>
            {testPanel ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-border/60 bg-background px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-foreground">🔓 Tüm konuları aç</div>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                      Kilitli konular, bölümler ve oyun bölümleri açılır.
                      <b> Kapalı bırakırsan normal oyuncu gibi test edersin</b> —
                      kilitler ve bölüm açılışları yerinde durur.
                    </p>
                  </div>
                  <Switch checked={testUnlock} onCheckedChange={setTestUnlock} aria-label="Tüm konuları aç" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-border/60 bg-background px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-foreground">🐞 Debug göstergeleri</div>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                      Kartlarda seviye rozeti (YENİ / L1-L5), köşede Debug HUD,
                      Macera'da blok seviyesi. İlerlemeye ve kilitlere DOKUNMAZ.
                    </p>
                  </div>
                  <Switch checked={debugMode} onCheckedChange={setDebugMode} aria-label="Debug göstergeleri" />
                </div>
                <button
                  onClick={() => { closeTestPanel(); toast.success("Test paneli kapatıldı."); }}
                  className="w-full rounded-xl border-2 border-destructive/40 px-3 py-2 text-[11px] font-extrabold text-destructive active:scale-95"
                >
                  Test panelini tamamen kapat
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={unlockCode}
                  onChange={(e) => setUnlockCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitUnlockCode(); }}
                  placeholder="Kod"
                  className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={submitUnlockCode}
                  className="rounded-xl bg-primary text-primary-foreground px-4 py-2 font-extrabold text-sm active:scale-95"
                >
                  Aç
                </button>
              </div>
            )}
          </div>

          {/* Hoca Modu — cihazda öğrenci profilleri */}
          <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-7 w-7 text-primary" />
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-foreground">👨‍🏫 Hoca Modu</h3>
                <p className="text-xs text-muted-foreground">
                  Öğrenci ekle; sayfa başlığındaki avatardan öğrenci değiştir.
                  Her öğrencinin ilerlemesi (seviye, kilitli bölümler) ayrı tutulur.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitStudent(); }}
                placeholder="Öğrenci adı"
                className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={submitStudent}
                className="rounded-xl bg-primary text-primary-foreground px-4 py-2 font-extrabold text-sm active:scale-95"
              >
                Ekle
              </button>
            </div>

            {students.length > 0 ? (
              <div className="space-y-1.5">
                {students.map((st) => (
                  <div
                    key={st.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 px-3 py-2",
                      activeStudent?.id === st.id ? "border-primary bg-primary/10" : "border-border bg-muted/30",
                    )}
                  >
                    <span className="text-lg">{st.emoji}</span>
                    <span className="flex-1 text-sm font-extrabold text-foreground truncate">{st.name}</span>
                    {activeStudent?.id === st.id ? (
                      <span className="text-[10px] font-extrabold text-primary">AKTİF</span>
                    ) : (
                      <button
                        onClick={() => switchStudent(st.id)}
                        className="rounded-lg bg-primary/15 px-2 py-1 text-[11px] font-extrabold text-primary"
                      >
                        Seç
                      </button>
                    )}
                    <button
                      onClick={() => { if (window.confirm(`${st.name} silinsin mi? İlerlemesi de silinir.`)) removeStudent(st.id); }}
                      aria-label={`${st.name} profilini sil`}
                      className="rounded-lg bg-destructive/10 p-1.5 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {activeStudent && (
                  <button
                    onClick={() => switchStudent(null)}
                    className="mt-1 w-full rounded-xl border-2 border-border bg-muted/40 py-2 text-xs font-extrabold text-foreground"
                  >
                    🧑 Cihaz sahibine (bana) dön
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[11px] font-bold text-muted-foreground">
                Henüz öğrenci yok. Öğrenci eklersen sayfa başlığında profil düğmesi belirir.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => playFeedback(true)}
            className="rounded-2xl bg-success/15 border-2 border-success/40 p-4 font-extrabold text-success shadow-soft active:scale-95"
          >
            ✓ Doğru sesi
          </button>
          <button
            onClick={() => playFeedback(false)}
            className="rounded-2xl bg-destructive/15 border-2 border-destructive/40 p-4 font-extrabold text-destructive shadow-soft active:scale-95"
          >
            ✗ Yanlış sesi
          </button>
        </div>




        {/* Gizlilik */}
        <div className="mt-6 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <h3 className="text-base font-extrabold">Gizlilik & Veri</h3>
              <p className="text-xs text-muted-foreground">Anonim kullanım verisi toplama</p>
            </div>
            <Switch checked={consent} onCheckedChange={toggleConsent} />
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
            Kimlik bilgisi (ad, foto, doğum tarihi) saklanmaz. Sadece hangi oyun ne kadar
            oynandı ve hangi ekranlar kullanıldı gibi anonim veriler — uygulamayı geliştirmek için.
          </p>
          {session && (
            <button
              onClick={() => setConfirmCloudDel(true)}
              className="w-full rounded-xl bg-destructive/10 text-destructive border-2 border-destructive/30 py-2 font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Kullanım verilerimi sil
            </button>
          )}
        </div>

        {/* Cihaz verileri */}
        <div className="mt-6 rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <h3 className="text-base font-extrabold flex-1">📱 Cihaz verileri</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
            Bu cihazda tutulan ilerleme önbelleğini siler. <strong>Buluttaki verin etkilenmez</strong>;
            tekrar giriş yaptığında hesabından geri yüklenir.
          </p>
          {session && (
            <div className="mb-3 space-y-1">
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="dscope" checked={deviceScope === "active"} onChange={() => setDeviceScope("active")} />
                Yalnız bu hesabın cihaz önbelleği
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="dscope" checked={deviceScope === "guest"} onChange={() => setDeviceScope("guest")} />
                Yalnız misafir ilerlemesi
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="dscope" checked={deviceScope === "all"} onChange={() => setDeviceScope("all")} />
                Hepsi (bu hesap + misafir)
              </label>
            </div>
          )}
          <button
            onClick={() => setConfirmDeviceDel(true)}
            className="w-full rounded-xl bg-destructive/10 text-destructive border-2 border-destructive/30 py-2 font-extrabold text-sm flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> Cihazdaki ilerlememi sil
          </button>
        </div>

        <ConfirmDestructive
          open={confirmCloudDel}
          onOpenChange={setConfirmCloudDel}
          title="Kullanım verilerin silinsin mi?"
          description="Oyun oturumları ve ekran kullanım kayıtları silinir. Öğrenme ilerlemen ve seviye kayıtların korunur."
          finalDescription="Bu işlem geri alınamaz; ancak tekrar sistemi ve ilerleme seviyeleri silinmez."
          confirmLabel="Evet, sil"
          onConfirm={doCloudDelete}
        />

        <ConfirmDestructive
          open={confirmDeviceDel}
          onOpenChange={setConfirmDeviceDel}
          title="Cihazdaki ilerleme silinsin mi?"
          description={
            session
              ? "Yalnızca bu cihazdaki önbellek silinir. Buluttaki ilerlemen yerinde kalır ve tekrar giriş yapınca geri yüklenir."
              : "Misafir ilerlemen bu cihazdan silinir. Hesabın olmadığı için geri yüklenemez."
          }
          finalDescription="Bu işlem geri alınamaz."
          confirmLabel="Evet, sil"
          onConfirm={doDeviceDelete}
        />
      </main>

      {/* Şimşek süresi ölçümü — çocuğa özel eşik (bkz. FlashKalibre). */}
      {kalibre && <FlashKalibre onClose={() => setKalibre(false)} />}

      {/* ⚠️ OKUMA ONAYI: yazılı modlar Latin harf okumayı gerektirir. Çocuk
          okuyamıyorsa mod ÖLÇÜM BİLE YAPAMAZ — her soru rastgele işaretlenir
          ve SRS bunu "harfi bilmiyor" sanıp seviyeyi düşürür. Mod ilk kez
          seçilirken veliye bir kez sorulur. */}
      {okumaSor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <h3 className="mb-2 text-base font-extrabold text-foreground">📖 Bir kontrol</h3>
            <p className="text-sm leading-snug text-muted-foreground">
              Bu modda şıklar <b>Latin harfleriyle yazılı</b> olacak. Çocuk
              aşağıdaki gibi kelimeleri <b>okuyabiliyor mu?</b>
            </p>
            <div className="my-3 flex justify-center gap-2">
              {["Elif", "Cim", "Sin"].map((k) => (
                <span key={k} className="rounded-xl border-2 border-primary/30 bg-muted/40 px-3 py-2 text-lg font-extrabold">{k}</span>
              ))}
            </div>
            <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
              Okuyamıyorsa bu mod ölçüm bile yapamaz: çocuk her soruyu rastgele
              işaretler, uygulama da bunu &quot;harfi bilmiyor&quot; sanar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setAsk(okumaSor); setOkumaSor(null); }}
                className="flex-1 rounded-full bg-primary px-4 py-2.5 font-extrabold text-primary-foreground shadow-card"
              >
                Evet, okuyabiliyor
              </button>
              <button onClick={() => setOkumaSor(null)} className="rounded-full bg-muted px-4 py-2.5 font-bold">
                Hayır
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default Settings;
