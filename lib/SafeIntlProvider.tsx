import React from 'react';
import * as nextIntl from 'next-intl';

type SafeIntlProviderProps = React.PropsWithChildren<{
  messages?: unknown;
  locale?: string;
  onError?: (error: unknown) => void;
  [key: string]: unknown;
}>;

const nextIntlExports = nextIntl as typeof nextIntl & {
  NextIntlProvider?: React.ComponentType<SafeIntlProviderProps>;
  IntlProvider?: React.ComponentType<SafeIntlProviderProps>;
};

// Make provider resilient across next-intl versions and build setups
// Prefer NextIntlProvider; fallback to IntlProvider; last resort: passthrough
// This avoids runtime "element type is invalid" if the symbol is undefined.
// Do not rely on version-specific exports directly.

const Provider: React.ComponentType<SafeIntlProviderProps> =
  nextIntlExports.NextIntlProvider ||
  nextIntlExports.IntlProvider ||
  (({ children }: { children: React.ReactNode }) => <>{children}</>);

export default Provider;