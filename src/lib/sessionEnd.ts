// Yüksek notada bitiş — Zeigarnik etkisi: seansı çocuk daha isterken, bir
// başarı anında ve yarını işaret ederek bitir. Yarım kalan iş beyni hafifçe
// meşgul eder → yarın geri dönme isteği artar. Bahçeye (koleksiyon kancası)
// bağlanır: "gel, bahçeni büyüt". Çocuk dostu, pozitif kapanış — suçluluk yok.
const TEASES = [
  "Bahçende yeni çiçekler seni bekliyor 🌸",
  "Yarın gel, bahçeni daha da büyüt! 🌳",
  "Harika iş! Bahçen seninle gurur duyuyor 🌻",
  "Bir sonraki çiçek çok yakın — yarın devam? 🌼",
  "Her gün biraz çalış, bahçen çiçek açsın 🌷",
];

export function gardenTease(): string {
  return TEASES[Math.floor(Math.random() * TEASES.length)];
}
