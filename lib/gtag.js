import { hasStoredConsentForCategory } from '../src/consent/cookieConsent';

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

export const pageview = (url) => {
  if (!GA_TRACKING_ID || !hasStoredConsentForCategory('analytics')) return;
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};

export const event = ({ action, category, label, value }) => {
  if (!GA_TRACKING_ID || !hasStoredConsentForCategory('analytics')) return;
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};
