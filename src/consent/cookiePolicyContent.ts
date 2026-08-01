import type { Lang } from '../i18n/LanguageProvider';
import { COOKIE_CONSENT_VERSION, cookieTechnologyInventory, type CookieConsentCategory } from './cookieConsent';

export const COOKIE_POLICY_EFFECTIVE_DATE = '1 August 2026';
export const COOKIE_POLICY_LAST_UPDATED = '1 August 2026';
export const COOKIE_POLICY_CONTACT_EMAIL = 'privacy@newspulse.co.in';

export type CookiePolicySection = {
  title: string;
  body: string[];
};

export type CookiePolicyCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  intro: string;
  effectiveDateLabel: string;
  lastUpdatedLabel: string;
  versionLabel: string;
  privacyPolicyLink: string;
  privacyRequestLink: string;
  controlCardKicker: string;
  controlCardTitle: string;
  controlCardText: string;
  openSettings: string;
  cards: Array<{ title: string; body: string; category: CookieConsentCategory }>;
  sections: CookiePolicySection[];
  inventoryTitle: string;
  inventoryIntro: string;
  table: {
    name: string;
    provider: string;
    category: string;
    purpose: string;
    duration: string;
    currentStatus: string;
  };
  categoryLabels: Record<CookieConsentCategory, string>;
  statusLabels: Record<string, string>;
};

const en: CookiePolicyCopy = {
  metaTitle: 'Cookie Policy',
  metaDescription: 'The News Pulse Cookie Policy explains required and optional technologies, consent controls, embedded media and the current cookie and storage inventory.',
  eyebrow: 'Cookie and consent information',
  title: 'Cookie Policy',
  intro: 'News Pulse uses essential technologies to keep the website secure and reliable. Optional preference, analytics, advertising and embedded-media technologies are used only according to your choices.',
  effectiveDateLabel: 'Effective date',
  lastUpdatedLabel: 'Last updated',
  versionLabel: 'Policy version',
  privacyPolicyLink: 'Privacy Policy',
  privacyRequestLink: 'Privacy Request',
  controlCardKicker: 'User choice',
  controlCardTitle: 'You control optional technologies',
  controlCardText: 'Essential technologies remain active because they are required for security and core website functions. Preference, analytics, advertising and embedded-media technologies are used according to your selections. You can review or change your decision at any time through Cookie Settings in the News Pulse footer.',
  openSettings: 'Open Cookie Settings',
  cards: [
    { title: 'Strictly Necessary', body: 'Security, consent storage, session continuity and website reliability.', category: 'necessary' },
    { title: 'Preferences', body: 'Optional language, saved display preferences and local reader choices.', category: 'preferences' },
    { title: 'Analytics', body: 'Aggregate traffic, article performance and technical measurement after consent.', category: 'analytics' },
    { title: 'Advertising and Media', body: 'Advertising delivery where enabled, plus YouTube, Live TV and social embeds after consent.', category: 'advertising' },
  ],
  sections: [
    { title: '1. About this policy', body: ['This policy explains how News Pulse uses cookies, browser storage, scripts, network requests and embedded media on the public frontend.', `For privacy questions, contact ${COOKIE_POLICY_CONTACT_EMAIL}. You can also use the Privacy Policy and Privacy Request links on this page.`] },
    { title: '2. Cookies and similar technologies', body: ['Cookies are small browser records. Similar technologies include localStorage, sessionStorage, third-party scripts, network requests and embedded iframes.', 'News Pulse separates required technologies from optional categories so your choice can be applied consistently.'] },
    { title: '3. Strictly necessary technologies', body: ['Strictly necessary technologies support security, consent storage, session continuity, public form reliability, reporter-account flows and core website operation.', 'These technologies remain active because the website cannot function reliably without them.'] },
    { title: '4. Preference technologies', body: ['Preference technologies may remember language, display choices, bookmarks or similar local settings after you allow preference storage.', 'If preference technologies are rejected, essential navigation and language routes continue to work, but optional choices may not be remembered.'] },
    { title: '5. Analytics technologies', body: ['Analytics technologies help News Pulse understand aggregate traffic, article performance, reading engagement and technical performance after analytics consent.', 'Analytics is not initialized before consent. If analytics consent is withdrawn, future analytics collection stops and first-party analytics identifiers are cleared.'] },
    { title: '6. Advertising technologies', body: ['Advertising technologies may support ad delivery and measurement where advertising features are enabled.', 'News Pulse does not load advertising scripts or fetch optional public ad placements before advertising consent. AdSense is not added by this policy unless it is already configured.'] },
    { title: '7. Embedded media', body: ['Embedded media includes YouTube, YouTube Live, DroneTV and supported social embeds.', 'Before embedded-media consent, News Pulse shows a privacy placeholder instead of loading the third-party iframe or script. YouTube links are converted to youtube-nocookie.com where supported.'] },
    { title: '8. Current cookie and storage inventory', body: ['The inventory table below is generated from the frontend audit and the central typed consent configuration.', 'It includes active and conditionally active technologies, plus inactive services that were checked during the audit.'] },
    { title: '9. Third-party services', body: ['Third-party services may process data under their own terms once you allow the relevant optional category and the service loads.', 'Current third-party surfaces are Google Analytics where configured, Google Funding Choices where configured, YouTube/youtube-nocookie embeds and X/Twitter embeds.'] },
    { title: '10. What happens when optional technologies are rejected', body: ['Rejecting optional technologies does not block access to News Pulse content.', 'Preference storage, analytics events, advertising requests and embedded third-party media are disabled unless you later allow the relevant category.'] },
    { title: '11. How to change or withdraw consent', body: ['Use Cookie Settings in the News Pulse footer or the button on this page to review, change or withdraw your decision.', 'When optional consent is withdrawn, News Pulse stops future optional use and clears related first-party optional storage where it controls that storage.'] },
    { title: '12. Browser controls', body: ['You can also block or delete cookies and site data through your browser settings.', 'Browser controls may remove the News Pulse consent cookie, in which case the banner will appear again so you can make a fresh choice.'] },
    { title: '13. Children’s privacy', body: ['News Pulse does not knowingly use optional technologies to profile children.', 'If you believe a child has submitted personal information, contact the privacy address listed in this policy.'] },
    { title: '14. Policy updates', body: ['News Pulse may update this policy when technologies, legal requirements or website features change.', 'If the policy version changes, saved consent for older versions is treated as invalid and the consent banner is shown again.'] },
    { title: '15. Contact', body: [`Privacy / DPDP email: ${COOKIE_POLICY_CONTACT_EMAIL}`, 'Related pages: /privacy-policy and /privacy-request.'] },
  ],
  inventoryTitle: 'Current cookie and storage inventory',
  inventoryIntro: 'This table lists only actual technologies found in the frontend audit or inactive systems explicitly checked during the audit.',
  table: { name: 'Name', provider: 'Provider', category: 'Category', purpose: 'Purpose', duration: 'Duration', currentStatus: 'Current status' },
  categoryLabels: { necessary: 'Strictly necessary', preferences: 'Preferences', analytics: 'Analytics', advertising: 'Advertising', embeddedMedia: 'Embedded media' },
  statusLabels: { Active: 'Active', 'Conditionally active': 'Conditionally active', 'Not currently active': 'Not currently active' },
};

