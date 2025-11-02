export type LanguageKey = 'english' | 'hindi' | 'gujarati';

// Helper: pick label by language with fallback to English
function byLang(labels: { english: string; hindi?: string; gujarati?: string }, lang: LanguageKey) {
  if (lang === 'hindi' && labels.hindi) return labels.hindi;
  if (lang === 'gujarati' && labels.gujarati) return labels.gujarati;
  return labels.english;
}

// =========================
// India States and UTs
// =========================
export const STATE_LABELS: Record<string, { english: string; hindi: string; gujarati: string }> = {
  'andhra-pradesh': { english: 'Andhra Pradesh', hindi: 'आंध्र प्रदेश', gujarati: 'આંધ્ર પ્રદેશ' },
  'arunachal-pradesh': { english: 'Arunachal Pradesh', hindi: 'अरुणाचल प्रदेश', gujarati: 'અરુણાચલ પ્રદેશ' },
  'assam': { english: 'Assam', hindi: 'असम', gujarati: 'આસામ' },
  'bihar': { english: 'Bihar', hindi: 'बिहार', gujarati: 'બિહાર' },
  'chhattisgarh': { english: 'Chhattisgarh', hindi: 'छत्तीसगढ़', gujarati: 'છત્તીસગઢ' },
  'goa': { english: 'Goa', hindi: 'गोवा', gujarati: 'ગોવા' },
  'gujarat': { english: 'Gujarat', hindi: 'गुज़रात', gujarati: 'ગુજરાત' },
  'haryana': { english: 'Haryana', hindi: 'हरियाणा', gujarati: 'હરિયાણા' },
  'himachal-pradesh': { english: 'Himachal Pradesh', hindi: 'हिमाचल प्रदेश', gujarati: 'હિમાચલ પ્રદેશ' },
  'jharkhand': { english: 'Jharkhand', hindi: 'झारखण्ड', gujarati: 'ઝારખંડ' },
  'karnataka': { english: 'Karnataka', hindi: 'कर्नाटक', gujarati: 'કર્ણાટક' },
  'kerala': { english: 'Kerala', hindi: 'केरल', gujarati: 'કેરળ' },
  'madhya-pradesh': { english: 'Madhya Pradesh', hindi: 'मध्य प्रदेश', gujarati: 'મધ્ય પ્રદેશ' },
  'maharashtra': { english: 'Maharashtra', hindi: 'महाराष्ट्र', gujarati: 'મહારાષ્ટ્ર' },
  'manipur': { english: 'Manipur', hindi: 'मणिपुर', gujarati: 'મણિપુર' },
  'meghalaya': { english: 'Meghalaya', hindi: 'मेघालय', gujarati: 'મેઘાલય' },
  'mizoram': { english: 'Mizoram', hindi: 'मिज़ोरम', gujarati: 'મિઝોરમ' },
  'nagaland': { english: 'Nagaland', hindi: 'नागालैंड', gujarati: 'નાગાલેન્ડ' },
  'odisha': { english: 'Odisha', hindi: 'ओडिशा', gujarati: 'ઓડિશા' },
  'punjab': { english: 'Punjab', hindi: 'पंजाब', gujarati: 'પંજાબ' },
  'rajasthan': { english: 'Rajasthan', hindi: 'राजस्थान', gujarati: 'રાજસ્થાન' },
  'sikkim': { english: 'Sikkim', hindi: 'सिक्किम', gujarati: 'સિક્કિમ' },
  'tamil-nadu': { english: 'Tamil Nadu', hindi: 'तमिलनाडु', gujarati: 'તમિલનાડુ' },
  'telangana': { english: 'Telangana', hindi: 'तेलंगाना', gujarati: 'તેલંગાણા' },
  'tripura': { english: 'Tripura', hindi: 'त्रिपुरा', gujarati: 'ત્રિપુરા' },
  'uttar-pradesh': { english: 'Uttar Pradesh', hindi: 'उत्तर प्रदेश', gujarati: 'ઉત્તર પ્રદેશ' },
  'uttarakhand': { english: 'Uttarakhand', hindi: 'उत्तराखंड', gujarati: 'ઉત્તરાખંડ' },
  'west-bengal': { english: 'West Bengal', hindi: 'पश्चिम बंगाल', gujarati: 'પશ્ચિમ બંગાળ' }
};

