import * as v from 'valibot'
import { toJsrUrl } from '@/lib/jsr-registry.ts'
import type { Generator } from '@/types/generator.ts'

const registryPackages = v.object({
  items: v.array(
    v.object({
      scope: v.string(),
      name: v.string(),
      latestVersion: v.nullable(v.string())
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

  const { items } = v.parse(registryPackages, await res.json())

  return items
    .filter(({ name, latestVersion }) => name.startsWith('gen-') && latestVersion !== null)
    .map(({ scope, name }) => ({ scope, packageName: name, dependencies: [] }))
}