const hi: CookiePolicyCopy = {
  ...en,
  metaDescription: 'News Pulse कुकी नीति आवश्यक और वैकल्पिक तकनीकों, सहमति नियंत्रणों, embedded media और वर्तमान cookie/storage inventory को समझाती है।',
  eyebrow: 'कुकी और सहमति जानकारी',
  title: 'कुकी नीति',
  intro: 'News Pulse वेबसाइट को सुरक्षित और भरोसेमंद रखने के लिए आवश्यक तकनीकों का उपयोग करता है। वैकल्पिक preference, analytics, advertising और embedded-media तकनीकें आपकी पसंद के अनुसार ही उपयोग होती हैं।',
  effectiveDateLabel: 'प्रभावी तारीख',
  lastUpdatedLabel: 'अंतिम अपडेट',
  versionLabel: 'नीति संस्करण',
  privacyPolicyLink: 'गोपनीयता नीति',
  privacyRequestLink: 'गोपनीयता अनुरोध',
  controlCardKicker: 'उपयोगकर्ता की पसंद',
  controlCardTitle: 'वैकल्पिक तकनीकों पर आपका नियंत्रण है',
  controlCardText: 'Essential technologies सक्रिय रहती हैं क्योंकि वे security और core website functions के लिए जरूरी हैं। Preference, analytics, advertising और embedded-media technologies आपकी selections के अनुसार उपयोग होती हैं। आप News Pulse footer में Cookie Settings से कभी भी अपना निर्णय देख या बदल सकते हैं।',
  openSettings: 'कुकी सेटिंग्स खोलें',
  cards: [
    { title: 'सख्ती से आवश्यक', body: 'Security, consent storage, session continuity और website reliability.', category: 'necessary' },
    { title: 'पसंद', body: 'वैकल्पिक language, saved display preferences और स्थानीय reader choices.', category: 'preferences' },
    { title: 'एनालिटिक्स', body: 'Consent के बाद aggregate traffic, article performance और technical measurement.', category: 'analytics' },
    { title: 'विज्ञापन और मीडिया', body: 'जहाँ enabled हो वहाँ advertising delivery, साथ में consent के बाद YouTube, Live TV और social embeds.', category: 'advertising' },
  ],
  sections: [
    { title: '1. इस नीति के बारे में', body: ['यह नीति बताती है कि News Pulse public frontend पर cookies, browser storage, scripts, network requests और embedded media का उपयोग कैसे करता है।', `गोपनीयता प्रश्नों के लिए ${COOKIE_POLICY_CONTACT_EMAIL} पर संपर्क करें।`] },
    { title: '2. Cookies और समान तकनीकें', body: ['Cookies छोटे browser records होते हैं। समान तकनीकों में localStorage, sessionStorage, third-party scripts, network requests और embedded iframes शामिल हैं।', 'News Pulse required technologies को optional categories से अलग रखता है ताकि आपकी choice लगातार लागू हो सके।'] },
    { title: '3. सख्ती से आवश्यक तकनीकें', body: ['ये security, consent storage, session continuity, public form reliability, reporter-account flows और core website operation में मदद करती हैं।', 'वेबसाइट को भरोसेमंद तरीके से चलाने के लिए ये सक्रिय रहती हैं।'] },
    { title: '4. Preference technologies', body: ['Preference technologies आपकी अनुमति के बाद language, display choices, bookmarks या समान local settings याद रख सकती हैं।', 'इनकार करने पर navigation और language routes काम करते रहेंगे, लेकिन optional choices याद नहीं रह सकतीं।'] },
    { title: '5. Analytics technologies', body: ['Analytics consent के बाद aggregate traffic, article performance, reading engagement और technical performance समझने में मदद मिलती है।', 'Consent से पहले analytics initialize नहीं होता। Withdrawal के बाद future collection बंद होती है और first-party analytics identifiers साफ किए जाते हैं।'] },
    { title: '6. Advertising technologies', body: ['Advertising features enabled होने पर ad delivery और measurement के लिए advertising technologies उपयोग हो सकती हैं।', 'Advertising consent से पहले News Pulse advertising scripts या optional public ad placements fetch नहीं करता।'] },
    { title: '7. Embedded media', body: ['Embedded media में YouTube, YouTube Live, DroneTV और supported social embeds शामिल हैं।', 'Consent से पहले third-party iframe/script की जगह privacy placeholder दिखता है। जहाँ supported हो, YouTube links youtube-nocookie.com में बदले जाते हैं।'] },
    { title: '8. वर्तमान cookie और storage inventory', body: ['नीचे की inventory frontend audit और central typed consent configuration से आती है।', 'इसमें active, conditionally active और audit में check की गई inactive services शामिल हैं।'] },
    { title: '9. Third-party services', body: ['Relevant optional category allow करने और service load होने के बाद third-party services अपनी terms के तहत data process कर सकती हैं।', 'Current third-party surfaces configured Google Analytics, configured Google Funding Choices, YouTube/youtube-nocookie embeds और X/Twitter embeds हैं।'] },
    { title: '10. Optional technologies reject करने पर क्या होता है', body: ['Optional technologies reject करने से News Pulse content access block नहीं होता।', 'Preference storage, analytics events, advertising requests और embedded third-party media disabled रहते हैं जब तक आप relevant category allow न करें।'] },
    { title: '11. Consent बदलना या वापस लेना', body: ['News Pulse footer में Cookie Settings या इस page के button से आप decision review, change या withdraw कर सकते हैं।', 'Withdrawal पर News Pulse future optional use रोकता है और अपने control वाली related first-party optional storage साफ करता है।'] },
    { title: '12. Browser controls', body: ['आप browser settings से cookies और site data block या delete कर सकते हैं।', 'Browser controls consent cookie हटा दें तो banner फिर दिखेगा ताकि आप नई choice दे सकें।'] },
    { title: '13. बच्चों की privacy', body: ['News Pulse बच्चों की profiling के लिए optional technologies knowingly उपयोग नहीं करता।', 'यदि आपको लगे कि किसी बच्चे ने personal information submit की है, तो policy में दिए privacy address पर संपर्क करें।'] },
    { title: '14. Policy updates', body: ['Technologies, legal requirements या website features बदलने पर News Pulse इस policy को update कर सकता है।', 'Policy version बदलने पर पुराने saved consent को invalid माना जाता है और banner फिर दिखता है।'] },
    { title: '15. संपर्क', body: [`Privacy / DPDP email: ${COOKIE_POLICY_CONTACT_EMAIL}`, 'Related pages: /privacy-policy और /privacy-request.'] },
  ],
  inventoryTitle: 'वर्तमान cookie और storage inventory',
  inventoryIntro: 'यह table केवल frontend audit में मिली actual technologies या audit में explicitly checked inactive systems को दिखाती है।',
  table: { name: 'नाम', provider: 'Provider', category: 'श्रेणी', purpose: 'Purpose', duration: 'Duration', currentStatus: 'Current status' },
  categoryLabels: { necessary: 'सख्ती से आवश्यक', preferences: 'पसंद', analytics: 'एनालिटिक्स', advertising: 'विज्ञापन', embeddedMedia: 'एम्बेडेड मीडिया' },
  statusLabels: { Active: 'Active', 'Conditionally active': 'Conditionally active', 'Not currently active': 'Not currently active' },
};

