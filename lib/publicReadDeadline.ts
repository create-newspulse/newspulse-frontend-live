export class PublicReadTimeoutError extends Error {
  constructor() {
    super('Public read timed out');
    this.name = 'PublicReadTimeoutError';
  }
}

export async function withPublicReadDeadline<Result>(
  timeoutMs: number,
  read: (signal: AbortSignal) => Promise<Result>,
  parentSignal?: AbortSignal,
): Promise<Result> {
  const controller = new AbortController();
  let timer!: ReturnType<typeof setTimeout>;
  let cancel!: () => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      reject(new Error('Public read cancelled'));
      controller.abort();
    };
    timer = setTimeout(() => {
      reject(new PublicReadTimeoutError());
      controller.abort();
    }, timeoutMs);
    parentSignal?.addEventListener('abort', cancel, { once: true });
    if (parentSignal?.aborted) cancel();
  });
  try {
    return await Promise.race([read(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', cancel);
  }
}