import type { ReadOnlyBundle } from '@/lib/create-bundle.ts'

export type StubBundle = ReadOnlyBundle & {
  /** Whether the caller disposed of the bundle. */
  disposed: () => boolean
}

/** Stands in for `createReadOnlyBundle`'s result without building anything. */
export const toStubBundle = (bundlePath = 'file:///mock/bundle.js'): StubBundle => {
  const state = { disposed: false }
  return {
    bundlePath,
    disposed: () => state.disposed,
    [Symbol.asyncDispose]: () => {
      state.disposed = true
      return Promise.resolve()
    }
  }
}
