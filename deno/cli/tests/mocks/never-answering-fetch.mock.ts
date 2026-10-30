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
    if (signal.aborted) return Promise.reject(signal.reason)
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

/**
 * Run `fn` with `fetch` stubbed by a server that answers `status` at once,
 * sends `{` and then stalls the body: the body errors only when the
 * request's signal aborts.
 */
export const withStallingBodyFetch = async <T>(
  status: number,
  fn: () => Promise<T>
): Promise<T> => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (_input: string | URL | Request, init?: RequestInit) => {
    const signal = init?.signal
    if (!signal) return Promise.reject(new Error('the request has no signal'))
    const body = new ReadableStream<Uint8Array>({
      start: controller => {
        controller.enqueue(new TextEncoder().encode('{'))
        signal.addEventListener('abort', () => controller.error(signal.reason))
      }
    })
    return Promise.resolve(
      new Response(body, { status, headers: { 'content-type': 'application/json' } })
    )
  }
  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

/** Run `fn` and return each time it passed to `AbortSignal.timeout`, in order. */
export const recordTimeouts = async (fn: () => Promise<unknown>): Promise<number[]> => {
  const originalTimeout = AbortSignal.timeout
  const timeouts: number[] = []
  AbortSignal.timeout = (milliseconds: number) => {
    timeouts.push(milliseconds)
    return originalTimeout(milliseconds)
  }
  try {
    await fn()
    return timeouts
  } finally {
    AbortSignal.timeout = originalTimeout
  }
}