const gu: CookiePolicyCopy = {
  ...en,
  metaDescription: 'News Pulse કુકી નીતિ જરૂરી અને વૈકલ્પિક તકનીકો, consent controls, embedded media અને current cookie/storage inventory સમજાવે છે.',
  eyebrow: 'કુકી અને સંમતિ માહિતી',
  title: 'કુકી નીતિ',
  intro: 'News Pulse વેબસાઇટને સુરક્ષિત અને વિશ્વસનીય રાખવા જરૂરી તકનીકોનો ઉપયોગ કરે છે. વૈકલ્પિક preference, analytics, advertising અને embedded-media તકનીકો તમારી પસંદ મુજબ જ ઉપયોગ થાય છે.',
  effectiveDateLabel: 'પ્રભાવ તારીખ',
  lastUpdatedLabel: 'છેલ્લું અપડેટ',
  versionLabel: 'નીતિ વર્ઝન',
  privacyPolicyLink: 'ગોપનીયતા નીતિ',
  privacyRequestLink: 'ગોપનીયતા વિનંતી',
  controlCardKicker: 'વપરાશકર્તાની પસંદ',
  controlCardTitle: 'વૈકલ્પિક તકનીકો પર તમારું નિયંત્રણ છે',
  controlCardText: 'Essential technologies સક્રિય રહે છે કારણ કે security અને core website functions માટે તે જરૂરી છે. Preference, analytics, advertising અને embedded-media technologies તમારી selections મુજબ ઉપયોગ થાય છે. તમે News Pulse footer માં Cookie Settings દ્વારા ક્યારેય પણ નિર્ણય જોઈ અથવા બદલી શકો છો.',
  openSettings: 'કુકી સેટિંગ્સ ખોલો',
  cards: [
    { title: 'સખત જરૂરી', body: 'Security, consent storage, session continuity અને website reliability.', category: 'necessary' },
    { title: 'પસંદગીઓ', body: 'વૈકલ્પિક language, saved display preferences અને local reader choices.', category: 'preferences' },
    { title: 'એનાલિટિક્સ', body: 'Consent પછી aggregate traffic, article performance અને technical measurement.', category: 'analytics' },
    { title: 'જાહેરાત અને મીડિયા', body: 'જ્યાં enabled હોય ત્યાં advertising delivery, સાથે consent પછી YouTube, Live TV અને social embeds.', category: 'advertising' },
  ],
  sections: [
    { title: '1. આ નીતિ વિશે', body: ['આ નીતિ News Pulse public frontend પર cookies, browser storage, scripts, network requests અને embedded media નો ઉપયોગ કેવી રીતે કરે છે તે સમજાવે છે.', `ગોપનીયતા પ્રશ્નો માટે ${COOKIE_POLICY_CONTACT_EMAIL} પર સંપર્ક કરો.`] },
    { title: '2. Cookies અને સમાન તકનીકો', body: ['Cookies નાના browser records છે. સમાન તકનીકોમાં localStorage, sessionStorage, third-party scripts, network requests અને embedded iframes આવે છે.', 'News Pulse required technologies ને optional categories થી અલગ રાખે છે જેથી તમારી choice સતત લાગુ થઈ શકે.'] },
    { title: '3. સખત જરૂરી તકનીકો', body: ['આ security, consent storage, session continuity, public form reliability, reporter-account flows અને core website operation ને support કરે છે.', 'વેબસાઇટ વિશ્વસનીય રીતે ચાલે તે માટે આ સક્રિય રહે છે.'] },
    { title: '4. Preference technologies', body: ['Preference technologies તમારી મંજૂરી પછી language, display choices, bookmarks અથવા સમાન local settings યાદ રાખી શકે છે.', 'Reject કરવાથી navigation અને language routes કામ કરતા રહે છે, પરંતુ optional choices યાદ રહી શકતી નથી.'] },
    { title: '5. Analytics technologies', body: ['Analytics consent પછી aggregate traffic, article performance, reading engagement અને technical performance સમજવામાં મદદ મળે છે.', 'Consent પહેલાં analytics initialize થતું નથી. Withdrawal પછી future collection બંધ થાય છે અને first-party analytics identifiers સાફ થાય છે.'] },
    { title: '6. Advertising technologies', body: ['Advertising features enabled હોય ત્યારે ad delivery અને measurement માટે advertising technologies ઉપયોગ થઈ શકે છે.', 'Advertising consent પહેલાં News Pulse advertising scripts અથવા optional public ad placements fetch કરતું નથી.'] },
    { title: '7. Embedded media', body: ['Embedded media માં YouTube, YouTube Live, DroneTV અને supported social embeds સામેલ છે.', 'Consent પહેલાં third-party iframe/script ના બદલે privacy placeholder દેખાય છે. જ્યાં supported હોય ત્યાં YouTube links youtube-nocookie.com માં ફેરવાય છે.'] },
    { title: '8. Current cookie and storage inventory', body: ['નીચેની inventory frontend audit અને central typed consent configuration માંથી આવે છે.', 'તેમાં active, conditionally active અને audit માં check કરેલી inactive services સામેલ છે.'] },
    { title: '9. Third-party services', body: ['Relevant optional category allow કર્યા પછી અને service load થયા પછી third-party services પોતાની terms હેઠળ data process કરી શકે છે.', 'Current third-party surfaces configured Google Analytics, configured Google Funding Choices, YouTube/youtube-nocookie embeds અને X/Twitter embeds છે.'] },
    { title: '10. Optional technologies reject થાય ત્યારે શું થાય', body: ['Optional technologies reject કરવાથી News Pulse content access block થતું નથી.', 'Preference storage, analytics events, advertising requests અને embedded third-party media disabled રહે છે જ્યાં સુધી તમે relevant category allow ન કરો.'] },
    { title: '11. Consent બદલવું અથવા પાછું ખેંચવું', body: ['News Pulse footer માં Cookie Settings અથવા આ page ના button દ્વારા decision review, change અથવા withdraw કરી શકો છો.', 'Withdrawal પર News Pulse future optional use રોકે છે અને પોતાના control હેઠળની related first-party optional storage સાફ કરે છે.'] },
    { title: '12. Browser controls', body: ['તમે browser settings થી cookies અને site data block અથવા delete કરી શકો છો.', 'Browser controls consent cookie દૂર કરે તો banner ફરી દેખાશે જેથી તમે નવી choice આપી શકો.'] },
    { title: '13. બાળકોની privacy', body: ['News Pulse બાળકોની profiling માટે optional technologies knowingly ઉપયોગ કરતું નથી.', 'જો તમને લાગે કે બાળકની personal information submit થઈ છે, તો આ policy માં આપેલા privacy address પર સંપર્ક કરો.'] },
    { title: '14. Policy updates', body: ['Technologies, legal requirements અથવા website features બદલાય ત્યારે News Pulse આ policy update કરી શકે છે.', 'Policy version બદલાય તો જૂનો saved consent invalid માનવામાં આવે છે અને banner ફરી દેખાય છે.'] },
    { title: '15. સંપર્ક', body: [`Privacy / DPDP email: ${COOKIE_POLICY_CONTACT_EMAIL}`, 'Related pages: /privacy-policy અને /privacy-request.'] },
  ],
  inventoryTitle: 'Current cookie and storage inventory',
  inventoryIntro: 'આ table માત્ર frontend audit માં મળેલી actual technologies અથવા audit માં explicitly checked inactive systems બતાવે છે.',
  table: { name: 'નામ', provider: 'Provider', category: 'શ્રેણી', purpose: 'Purpose', duration: 'Duration', currentStatus: 'Current status' },
  categoryLabels: { necessary: 'સખત જરૂરી', preferences: 'પસંદગીઓ', analytics: 'એનાલિટિક્સ', advertising: 'જાહેરાત', embeddedMedia: 'એમ્બેડેડ મીડિયા' },
  statusLabels: { Active: 'Active', 'Conditionally active': 'Conditionally active', 'Not currently active': 'Not currently active' },
};

export function getCookiePolicyCopy(lang: Lang): CookiePolicyCopy {
  if (lang === 'hi') return hi;
  if (lang === 'gu') return gu;
  return en;
}

export function getCookiePolicyInventory() {
  return cookieTechnologyInventory;
}

export { COOKIE_CONSENT_VERSION };