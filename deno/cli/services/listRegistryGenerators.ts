import { z } from 'zod'
import { toJsrUrl } from '@/lib/jsr-registry.ts'
import type { Generator } from '@/types/generator.ts'

const registryPackages = z.object({
  items: z.array(
    z.object({
      scope: z.string(),
      name: z.string(),
      latestVersion: z.string().nullable()
    })
  )
})

/**
 * Lists installable generator packages from the JSR registry catalog
 * (`GET {JSR_URL}/api/packages`). Only `gen-*` packages with at least
 * one published version are returned. The registry listing carries no
 * cross-generator dependency metadata, so `dependencies` is always
 * empty — published packages resolve their own dependencies via JSR.
 */
export const listRegistryGenerators = async (): Promise<Generator[]> => {
  const res = await fetch(toJsrUrl('/api/packages'))

  if (!res.ok) {
    throw new Error(`Failed to list packages from JSR registry (HTTP ${res.status})`)
  }

  const { items } = registryPackages.parse(await res.json())

  return items
    .filter(({ name, latestVersion }) => name.startsWith('gen-') && latestVersion !== null)
    .map(({ scope, name }) => ({ scope, packageName: name, dependencies: [] }))
}
