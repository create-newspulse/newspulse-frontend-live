import type { Lang } from "../src/i18n/LanguageProvider";

export type ScenicMediaItem = {
  id: string;
  title: string;
  description: string;
  duration: string;
  mood: string;
  ctaLabel: string;
  href: string;
  accentFrom: string;
  accentTo: string;
};

export type QuoteItem = {
  id: string;
  eyebrow: string;
  quote: string;
  support: string;
};

export type PositiveStoryItem = {
  id: string;
  category: string;
  title: string;
  summary: string;
  href: string;
};

type InspirationHubContent = {
  scenicMediaItems: ScenicMediaItem[];
  dailyWonderQuotes: QuoteItem[];
  positiveStoryItems: PositiveStoryItem[];
};

const INSPIRATION_HUB_CONTENT: Record<Lang, InspirationHubContent> = {
  en: {
    scenicMediaItems: [
      {
        id: "coastline-reset",
        title: "Coastline Reset",
        description: "Wide coastal passes, soft horizons, and a slower rhythm for a quick mental reset.",
        duration: "12 min watch",
        mood: "Ocean calm",
        ctaLabel: "Watch on YouTube",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(45,212,191,0.32)",
        accentTo: "rgba(14,165,233,0.20)",
      },
      {
        id: "forest-drift",
        title: "Forest Drift",
        description: "Tree canopy movement and gentle terrain visuals for a quieter mid-day pause.",
        duration: "8 min watch",
        mood: "Woodland ease",
        ctaLabel: "Open scenic set",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(34,197,94,0.28)",
        accentTo: "rgba(16,185,129,0.18)",
      },
      {
        id: "mountain-light",
        title: "Mountain Light",
        description: "High-elevation sunrise frames and open-sky movement designed for slow breathing.",
        duration: "10 min watch",
        mood: "Sunrise stillness",
        ctaLabel: "View feature",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(250,204,21,0.30)",
        accentTo: "rgba(56,189,248,0.16)",
      },
    ],
    dailyWonderQuotes: [
      {
        id: "pause",
        eyebrow: "Featured reflection",
        quote: "Pause long enough to notice what is still good, gentle, and growing around you.",
        support: "A short reminder for crowded days that need a little room again.",
      },
      {
        id: "light",
        eyebrow: "Visual reset",
        quote: "Soft light, steady breath, and one quiet thought can reset an entire afternoon.",
        support: "Keep this nearby when the pace is high and the signal is noisy.",
      },
      {
        id: "wonder",
        eyebrow: "Daily wonder",
        quote: "Wonder returns quickly when the mind is given a little room to wander without noise.",
        support: "A calm prompt for slowing down without checking out.",
      },
      {
        id: "forward",
        eyebrow: "Small momentum",
        quote: "You do not need a dramatic breakthrough to make today feel brighter than yesterday.",
        support: "Steady progress belongs here too.",
      },
    ],
    positiveStoryItems: [
      {
        id: "community-kindness",
        category: "Community",
        title: "Stories that spotlight quiet acts of care and local generosity",
        summary: "Follow community-driven reporting and local human-interest coverage that leaves readers with something constructive.",
        href: "/community-reporter",
      },
      {
        id: "youth-energy",
        category: "Youth Pulse",
        title: "Young achievers, campus momentum, and the people building tomorrow",
        summary: "Explore uplifting student stories, emerging voices, and next-generation ambition already shaping the feed.",
        href: "/youth-pulse",
      },
      {
        id: "lifestyle-rhythm",
        category: "Lifestyle",
        title: "Mood-lifting reads for balance, routines, and small daily upgrades",
        summary: "Continue with lighter reading across lifestyle coverage when you want something useful, warm, and easy to scan.",
        href: "/lifestyle",
      },
    ],
  },
  hi: {
    scenicMediaItems: [
      {
        id: "coastline-reset",
        title: "तटीय ठहराव",
        description: "विस्तृत तटीय दृश्य, नरम क्षितिज और दिमाग को हल्का करने वाली धीमी लय।",
        duration: "12 मिनट देखें",
        mood: "समुद्री शांति",
        ctaLabel: "YouTube पर देखें",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(45,212,191,0.32)",
        accentTo: "rgba(14,165,233,0.20)",
      },
      {
        id: "forest-drift",
        title: "वन की धीमी लय",
        description: "पेड़ों की हलचल और शांत भू-दृश्य, जो दोपहर की भागदौड़ में छोटा सा विराम दें।",
        duration: "8 मिनट देखें",
        mood: "जंगल की सहजता",
        ctaLabel: "दृश्य संग्रह खोलें",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(34,197,94,0.28)",
        accentTo: "rgba(16,185,129,0.18)",
      },
      {
        id: "mountain-light",
        title: "पहाड़ी उजाला",
        description: "ऊंचाई से दिखते सूर्योदय के दृश्य और खुला आकाश, धीमी सांसों के लिए तैयार।",
        duration: "10 मिनट देखें",
        mood: "सुबह की निस्तब्धता",
        ctaLabel: "फ़ीचर खोलें",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(250,204,21,0.30)",
        accentTo: "rgba(56,189,248,0.16)",
      },
    ],
    dailyWonderQuotes: [
      {
        id: "pause",
        eyebrow: "मुख्य चिंतन",
        quote: "इतना ठहरें कि आपके आसपास अब भी जो अच्छा, कोमल और बढ़ता हुआ है, वह दिख सके।",
        support: "भीड़भाड़ वाले दिन में फिर से थोड़ी जगह बनाने वाला छोटा सा स्मरण।",
      },
      {
        id: "light",
        eyebrow: "दृश्य विराम",
        quote: "हल्की रोशनी, स्थिर सांस और एक शांत विचार पूरी दोपहर का स्वर बदल सकते हैं।",
        support: "जब रफ्तार तेज हो और शोर बढ़ जाए, तो इसे पास रखें।",
      },
      {
        id: "wonder",
        eyebrow: "आज का आश्चर्य",
        quote: "जब मन को शोर से दूर थोड़ा भटकने की जगह मिलती है, तो विस्मय जल्दी लौट आता है।",
        support: "धीमा होने का शांत संकेत, बिना पीछे हटे।",
      },
      {
        id: "forward",
        eyebrow: "छोटी प्रगति",
        quote: "आज को कल से उजला महसूस कराने के लिए किसी नाटकीय बदलाव की ज़रूरत नहीं होती।",
        support: "स्थिर प्रगति भी यहीं मायने रखती है।",
      },
    ],
    positiveStoryItems: [
      {
        id: "community-kindness",
        category: "कम्युनिटी",
        title: "ऐसी स्टोरीज़ जो देखभाल और स्थानीय उदारता के शांत कामों को सामने लाती हैं",
        summary: "कम्युनिटी-आधारित रिपोर्टिंग और मानवीय कहानियाँ पढ़ें जो पाठकों को कुछ रचनात्मक देकर जाएँ।",
        href: "/community-reporter",
      },
      {
        id: "youth-energy",
        category: "यूथ पल्स",
        title: "युवा उपलब्धियाँ, कैंपस की गति और कल को आकार देने वाले लोग",
        summary: "छात्रों की प्रेरक स्टोरीज़, उभरती आवाज़ें और अगली पीढ़ी की महत्वाकांक्षा पढ़ें।",
        href: "/youth-pulse",
      },
      {
        id: "lifestyle-rhythm",
        category: "लाइफ़स्टाइल",
        title: "संतुलन, दिनचर्या और छोटे रोज़मर्रा सुधारों के लिए मन हल्का करने वाली रीड्स",
        summary: "जब आपको उपयोगी, गर्मजोशी भरा और आसानी से पढ़ा जाने वाला कुछ चाहिए, तब लाइफ़स्टाइल कवरेज में आगे बढ़ें।",
        href: "/lifestyle",
      },
    ],
  },
  gu: {
    scenicMediaItems: [
      {
        id: "coastline-reset",
        title: "કિનારાનો વિરામ",
        description: "વિસ્તૃત દરિયાકાંઠાના દૃશ્યો, નરમ ક્ષિતિજ અને મનને ધીમું પાડતી લય.",
        duration: "12 મિનિટ જુઓ",
        mood: "સમુદ્રી શાંતિ",
        ctaLabel: "YouTube પર જુઓ",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(45,212,191,0.32)",
        accentTo: "rgba(14,165,233,0.20)",
      },
      {
        id: "forest-drift",
        title: "વનની ધીમી ચાલ",
        description: "ઝાડોની હળવી હલચાલ અને શાંત ભૂદૃશ્યો, જે દિવસની વચ્ચે નાનકડો વિરામ આપે.",
        duration: "8 મિનિટ જુઓ",
        mood: "વનની સરળતા",
        ctaLabel: "દૃશ્ય સેટ ખોલો",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(34,197,94,0.28)",
        accentTo: "rgba(16,185,129,0.18)",
      },
      {
        id: "mountain-light",
        title: "પહાડનું પ્રકાશ",
        description: "ઊંચાઈ પરથી દેખાતા સૂર્યોદયના ફ્રેમ અને ખુલ્લું આકાશ, ધીમા શ્વાસ માટે રચાયેલ.",
        duration: "10 મિનિટ જુઓ",
        mood: "સૂર્યોદયની નિર્જનતા",
        ctaLabel: "ફીચર જુઓ",
        href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
        accentFrom: "rgba(250,204,21,0.30)",
        accentTo: "rgba(56,189,248,0.16)",
      },
    ],
    dailyWonderQuotes: [
      {
        id: "pause",
        eyebrow: "મુખ્ય વિચાર",
        quote: "એટલું થોભો કે તમારા આસપાસ હજી પણ જે સારો, નરમ અને વધતો રહ્યો છે તે દેખાઈ શકે.",
        support: "ભીડભરેલા દિવસે ફરી થોડી જગ્યા બનાવવા માટેનું નાનું સ્મરણ.",
      },
      {
        id: "light",
        eyebrow: "દૃશ્ય વિરામ",
        quote: "હળવો પ્રકાશ, સ્થિર શ્વાસ અને એક શાંત વિચાર આખી બપોરનો સ્વર બદલી શકે છે.",
        support: "જ્યારે ગતિ વધારે હોય અને શોર વધતો હોય ત્યારે આ યાદ રાખો.",
      },
      {
        id: "wonder",
        eyebrow: "આજનું અજાયબ",
        quote: "મનને શાંતિથી ભટકવા માટે થોડી જગ્યા મળે ત્યારે અજાયબી ઝડપથી પરત આવે છે.",
        support: "પાછા ખેંચાયા વગર ધીમા થવાનો શાંત સંકેત.",
      },
      {
        id: "forward",
        eyebrow: "નાનું આગળ વધવું",
        quote: "આજને ગતકાલ કરતાં થોડું વધુ ઉજળું લાગવા માટે નાટકીય ફેરફાર જરૂરી નથી.",
        support: "સ્થિર પ્રગતિ પણ અહીં મૂલ્યવાન છે.",
      },
    ],
    positiveStoryItems: [
      {
        id: "community-kindness",
        category: "કોમ્યુનિટી",
        title: "એવી વાર્તાઓ જે કાળજી અને સ્થાનિક ઉદારતાના શાંત કાર્યને પ્રકાશમાં લાવે છે",
        summary: "કોમ્યુનિટી આધારિત રિપોર્ટિંગ અને માનવીય રસની વાર્તાઓ વાંચો જે વાચકોને રચનાત્મક કંઈક આપે છે.",
        href: "/community-reporter",
      },
      {
        id: "youth-energy",
        category: "યુથ પલ્સ",
        title: "યુવા સિદ્ધિઓ, કેમ્પસની ઊર્જા અને આવતીકાલ ગઢતા લોકો",
        summary: "પ્રેરણાદાયક વિદ્યાર્થી વાર્તાઓ, ઉદ્ભવતી અવાજો અને આગામી પેઢીની મહત્ત્વાકાંક્ષા શોધો.",
        href: "/youth-pulse",
      },
      {
        id: "lifestyle-rhythm",
        category: "લાઇફસ્ટાઇલ",
        title: "સંતુલન, રૂટિન અને રોજિંદા નાના સુધારાઓ માટે મન ઉંચું કરતી વાંચન સામગ્રી",
        summary: "જ્યારે તમને ઉપયોગી, ઉષ્માભર્યું અને સરળતાથી વાંચી શકાય એવું કંઈક જોઈએ ત્યારે લાઇફસ્ટાઇલ કવરેજમાં આગળ વધો.",
        href: "/lifestyle",
      },
    ],
  },
};

export function getInspirationHubContent(lang: Lang): InspirationHubContent {
  return INSPIRATION_HUB_CONTENT[lang] || INSPIRATION_HUB_CONTENT.en;
}

export const scenicMediaItems: ScenicMediaItem[] = INSPIRATION_HUB_CONTENT.en.scenicMediaItems;

export const dailyWonderQuotes: QuoteItem[] = INSPIRATION_HUB_CONTENT.en.dailyWonderQuotes;

export const positiveStoryItems: PositiveStoryItem[] = INSPIRATION_HUB_CONTENT.en.positiveStoryItems;