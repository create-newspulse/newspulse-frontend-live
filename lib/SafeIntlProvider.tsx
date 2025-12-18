import React from 'react';
// Make provider resilient across next-intl versions and build setups
// Prefer NextIntlProvider; fallback to IntlProvider; last resort: passthrough
// This avoids runtime "element type is invalid" if the symbol is undefined.
// Do not rely on version-specific exports directly.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextIntl = require('next-intl');

const Provider =
  nextIntl?.NextIntlProvider ||
  nextIntl?.IntlProvider ||
  (({ children }: { children: React.ReactNode }) => <>{children}</>);

export default Provider;