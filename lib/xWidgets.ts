export const NEWS_PULSE_X_WIDGETS_SCRIPT_ID = 'news-pulse-x-widgets';
export const NEWS_PULSE_X_WIDGETS_SCRIPT_SRC = 'https://platform.twitter.com/widgets.js';

type TwitterWidgetsApi = {
  widgets?: {
    load?: (element?: HTMLElement | null) => unknown;
  };
};

type WindowWithTwitterWidgets = Window & typeof globalThis & {
  twttr?: TwitterWidgetsApi;
};

let widgetsScriptPromise: Promise<void> | null = null;

function getBrowserWindow(): WindowWithTwitterWidgets | null {
  return typeof window === 'undefined' ? null : (window as WindowWithTwitterWidgets);
}

function getTwitterWidgetsApi(): Required<TwitterWidgetsApi>['widgets'] | null {
  const twttr = getBrowserWindow()?.twttr;
  return twttr?.widgets?.load ? twttr.widgets : null;
}

export function hasLoadedTwitterWidgets(): boolean {
  return Boolean(getTwitterWidgetsApi());
}

export function loadTwitterWidgetsScript(): Promise<void> {
  const browserWindow = getBrowserWindow();
  if (!browserWindow || typeof document === 'undefined') {
    return Promise.reject(new Error('X widgets can only load in a browser'));
  }

  if (hasLoadedTwitterWidgets()) return Promise.resolve();
  if (widgetsScriptPromise) return widgetsScriptPromise;

  widgetsScriptPromise = new Promise<void>((resolve, reject) => {
    let timeoutId: number | undefined;
    let script = document.getElementById(NEWS_PULSE_X_WIDGETS_SCRIPT_ID) as HTMLScriptElement | null;

    const cleanup = () => {
      if (timeoutId) browserWindow.clearTimeout(timeoutId);
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };

    const fail = () => {
      cleanup();
      widgetsScriptPromise = null;
      reject(new Error('X widgets failed to load'));
    };

    function handleLoad() {
      cleanup();
      if (hasLoadedTwitterWidgets()) resolve();
      else fail();
    }

    function handleError() {
      fail();
    }

    if (!script) {
      script = document.createElement('script');
      script.id = NEWS_PULSE_X_WIDGETS_SCRIPT_ID;
      script.src = NEWS_PULSE_X_WIDGETS_SCRIPT_SRC;
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    timeoutId = browserWindow.setTimeout(() => {
      if (!hasLoadedTwitterWidgets()) fail();
    }, 7000);
  });

  return widgetsScriptPromise;
}

export async function loadTwitterWidgetsIn(container: HTMLElement | null): Promise<void> {
  if (!container) throw new Error('X embed container is unavailable');

  await loadTwitterWidgetsScript();
  const widgets = getTwitterWidgetsApi();
  if (!widgets?.load) throw new Error('X widgets API is unavailable');

  await Promise.resolve(widgets.load(container));
}

export function hasRenderedTwitterWidgetFrame(container: HTMLElement | null): boolean {
  return Boolean(container?.querySelector('iframe'));
}