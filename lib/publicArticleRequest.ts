// Public article identity and edition are selected by the URL, never by the reader's session.
export function anonymousArticleGet(signal?: AbortSignal) {
  return {
    method: 'GET', headers: { Accept: 'application/json' },
    credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
  } as const;
}
