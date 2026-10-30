/**
 * Run `fn` with `fetch` stubbed by a server that accepts each request and
 * never answers: a request ends only when its signal aborts. A request with
 * no signal fails at once, so a missing timeout fails the test instead of
 * hanging it.
 */
export const withNeverAnsweringFetch = async <T>(fn: () => Promise<T>): Promise<T> => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (_input: string | URL | Request, init?: RequestInit) => {
    const signal = init?.signal
    if (!signal) return Promise.reject(new Error('the request has no signal'))
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason))
    )
  }
  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}