export const UT_LABELS: Record<string, { english: string; hindi: string; gujarati: string }> = {
  'andaman-and-nicobar-islands': { english: 'Andaman and Nicobar Islands', hindi: 'अंडमान और निकोबार द्वीपसमूह', gujarati: 'અન્ડામાન અને નિકોબાર દ્વીપસમૂહ' },
  'chandigarh': { english: 'Chandigarh', hindi: 'चंडीगढ़', gujarati: 'ચંડીગઢ' },
  'dadra-and-nagar-haveli-and-daman-and-diu': { english: 'Dadra and Nagar Haveli and Daman and Diu', hindi: 'दादरा और नगर हवेली और दमन और दीव', gujarati: 'દાદરા અને નગર હવેલી અને દમણ અને દીવ' },
  'delhi': { english: 'Delhi', hindi: 'दिल्ली', gujarati: 'દિલ્હી' },
  'jammu-and-kashmir': { english: 'Jammu and Kashmir', hindi: 'जम्मू और कश्मीर', gujarati: 'જમ્મુ અને કાશ્મીર' },
  'ladakh': { english: 'Ladakh', hindi: 'लद्दाख', gujarati: 'લદ્દાખ' },
  'lakshadweep': { english: 'Lakshadweep', hindi: 'लक्षद्वीप', gujarati: 'લક્ષદ્વીપ' },
  'puducherry': { english: 'Puducherry', hindi: 'पुडुचेरी', gujarati: 'પુડુચેરી' }
};

// =========================
// Gujarat Districts
// =========================
export const GUJ_DISTRICT_LABELS: Record<string, { english: string; hindi: string; gujarati: string }> = {
  'ahmedabad': { english: 'Ahmedabad', hindi: 'अहमदाबाद', gujarati: 'અમદાવાદ' },
  'amreli': { english: 'Amreli', hindi: 'अमरेली', gujarati: 'અમરેલી' },
  'anand': { english: 'Anand', hindi: 'आनंद', gujarati: 'આનંદ' },
  'aravalli': { english: 'Aravalli', hindi: 'अरावली', gujarati: 'અરવલ્લી' },
  'banaskantha': { english: 'Banaskantha', hindi: 'बनासकांठा', gujarati: 'બનાસકાંઠા' },
  'bharuch': { english: 'Bharuch', hindi: 'भरूच', gujarati: 'ભરૂચ' },
  'bhavnagar': { english: 'Bhavnagar', hindi: 'भावनगर', gujarati: 'ભાવનગર' },
  'botad': { english: 'Botad', hindi: 'बोटाद', gujarati: 'બોટાદ' },
  'chhota-udaipur': { english: 'Chhota Udaipur', hindi: 'छोटा उदयपुर', gujarati: 'છોટાઉદેપુર' },
  'dahod': { english: 'Dahod', hindi: 'दाहोद', gujarati: 'દાહોદ' },
  'dang': { english: 'Dang', hindi: 'डांग', gujarati: 'ડાંગ' },
  'devbhoomi-dwarka': { english: 'Devbhoomi Dwarka', hindi: 'देवभूमि द्वारका', gujarati: 'દેવભૂમિ દ્વારકા' },
  'gandhinagar': { english: 'Gandhinagar', hindi: 'गांधीनगर', gujarati: 'ગાંધીનગર' },
  'gir-somnath': { english: 'Gir Somnath', hindi: 'गिर सोमनाथ', gujarati: 'ગીર સોમનાથ' },
  'jamnagar': { english: 'Jamnagar', hindi: 'जामनगर', gujarati: 'જામનગર' },
  'junagadh': { english: 'Junagadh', hindi: 'जूनागढ़', gujarati: 'જૂનાગઢ' },
  'kheda': { english: 'Kheda', hindi: 'खेड़ा', gujarati: 'ખેડા' },
  'kutch': { english: 'Kutch', hindi: 'कच्छ', gujarati: 'કચ્છ' },
  'mahisagar': { english: 'Mahisagar', hindi: 'महिसागर', gujarati: 'મહિસાગર' },
  'mehsana': { english: 'Mehsana', hindi: 'मेहसाणा', gujarati: 'મહેસાણા' },
  'morbi': { english: 'Morbi', hindi: 'मोरबी', gujarati: 'મોરબી' },
  'narmada': { english: 'Narmada', hindi: 'नर्मदा', gujarati: 'નર્મદા' },
  'navsari': { english: 'Navsari', hindi: 'नवसारी', gujarati: 'નવસારી' },
  'panchmahal': { english: 'Panchmahal', hindi: 'पंचमहल', gujarati: 'પંચમહાલ' },
  'patan': { english: 'Patan', hindi: 'पाटन', gujarati: 'પાટણ' },
  'porbandar': { english: 'Porbandar', hindi: 'पोरबंदर', gujarati: 'પોરબંદર' },
  'rajkot': { english: 'Rajkot', hindi: 'राजकोट', gujarati: 'રાજકોટ' },
  'sabarkantha': { english: 'Sabarkantha', hindi: 'साबरकांठा', gujarati: 'સાબરકાંઠા' },
  'surat': { english: 'Surat', hindi: 'सूरत', gujarati: 'સુરત' },
  'surendranagar': { english: 'Surendranagar', hindi: 'सुरेंद्रनगर', gujarati: 'સુરેન્દ્રનગર' },
  'tapi': { english: 'Tapi', hindi: 'तापी', gujarati: 'તાપી' },
  'vadodara': { english: 'Vadodara', hindi: 'वडोदरा', gujarati: 'વડોદરા' },
  'valsad': { english: 'Valsad', hindi: 'वलसाड', gujarati: 'વલસાડ' }
};

