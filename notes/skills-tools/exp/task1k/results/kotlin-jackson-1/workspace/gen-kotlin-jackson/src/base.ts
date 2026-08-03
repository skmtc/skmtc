import { camelCase } from '@skmtc/core'
import { toKtModelProjectionBase } from '@skmtc/lang-kotlin'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }
import { type EnrichmentSchema, toEnrichmentSchema } from './enrichments.ts'
import { BASE_PACKAGE } from './lib.ts'
import { toModelShape } from './shape.ts'

export const KotlinJacksonBase = toKtModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  // SLOT(naming): PascalCase from refName ONLY — deterministic, never
  // construction-dependent. Kotlin declarations are PascalCase.
  toIdentifierName({ refName }): string {
    return camelCase(refName, { upperFirst: true })
  },

  // SLOT(identifier-kind): unlike TypeScript, Kotlin's kind depends on the
  // schema's SHAPE (data class vs enum class vs typealias), so this reads
  // context. It runs only on cache-miss; the NAME above stays pure.
  toIdentifierType: (refName, context) => ({
    type: toModelShape(context, refName),
  }),

  // SLOT(export-path): the directory segments ARE the Kotlin package —
  // `@/com/example/models/Order.generated.kt` → `package com.example.models`.
  // Hardcoded: this generator takes no runtime configuration.
  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', ...BASE_PACKAGE.split('.'), `${name}.generated.kt`)
  },

  toEnrichmentSchema,
})
