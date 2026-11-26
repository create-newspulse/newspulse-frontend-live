import { reporterText } from './reporterCopy';

export async function reporterAuthRequest(path: string, method: string, body?: Record<string, string>, accountId?: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const deadline = setTimeout(abort, 12_000);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`/api/reporter-auth/${path}`, {
      method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accountId ? { 'X-Reporter-Account': accountId } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);
    return { ok: response.status === 200 && data?.ok === true, status: response.status, data };
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
  }
}

const copy = {
  login: ['Reporter sign-in', 'रिपोर्टर साइन इन', 'રિપોર્ટર સાઇન ઇન'],
  instructions: ['Sign in with the one-time code sent to your email.', 'अपने ईमेल पर भेजे गए एक बार के कोड से साइन इन करें।', 'તમારા ઈમેલ પર મોકલેલા એક વખતના કોડથી સાઇન ઇન કરો.'],
  email: ['Reporter email', 'रिपोर्टर ईमेल', 'રિપોર્ટર ઈમેલ'],
  send: ['Send verification code', 'सत्यापन कोड भेजें', 'ચકાસણી કોડ મોકલો'],
  code: ['Verification code', 'सत्यापन कोड', 'ચકાસણી કોડ'],
  checkMail: ['Check your inbox for a six-digit code.', 'छह अंकों के कोड के लिए अपना इनबॉक्स देखें।', 'છ અંકના કોડ માટે તમારું ઇનબૉક્સ જુઓ.'],
  verify: ['Verify code', 'कोड सत्यापित करें', 'કોડ ચકાસો'],
  resend: ['Request a new code', 'नया कोड माँगें', 'નવો કોડ માગો'],
  another: ['Use another email', 'दूसरा ईमेल इस्तेमाल करें', 'બીજો ઈમેલ વાપરો'],
  deniedCode: ['Code not verified. Check the code or request a new one.', 'कोड सत्यापित नहीं हुआ। कोड जाँचें या नया कोड माँगें।', 'કોડ ચકાસાયો નથી. કોડ તપાસો અથવા નવો કોડ માગો.'],
  unavailable: ['The reporter service is unavailable. Please try again later.', 'रिपोर्टर सेवा उपलब्ध नहीं है। कृपया बाद में फिर कोशिश करें।', 'રિપોર્ટર સેવા ઉપલબ્ધ નથી. કૃપા કરીને પછીથી ફરી પ્રયાસ કરો.'],
  rate: ['Too many attempts. Wait before trying again.', 'बहुत अधिक प्रयास हुए। फिर प्रयास करने से पहले प्रतीक्षा करें।', 'ઘણા પ્રયાસ થયા છે. ફરી પ્રયાસ કરતા પહેલાં થોભો.'],
  unconfirmed: ['Sign-in was not confirmed. Request a new code.', 'साइन इन की पुष्टि नहीं हुई। नया कोड माँगें।', 'સાઇન ઇનની પુષ્ટિ થઈ નથી. નવો કોડ માગો.'],
  expired: ['Your session expired. Sign in again.', 'आपका सत्र समाप्त हो गया। फिर से साइन इन करें।', 'તમારું સત્ર સમાપ્ત થયું છે. ફરી સાઇન ઇન કરો.'],
  logoutPending: ['Sign-out was not confirmed by the server. Private information stays hidden until you retry.', 'सर्वर ने साइन आउट की पुष्टि नहीं की। फिर प्रयास करने तक निजी जानकारी छिपी रहेगी।', 'સર્વરે સાઇન આઉટની પુષ્ટિ કરી નથી. તમે ફરી પ્રયાસ કરો ત્યાં સુધી ખાનગી માહિતી છુપાયેલી રહેશે.'],
  retryLogout: ['Retry sign-out', 'साइन आउट का फिर प्रयास करें', 'સાઇન આઉટનો ફરી પ્રયાસ કરો'],
  signedOut: ['Sign-out confirmed.', 'साइन आउट की पुष्टि हुई।', 'સાઇન આઉટની પુષ્ટિ થઈ.'],
  closed: ['Reporter Portal is closed', 'रिपोर्टर पोर्टल बंद है', 'રિપોર્ટર પોર્ટલ બંધ છે'],
  back: ['Back to Community Reporter', 'कम्युनिटी रिपोर्टर पर लौटें', 'કમ્યુનિટી રિપોર્ટર પર પાછા ફરો'],
  wait: ['Please wait…', 'कृपया प्रतीक्षा करें…', 'કૃપા કરીને થોભો…'],
  profile: ['Reporter profile', 'रिपोर्टर प्रोफ़ाइल', 'રિપોર્ટર પ્રોફાઇલ'],
  manage: ['Manage your contact details and verified login email.', 'अपने संपर्क विवरण और सत्यापित लॉगिन ईमेल को प्रबंधित करें।', 'તમારી સંપર્ક વિગતો અને ચકાસેલો લૉગિન ઈમેલ સંભાળો.'],
  verifiedJournalist: ['News Pulse has verified this journalist profile.', 'न्यूज़ पल्स ने इस पत्रकार प्रोफ़ाइल का सत्यापन किया है।', 'ન્યૂઝ પલ્સે આ પત્રકારની પ્રોફાઇલ ચકાસી છે.'],
  noProfessionalVerification: ['Professional verification is not confirmed for this profile.', 'इस प्रोफ़ाइल के पेशेवर सत्यापन की पुष्टि नहीं हुई है।', 'આ પ્રોફાઇલની વ્યાવસાયિક ચકાસણીની પુષ્ટિ થઈ નથી.'],
  fullName: ['Full name', 'पूरा नाम', 'પૂરું નામ'],
  phone: ['Phone', 'फ़ोन', 'ફોન'],
  country: ['Country', 'देश', 'દેશ'],
  stateName: ['State', 'राज्य', 'રાજ્ય'],
  districtName: ['District', 'ज़िला', 'જિલ્લો'],
  cityTownVillage: ['City, town or village', 'शहर, कस्बा या गाँव', 'શહેર, નગર કે ગામ'],
  save: ['Save profile', 'प्रोफ़ाइल सहेजें', 'પ્રોફાઇલ સાચવો'],
  saved: ['Profile saved.', 'प्रोफ़ाइल सहेजी गई।', 'પ્રોફાઇલ સાચવી છે.'],
  retry: ['Try again', 'फिर प्रयास करें', 'ફરી પ્રયાસ કરો'],
  changeEmail: ['Change login email', 'लॉगिन ईमेल बदलें', 'લૉગિન ઈમેલ બદલો'],
  newEmail: ['New email', 'नया ईमेल', 'નવો ઈમેલ'],
  changeHelp: ['Verify the new address with a code. After the change, sign in again with the new email.', 'कोड से नया पता सत्यापित करें। बदलाव के बाद नए ईमेल से फिर साइन इन करें।', 'કોડ વડે નવું સરનામું ચકાસો. ફેરફાર પછી નવા ઈમેલથી ફરી સાઇન ઇન કરો.'],
  confirmEmail: ['Confirm email change', 'ईमेल बदलाव की पुष्टि करें', 'ઈમેલ ફેરફારની પુષ્ટિ કરો'],
  invalidEmail: ['Enter a different, valid email address.', 'एक अलग, मान्य ईमेल पता दर्ज करें।', 'અલગ, માન્ય ઈમેલ સરનામું દાખલ કરો.'],
  emailConflict: ['This email cannot be used for the change.', 'इस ईमेल का उपयोग बदलाव के लिए नहीं किया जा सकता।', 'આ ઈમેલનો ઉપયોગ ફેરફાર માટે થઈ શકતો નથી.'],
  emailChanged: ['Email changed. Sign in with your new email.', 'ईमेल बदल गया। नए ईमेल से साइन इन करें।', 'ઈમેલ બદલાયો છે. નવા ઈમેલથી સાઇન ઇન કરો.'],
} as const;

export type AuthCopyKey = keyof typeof copy;
export function authText(locale: string | undefined, key: AuthCopyKey) {
  const [en, hi, gu] = copy[key];
  return reporterText(locale, en, hi, gu);
}

export function authFailure(status: number, code?: string): AuthCopyKey {
  if (status === 429) return 'rate';
  if (code === 'LOGOUT_UNCONFIRMED') return 'logoutPending';
  if (code === 'EMAIL_ALREADY_IN_USE') return 'emailConflict';
  if (code === 'INVALID_NEW_EMAIL' || code === 'EMAIL_UNCHANGED' || code === 'EMAIL_REQUIRED') return 'invalidEmail';
  if (status === 400 || status === 401) return 'deniedCode';
  return 'unavailable';
}