// =========================
// Gujarat Major Cities (subset overlaps districts)
// =========================
export const GUJ_CITY_LABELS: Record<string, { english: string; hindi: string; gujarati: string }> = {
  'ahmedabad': { english: 'Ahmedabad', hindi: 'अहमदाबाद', gujarati: 'અમદાવાદ' },
  'surat': { english: 'Surat', hindi: 'सूरत', gujarati: 'સુરત' },
  'vadodara': { english: 'Vadodara', hindi: 'वडोदरा', gujarati: 'વડોદરા' },
  'rajkot': { english: 'Rajkot', hindi: 'राजकोट', gujarati: 'રાજકોટ' },
  'bhavnagar': { english: 'Bhavnagar', hindi: 'भावनगर', gujarati: 'ભાવનગર' },
  'jamnagar': { english: 'Jamnagar', hindi: 'जामनगर', gujarati: 'જામનગર' },
  'junagadh': { english: 'Junagadh', hindi: 'जूनागढ़', gujarati: 'જૂનાગઢ' },
  'gandhinagar': { english: 'Gandhinagar', hindi: 'गांधीनगर', gujarati: 'ગાંધીનગર' },
  'navsari': { english: 'Navsari', hindi: 'नवसारी', gujarati: 'નવસારી' },
  'gandhidham': { english: 'Gandhidham', hindi: 'गांधीधाम', gujarati: 'ગાંધીધામ' },
  'morbi': { english: 'Morbi', hindi: 'मोरबी', gujarati: 'મોરબી' },
  'vapi': { english: 'Vapi', hindi: 'वापी', gujarati: 'વાપી' },
  'anand': { english: 'Anand', hindi: 'आनंद', gujarati: 'આનંદ' },
  'nadiad': { english: 'Nadiad', hindi: 'नडियाद', gujarati: 'નડિયાદ' },
  'mehsana': { english: 'Mehsana', hindi: 'मेहसाणा', gujarati: 'મહેસાણા' },
  'porbandar': { english: 'Porbandar', hindi: 'पोरबंदर', gujarati: 'પોરબંદર' },
  'surendranagar': { english: 'Surendranagar', hindi: 'सुरेंद्रनगर', gujarati: 'સુરેન્દ્રનગર' }
};

// =========================
// Headings
// =========================
export function tHeading(
  lang: LanguageKey,
  key: 'regional' | 'national' | 'states' | 'state' | 'union-territories' | 'union-territory' | 'top-cities' | 'district' | 'districts' | 'city' | 'cities'
) {
  const map: Record<string, { english: string; hindi: string; gujarati: string }> = {
    'regional': { english: 'Regional', hindi: 'क्षेत्रीय', gujarati: 'પ્રાદેશિક' },
    'national': { english: 'National', hindi: 'राष्ट्रीय', gujarati: 'રાષ્ટ્રીય' },
    'states': { english: 'States', hindi: 'राज्य', gujarati: 'રાજ્યો' },
    'state': { english: 'State', hindi: 'राज्य', gujarati: 'રાજ્ય' },
    'union-territories': { english: 'Union Territories', hindi: 'केंद्र शासित प्रदेश', gujarati: 'કેન્દ્રશાસિત પ્રદેશો' },
    'union-territory': { english: 'Union Territory', hindi: 'केंद्र शासित प्रदेश', gujarati: 'કેન્દ્રશાસિત પ્રદેશ' },
    'top-cities': { english: 'Top Cities (Mahanagarpalika)', hindi: 'शीर्ष शहर (महानगरपालिका)', gujarati: 'ટોપ શહેરો (મહાનગરપાલિકા)' },
    'district': { english: 'District', hindi: 'ज़िला', gujarati: 'જિલ્લો' },
    'districts': { english: 'Districts', hindi: 'ज़िले', gujarati: 'જિલ્લાઓ' },
    'city': { english: 'City', hindi: 'शहर', gujarati: 'શહેર' },
    'cities': { english: 'Cities', hindi: 'शहर', gujarati: 'શહેરો' }
  };
  return byLang(map[key], lang);
}

export function getStateName(lang: LanguageKey, slug: string, fallback?: string) {
  const labels = STATE_LABELS[slug];
  return labels ? byLang(labels, lang) : (fallback || slug);
}
export function getUTName(lang: LanguageKey, slug: string, fallback?: string) {
  const labels = UT_LABELS[slug];
  return labels ? byLang(labels, lang) : (fallback || slug);
}
export function getRegionName(lang: LanguageKey, type: 'state'|'ut', slug: string, fallback?: string) {
  return type === 'state' ? getStateName(lang, slug, fallback) : getUTName(lang, slug, fallback);
}
export function getGujaratDistrictName(lang: LanguageKey, slug: string, fallback?: string) {
  const labels = GUJ_DISTRICT_LABELS[slug];
  return labels ? byLang(labels, lang) : (fallback || slug);
}
export function getGujaratCityName(lang: LanguageKey, slug: string, fallback?: string) {
  const labels = GUJ_CITY_LABELS[slug];
  return labels ? byLang(labels, lang) : (fallback || fallback === '' ? fallback : slug);
}
