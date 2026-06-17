import type { WebhookProjection } from './types.ts'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { toWebhookGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

type CreateWebhookArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  projection: WebhookProjection<V, EnrichmentType>
  webhook: OasWebhook
  destinationPath?: string
  noExport?: boolean
  /**
   * Target variant of the projection. The Driver resolves the peer's
   * enrichment for this variant, asserts the variant exists (or is the
   * default `'main'` which is always permitted), and threads it into the
   * projection's `ContentSettings`.
   */
  variant: string
}

type ApplyArgs = {
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: IdentifierBase
  exportPath: string
}

/**
 * Driver for the webhook insertion lifecycle.
 *
 * Sibling of `OasOperationDriver`. Resolves the projection's identifier and
 * export path, looks up an existing `Definition` in the target file,
 * instantiates the projection (constructing its value) when no cache hit
 * exists, registers the new definition, and stitches an import into
 * `destinationPath` if it differs from the projection's `exportPath`.
 */
export class WebhookDriver<V extends GeneratedValue, EnrichmentType = undefined> {
  context: GenerateContextType
  projection: WebhookProjection<V, EnrichmentType>
  webhook: OasWebhook
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  noExport?: boolean
  variant: string

  constructor({
    context,
    projection,
    webhook,
    destinationPath,
    noExport,
    variant
  }: CreateWebhookArgs<V, EnrichmentType>) {
    this.context = context
    this.projection = projection
    this.webhook = webhook
    this.destinationPath = destinationPath
    this.noExport = noExport
    this.variant = variant

    assertPeerVariantExists({
      context,
      generatorId: projection.id,
      webhook,
      variant
    })

    assertPeerSupported({ context, projection, webhook })

    this.settings = this.context.toWebhookContentSettings({
      webhook,
      projection,
      variant
    })

    this.definition = this.apply({ destinationPath })
  }

  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    if (destinationPath && normalize(exportPath) !== normalize(destinationPath)) {
      // Cross-file import of the peer's identifier from its export path.
      this.ensureFile(destinationPath)
      this.context.register({
        imports: [this.projection.lang.toImport({ identifier, module: exportPath })],
        destinationPath
      })
    }

    return definition
  }

  /**
   * Ensure the file at `path` exists, creating it on first write through the
   * projection's language. Returns the normalized path.
   */
  private ensureFile(path: string): string {
    const normalizedPath = normalize(path)

    if (!this.context.getFile(normalizedPath)) {
      this.context.addFile(
        this.projection.lang.createFile({ path: normalizedPath, settings: this.context.settings })
      )
    }

    return normalizedPath
  }

  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): DefinitionBase<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    const value = new this.projection({
      context: this.context,
      webhook: this.webhook,
      settings: this.settings
    })

    const definition = this.projection.lang.toDefinition({
      context: this.context,
      identifier,
      value,
      noExport: this.noExport
    })

    this.ensureFile(exportPath)
    this.context.register({
      definitions: [definition],
      destinationPath: exportPath
    })

    return definition
  }

  private affirmDefinition<V extends GeneratedValue>(
    definition: DefinitionBase | undefined,
    exportPath: string
  ): definition is DefinitionBase<V> {
    if (!definition) {
      return false
    }

    const currentKey = toWebhookGeneratorKey({
      generatorId: this.projection.id,
      webhook: this.webhook,
      variant: this.settings.variant
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.projection
  }
}

type AssertPeerVariantExistsArgs = {
  context: GenerateContextType
  generatorId: string
  webhook: OasWebhook
  variant: string
}

/**
 * Guard the peer-variant-mismatch invariant (sibling of the operation
 * Driver's). `'main'` is universally safe; any other variant must be
 * declared in the peer's enrichment block at `[generatorId][name][method]`.
 */
const assertPeerVariantExists = ({
  context,
  generatorId,
  webhook,
  variant
}: AssertPeerVariantExistsArgs): void => {
  if (variant === DEFAULT_VARIANT) {
    return
  }

  const webhookEnrichments: unknown = get(
    context.settings,
    ['enrichments', generatorId, webhook.name, webhook.method]
  )

  const webhookLabel = `webhook '${webhook.name}' (${webhook.method.toUpperCase()})`

  if (webhookEnrichments === null || webhookEnrichments === undefined) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for ${webhookLabel} — ` +
        `peer has no enrichments configured. Only '${DEFAULT_VARIANT}' is permitted.`
    )
  }

  if (typeof webhookEnrichments !== 'object' || Array.isArray(webhookEnrichments)) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for ${webhookLabel} — ` +
        `peer enrichment is not a variant record.`
    )
  }

  if (!(variant in webhookEnrichments)) {
    const available = Object.keys(webhookEnrichments).join(', ')
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for ${webhookLabel}. ` +
        `Available variants: ${available}.`
    )
  }
}

type AssertPeerSupportedArgs = {
  context: GenerateContextType
  projection: {
    id: string
    isSupported?: (args: { webhook: OasWebhook; context: GenerateContextType }) => boolean
  }
  webhook: OasWebhook
}

/**
 * Guard the peer-capability invariant (sibling of the operation Driver's).
 * A peer that declares a webhook unsupported throws here; the throw unwinds
 * into `GenerateContext`'s per-item `try/catch`, recording the calling
 * generator's item as `error` while the run continues. A peer with no static
 * `isSupported` supports every webhook.
 */
const assertPeerSupported = ({
  context,
  projection,
  webhook
}: AssertPeerSupportedArgs): void => {
  if (typeof projection.isSupported !== 'function') {
    return
  }

  if (!projection.isSupported({ webhook, context })) {
    const webhookLabel = `webhook '${webhook.name}' (${webhook.method.toUpperCase()})`
    throw new Error(
      `[${projection.id}] Cannot insert ${webhookLabel} — peer generator ` +
        `does not support this webhook (isSupported returned false).`
    )
  }
}
