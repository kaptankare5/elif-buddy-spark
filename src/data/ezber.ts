// Ezber içeriği: sureler/dualar KÜÇÜK ANLAM PARÇALARINA bölünmüş halde.
//
// Parça boyutu bilinçli olarak "nefes grubu" (1-4 kelime): tek tek kelime
// ezberi tecvid akışını böler, tam ayet ise çocuk için çok uzundur. Hafızlık
// geleneğindeki "devamını getir" (anticipation) yöntemi bu parçalarla işler:
// sistem bilinen parçaları gösterir/okur, sıradaki zayıf parçayı gizler,
// çocuk hatırlamaya çalışır, sonra kendini işaretler.
export interface EzberSegment {
  id: string;
  ar: string;   // Arapça (harekeli)
  tr: string;   // Türkçe okunuş
}

export interface EzberSura {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  segments: EzberSegment[];
}

const seg = (id: string, ar: string, tr: string): EzberSegment => ({ id, ar, tr });

export const SURAS: EzberSura[] = [
  {
    id: "ihlas",
    title: "İhlâs Sûresi",
    emoji: "💎",
    desc: "Kul hüvellâhü ehad...",
    segments: [
      seg("b", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ", "Bismillâhirrahmânirrahîm"),
      seg("1a", "قُلْ هُوَ اللّٰهُ اَحَدٌ", "Kul hüvellâhü ehad"),
      seg("2a", "اَللّٰهُ الصَّمَدُ", "Allâhüssamed"),
      seg("3a", "لَمْ يَلِدْ", "Lem yelid"),
      seg("3b", "وَلَمْ يُولَدْ", "ve lem yûled"),
      seg("4a", "وَلَمْ يَكُنْ لَهُ", "Ve lem yekün lehû"),
      seg("4b", "كُفُوًا اَحَدٌ", "küfüven ehad"),
    ],
  },
  {
    id: "fatiha",
    title: "Fâtiha Sûresi",
    emoji: "🌟",
    desc: "Elhamdü lillâhi rabbil âlemîn...",
    segments: [
      seg("b", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ", "Bismillâhirrahmânirrahîm"),
      seg("1a", "اَلْحَمْدُ لِلّٰهِ", "Elhamdü lillâhi"),
      seg("1b", "رَبِّ الْعَالَم۪ينَ", "rabbil âlemîn"),
      seg("2a", "اَلرَّحْمٰنِ الرَّح۪يمِ", "Errahmânirrahîm"),
      seg("3a", "مَالِكِ يَوْمِ الدّ۪ينِ", "Mâliki yevmiddîn"),
      seg("4a", "اِيَّاكَ نَعْبُدُ", "İyyâke na'büdü"),
      seg("4b", "وَاِيَّاكَ نَسْتَع۪ينُ", "ve iyyâke neste'în"),
      seg("5a", "اِهْدِنَا الصِّرَاطَ الْمُسْتَق۪يمَ", "İhdinessırâtal müstekîm"),
      seg("6a", "صِرَاطَ الَّذ۪ينَ اَنْعَمْتَ عَلَيْهِمْ", "Sırâtallezîne en'amte aleyhim"),
      seg("7a", "غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ", "Gayril mağdûbi aleyhim"),
      seg("7b", "وَلَا الضَّٓالّ۪ينَ", "ve leddâllîn"),
    ],
  },
  {
    id: "felak",
    title: "Felak Sûresi",
    emoji: "🌅",
    desc: "Kul e'ûzü birabbil felak...",
    segments: [
      seg("b", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ", "Bismillâhirrahmânirrahîm"),
      seg("1a", "قُلْ اَعُوذُ بِرَبِّ الْفَلَقِ", "Kul e'ûzü birabbil felak"),
      seg("2a", "مِنْ شَرِّ مَا خَلَقَ", "Min şerri mâ halak"),
      seg("3a", "وَمِنْ شَرِّ غَاسِقٍ", "Ve min şerri gâsikın"),
      seg("3b", "اِذَا وَقَبَ", "izâ vekab"),
      seg("4a", "وَمِنْ شَرِّ النَّفَّاثَاتِ", "Ve min şerrinneffâsâti"),
      seg("4b", "فِي الْعُقَدِ", "fil ukad"),
      seg("5a", "وَمِنْ شَرِّ حَاسِدٍ", "Ve min şerri hâsidin"),
      seg("5b", "اِذَا حَسَدَ", "izâ hased"),
    ],
  },
  {
    id: "nas",
    title: "Nâs Sûresi",
    emoji: "🛡️",
    desc: "Kul e'ûzü birabbinnâs...",
    segments: [
      seg("b", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ", "Bismillâhirrahmânirrahîm"),
      seg("1a", "قُلْ اَعُوذُ بِرَبِّ النَّاسِ", "Kul e'ûzü birabbinnâs"),
      seg("2a", "مَلِكِ النَّاسِ", "Melikinnâs"),
      seg("3a", "اِلٰهِ النَّاسِ", "İlâhinnâs"),
      seg("4a", "مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ", "Min şerril vesvâsil hannâs"),
      seg("5a", "اَلَّذ۪ي يُوَسْوِسُ", "Ellezî yüvesvisü"),
      seg("5b", "ف۪ي صُدُورِ النَّاسِ", "fî sudûrinnâs"),
      seg("6a", "مِنَ الْجِنَّةِ وَالنَّاسِ", "Minel cinneti vennâs"),
    ],
  },
  {
    id: "kevser",
    title: "Kevser Sûresi",
    emoji: "🏞️",
    desc: "İnnâ a'taynâkel kevser...",
    segments: [
      seg("b", "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ", "Bismillâhirrahmânirrahîm"),
      seg("1a", "اِنَّٓا اَعْطَيْنَاكَ الْكَوْثَرَ", "İnnâ a'taynâkel kevser"),
      seg("2a", "فَصَلِّ لِرَبِّكَ وَانْحَرْ", "Fesalli lirabbike venhar"),
      seg("3a", "اِنَّ شَانِئَكَ هُوَ الْاَبْتَرُ", "İnne şânieke hüvel ebter"),
    ],
  },
  {
    id: "subhaneke",
    title: "Sübhâneke Duası",
    emoji: "🤲",
    desc: "Sübhânekellâhümme ve bihamdik...",
    segments: [
      seg("1", "سُبْحَانَكَ اللّٰهُمَّ", "Sübhânekellâhümme"),
      seg("2", "وَبِحَمْدِكَ", "ve bihamdik"),
      seg("3", "وَتَبَارَكَ اسْمُكَ", "ve tebârakesmük"),
      seg("4", "وَتَعَالٰى جَدُّكَ", "ve teâlâ ceddük"),
      seg("5", "وَلَٓا اِلٰهَ غَيْرُكَ", "ve lâ ilâhe gayrük"),
    ],
  },
];

export function getSura(id: string): EzberSura | undefined {
  return SURAS.find((s) => s.id === id);
}
