export function reporterText(locale: string | undefined, en: string, hi: string, gu: string): string {
  return locale === 'hi' ? hi : locale === 'gu' ? gu : en;
}

const states = {
  DRAFT: ['Private draft · Not submitted', 'निजी मसौदा · अभी नहीं भेजा गया', 'ખાનગી ડ્રાફ્ટ · હજી મોકલ્યો નથી'],
  SUBMITTED: ['Received', 'प्राप्त', 'પ્રાપ્ત'],
  UNDER_REVIEW: ['Under review', 'समीक्षाधीन', 'સમીક્ષા હેઠળ'],
  NEEDS_REVISION: ['Revision requested', 'संशोधन का अनुरोध', 'સુધારો કરવા વિનંતી'],
  APPROVED: ['Approved', 'स्वीकृत', 'મંજૂર'],
  REJECTED: ['Rejected', 'अस्वीकृत', 'નામંજૂર'],
  WITHDRAWN: ['Withdrawn', 'वापस ली गई', 'પાછી ખેંચેલી'],
  ARCHIVED: ['Archived', 'संग्रहित', 'સંગ્રહિત'],
  DELETED: ['Removed', 'हटाई गई', 'દૂર કરેલી'],
  UNKNOWN: ['Review status unconfirmed', 'समीक्षा स्थिति अपुष्ट', 'સમીક્ષાની સ્થિતિની પુષ્ટિ નથી'],
  not_published: ['Not published', 'प्रकाशित नहीं', 'પ્રકાશિત નથી'],
  draft: ['Editorial draft', 'संपादकीय मसौदा', 'સંપાદકીય ડ્રાફ્ટ'],
  scheduled: ['Scheduled', 'प्रकाशन निर्धारित', 'પ્રકાશન નિર્ધારિત'],
  published: ['Published', 'प्रकाशित', 'પ્રકાશિત'],
  unpublished: ['Unpublished', 'प्रकाशन वापस लिया गया', 'પ્રકાશન પાછું ખેંચાયું'],
  deleted: ['Article removed', 'लेख हटाया गया', 'લેખ દૂર કરાયો'],
  unverified: ['Publication unconfirmed', 'प्रकाशन की पुष्टि नहीं हुई', 'પ્રકાશનની પુષ્ટિ નથી'],
} as const;

export function reporterStatusText(locale: string | undefined, status: keyof typeof states): string {
  const [en, hi, gu] = states[status];
  return reporterText(locale, en, hi, gu);
}
