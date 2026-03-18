export const PUBLIC_DATA_REFRESH_EVENT = 'newspulse:public-data-refresh';

export type PublicDataRefreshDetail = {
  version: string;
  previousVersion: string | null;
  source: string;
  at: number;
};

export function dispatchPublicDataRefresh(detail: Omit<PublicDataRefreshDetail, 'at'>): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<PublicDataRefreshDetail>(PUBLIC_DATA_REFRESH_EVENT, {
      detail: {
        ...detail,
        at: Date.now(),
      },
    })
  );
}

export function subscribePublicDataRefresh(listener: (detail: PublicDataRefreshDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<PublicDataRefreshDetail>).detail;
    if (!detail?.version) return;
    listener(detail);
  };

  window.addEventListener(PUBLIC_DATA_REFRESH_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(PUBLIC_DATA_REFRESH_EVENT, handler as EventListener);
  };
}