import { stub } from '@std/testing/mock'
import type { Generator } from '@/types/generator.ts'

/**
 * Stubs `globalThis.fetch` to answer the JSR registry catalog request
 * (`GET {JSR_URL}/api/packages`) that `useGetGenerators` makes, with
 * the given generators. Call `.restore()` (or use `using`) when done.
 */
export const stubRegistryGenerators = (generators: Generator[]) =>
  stub(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          items: generators.map(({ scope, packageName }) => ({
            scope,
            name: packageName,
            createdAt: '2024-01-01T00:00:00Z',
            latestVersion: '0.0.1'
          }))
        }),
        { status: 200 }
      )
    )
  )
