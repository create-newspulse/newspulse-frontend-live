import { useEffect, useState, useRef, useCallback } from 'react';

const fetchHeadlines = async (category = '', language = 'english', opts = {}) => {
  try {
    const url = `/api/headlines?${category ? `category=${category}&` : ''}language=${language}`;
    const response = await fetch(url, { signal: opts.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch headlines: ${response.statusText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format: Expected an array of headlines');
    }
    return data;
  } catch (error) {
    if (error && (error.name === 'AbortError' || String(error.message || '').toLowerCase().includes('aborted'))) {
      return [];
    }
    console.error('Failed to fetch headlines:', error.message);
    return [];
  }
};

export default function BreakingTicker({
  speed = 24, // seconds for one full scroll (clamped)
  className = '',
  pollingInterval = 300000, // 5 minutes
  category = '',
  language = 'english',
}) {
  const clampSeconds = (raw, fallback) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(40, Math.max(10, n));
  };

  const durationSec = clampSeconds(speed, 24);
  const [headlines, setHeadlines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollingRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const inFlightRef = useRef(null);
  const mountedRef = useRef(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const loadHeadlines = useCallback(async (opts = {}) => {
    // Only show loading indicator on first load.
    if (opts.foreground) setIsLoading(true);

    if (inFlightRef.current) {
      try { inFlightRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    const data = await fetchHeadlines(category, language, { signal: controller.signal });
    if (!mountedRef.current || controller.signal.aborted) return;

    if (data.length === 0 && retryCount.current < maxRetries) {
      retryCount.current += 1;
      console.warn(`Retry attempt ${retryCount.current}/${maxRetries} for fetching headlines`);

      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        loadHeadlines({ foreground: false });
      }, 5000 * retryCount.current);
      return;
    }

    const validHeadlines = data.filter(
      (headline) => headline && typeof headline.text === 'string' && headline.text.trim() !== ''
    );

    // Use default preview message if no valid headlines are available
    setHeadlines(
      validHeadlines.length > 0
        ? validHeadlines
        : [
            {
              id: 'preview-default-1',
              text: 'News Pulse – Preview Edition is live. Thank you for testing with us.',
              source: null,
            },
          ]
    );
    setIsLoading(false);
    setLastUpdated(new Date().toLocaleTimeString());
    retryCount.current = 0;

    // Clear error when using default or valid headlines
    setError(null);
  }, [category, language]);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch
    loadHeadlines({ foreground: true });

    // Polling
    pollingRef.current = setInterval(() => {
      loadHeadlines({ foreground: false });
    }, pollingInterval);

    return () => {
      mountedRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (inFlightRef.current) {
        try { inFlightRef.current.abort(); } catch {}
      }
    };
  }, [loadHeadlines, pollingInterval]);

  const fontClass = language === 'hindi' ? 'font-hindi' : language === 'gujarati' ? 'font-gujarati' : 'font-english';

  if (isLoading && headlines.length === 0) {
    return (
      <div className={`bg-royal-blue text-white px-4 py-2 ${fontClass} ${className}`}>
        {language === 'gujarati' ? 'લોડ કરી રહ્યું છે...' : language === 'hindi' ? 'लोड हो रहा है...' : 'Loading headlines...'}
      </div>
    );
  }

  if (error && headlines.length === 0) {
    return (
      <div className={`bg-royal-blue text-red-500 px-4 py-2 ${fontClass} ${className}`}>
        {error}
      </div>
    );
  }

  // Build marquee text with separators
  const marqueeText = (headlines && headlines.length
    ? headlines.map(h => h?.text).filter(Boolean)
    : []).join('  •  ');

  return (
    <div className={`bg-royal-blue text-white py-2 ${fontClass} ${className}`}>
      <div className="flex items-center gap-3 px-3">
        <span
          className="tickerLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold text-white border"
          style={{ borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.10)' }}
        >
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true"></span>
          {language === 'gujarati' ? 'લાઇવ' : language === 'hindi' ? 'लाइव' : 'Live'}
          {lastUpdated ? (
            <span className="opacity-90">
              {' '}
              • {language === 'gujarati' ? 'અપડેટ' : language === 'hindi' ? 'अपडेट' : 'Updated'} {lastUpdated}
            </span>
          ) : null}
        </span>

        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ WebkitMaskImage: 'linear-gradient(to right, black 0%, black 90%, transparent)', maskImage: 'linear-gradient(to right, black 0%, black 90%, transparent)' }}
        >
          <div className="whitespace-nowrap tickerText animate-marquee" style={{ animationDuration: `${durationSec}s` }}>
            <span className="pr-10">{marqueeText}</span>
            <span className="pr-10">{marqueeText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
