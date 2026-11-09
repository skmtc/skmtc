import type { ModelProjection } from './types.ts'
import type { GenerateContextType, InsertModelOptions } from '@/context/generateTypes.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalizeWorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratedDefinition } from '../GeneratedValue.ts'
import type { GeneratedValue } from '../GeneratedValue.ts'
import type { RefName } from '@/types/RefName.ts'
import { toModelGeneratorKey } from '../GeneratorKeys.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { readProjectionOptions, toValueOptions } from '@/types/ProjectionOptions.ts'
import isEqual from 'lodash-es/isEqual'
import type { Lang } from '@/dsl/Lang.ts'

/**
 * The `insertModel` call plus the context. The Driver defaults `variant`
 * to `'main'` and `noExport` to `false`, and reads the caller's options
 * once for the identity statics and the constructor.
 */
type CreateModelArgs<V extends GeneratedValue, EnrichmentType, ProjectionOptions> = {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType, ProjectionOptions>
  refName: RefName
  rootRef?: RefName
} & InsertModelOptions<ProjectionOptions>
type ApplyArgs = {
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: IdentifierBase
  exportPath: string
  noExport?: boolean
}

/**
 * Driver for the model insertion lifecycle.
 *
 * Resolves the projection's identifier and export path, looks up an
 * existing `Definition` in the target file, instantiates the projection
 * (constructing its value) when no cache hit exists, registers the new
 * definition, and stitches an import into `destinationPath` if it differs
 * from the projection's `exportPath`.
 */
export class ModelDriver<V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined> {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType, ProjectionOptions>
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  rootRef?: RefName
  noExport: boolean
  variant: string
  /** The caller's options, as passed to `insertModel`. */
  options: ProjectionOptions

  constructor(args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>) {
    const {
      context,
      projection,
      refName,
      destinationPath,
      rootRef,
      noExport = false,
      variant = DEFAULT_VARIANT
    } = args

    this.context = context
    this.projection = projection
    this.refName = refName
    this.destinationPath = destinationPath
    this.rootRef = rootRef
    this.noExport = noExport
    this.variant = variant
    this.options = readProjectionOptions<ProjectionOptions>(args)

    this.context.modelDepth[`${projection.id}:${refName}`] = 0

    assertPeerVariantExists({
      context,
      generatorId: projection.id,
      refName,
      variant
    })

    assertPeerSupported({ context, projection, refName, variant })

    this.settings = this.context.toModelContentSettings({
      refName,
      projection,
      variant,
      options: this.options
    })
    this.definition = this.apply({ destinationPath })

    this.context.modelDepth[`${projection.id}:${refName}`] = 0
  }

  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    stitchModelImport({
      context: this.context,
      lang: this.projection.lang,
      identifier,
      exportPath,
      destinationPath
    })

    return definition
  }

  /**
   * Ensure the file at `path` exists, creating it on first write through
   * the projection's language — the static read off the projection class
   * at the use site, never persisted (works pre-construction on the
   * cache-hit path). Returns the normalized path.
   */
  private ensureFile(path: string): string {
    return ensureFile({ context: this.context, lang: this.projection.lang, path })
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
      refName: this.refName,
      context: this.context,
      settings: this.settings,
      destinationPath: this.settings.exportPath,
      rootRef: this.rootRef,
      options: this.options
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

    const currentKey = toModelGeneratorKey({
      generatorId: this.projection.id,
      refName: this.refName,
      variant: this.settings.variant
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    if (!(definition.value instanceof this.projection)) {
      return false
    }

    // Options are identity, like the variant, but cannot ride the key: a hit
    // is checked against the options its value was built with.
    const cachedOptions = toValueOptions(definition.value)

    if (!isEqual(cachedOptions, this.options)) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached options ${JSON.stringify(cachedOptions)} do not match new options ${JSON.stringify(this.options)}. Fold options into toIdentifierName.`
      )
    }

    return true
  }
}

type EnsureFileArgs = {
  context: GenerateContextType
  lang: Lang
  path: string
}

/** Ensure the file at `path` exists, creating it through `lang` on first write. Returns the normalized path. */
const ensureFile = ({ context, lang, path }: EnsureFileArgs): string => {
  const normalizedPath = normalizeWorkspacePath(path)

  if (!context.getFile(normalizedPath)) {
    context.addFile(lang.createFile({ path: normalizedPath, settings: context.settings }))
  }

  return normalizedPath
}

type StitchModelImportArgs = {
  context: GenerateContextType
  lang: Lang
  identifier: IdentifierBase
  exportPath: string
  destinationPath?: string
}

/**
 * Import a model's identifier from its export path into `destinationPath`,
 * unless the two are one file. The language builds the import object
 * (`toImport`) and creates the destination file on first write; the engine
 * stores it via the pure-data `context.register`.
 */
const stitchModelImport = ({ context, lang, identifier, exportPath, destinationPath }: StitchModelImportArgs): void => {
  if (!destinationPath || normalizeWorkspacePath(exportPath) === normalizeWorkspacePath(destinationPath)) {
    return
  }

  ensureFile({ context, lang, path: destinationPath })
  context.register({
    imports: [lang.toImport({ identifier, module: exportPath })],
    destinationPath
  })
}

type IsModelOpenArgs = {
  context: GenerateContextType
  projection: { id: string }
  refName: RefName
}

/**
 * Whether `projection`'s model for `refName` is still being built further
 * up the walk: a reference to it now is a back-reference, which
 * {@link toModelRef} suspends.
 */
export const isModelOpen = ({ context, projection, refName }: IsModelOpenArgs): boolean =>
  context.modelDepth[`${projection.id}:${refName}`] > 0

/**
 * What a ref snippet gets for a reference to a model: `suspended` when the
 * model is still being built further up the walk (a back-reference, which
 * the snippet renders deferred, e.g. `z.lazy(() => Name)`), else the
 * definition the Driver built or found.
 */
export type ModelRef<V extends GeneratedValue, EnrichmentType> =
  | { suspended: true; settings: ContentSettings<EnrichmentType> }
  | { suspended: false; settings: ContentSettings<EnrichmentType>; definition: GeneratedDefinition<V> }

/**
 * Reference a model from a ref snippet. A model still open on the build
 * stack (`modelDepth > 0`) is a back-reference: its depth is bumped, so its
 * projection can tell that it is recursive (`> 1`) once its value is built,
 * and its import is stitched into `destinationPath` as for any reference.
 * The import matters when the back-reference crosses files: in a cycle of
 * two or more models, the model that refers back lives in another file.
 * Any other model goes through the {@link ModelDriver}.
 */
export const toModelRef = <V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined>(
  args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>
): ModelRef<V, EnrichmentType> => {
  const { context, projection, refName, destinationPath, variant = DEFAULT_VARIANT } = args

  if (isModelOpen({ context, projection, refName })) {
    context.modelDepth[`${projection.id}:${refName}`]++

    const settings = context.toModelContentSettings({
      refName,
      projection,
      variant,
      options: readProjectionOptions<ProjectionOptions>(args)
    })

    stitchModelImport({
      context,
      lang: projection.lang,
      identifier: settings.identifier,
      exportPath: settings.exportPath,
      destinationPath
    })

    return { suspended: true, settings }
  }

  const { settings, definition } = new ModelDriver(args)

  return { suspended: false, settings, definition }
}

type AssertPeerVariantExistsArgs = {
  context: GenerateContextType
  generatorId: string
  refName: RefName
  variant: string
}

/**
 * Guard the peer-variant-mismatch invariant for model insertions.
 *
 * `'main'` is the universally-safe variant — it's guaranteed to be
 * present on every peer (the engine fills it when no enrichments are
 * configured, and the missing-`'main'` check throws when other
 * variants exist without it). So calls with `variant === 'main'`
 * always succeed regardless of the peer's enrichment shape.
 *
 * For any other variant, the peer's enrichment block at
 * `[generatorId][refName]` must explicitly declare that variant
 * key. The Driver throws here — loud at the call site — rather than
 * letting silently-wrong output reach the consumer.
 */
const assertPeerVariantExists = ({
  context,
  generatorId,
  refName,
  variant
}: AssertPeerVariantExistsArgs): void => {
  if (variant === DEFAULT_VARIANT) {
    return
  }

  const modelEnrichments: unknown = context.readEnrichment([generatorId, refName])

  if (modelEnrichments === null || modelEnrichments === undefined) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${refName}' — ` +
        `peer has no enrichments configured. Only '${DEFAULT_VARIANT}' is permitted.`
    )
  }

  if (typeof modelEnrichments !== 'object' || Array.isArray(modelEnrichments)) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${refName}' — ` +
        `peer enrichment is not a variant record.`
    )
  }

  if (!(variant in modelEnrichments)) {
    const available = Object.keys(modelEnrichments).join(', ')
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${refName}'. ` +
        `Available variants: ${available}.`
    )
  }
}

type AssertPeerSupportedArgs<V extends GeneratedValue, EnrichmentType, ProjectionOptions> = {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType, ProjectionOptions>
  refName: RefName
  variant: string
}

/**
 * Guard the peer-capability invariant for model insertions.
 *
 * `insertModel` materialises a peer's Definition regardless of the peer's
 * `skip` / `include` configuration — dependency edges are intentionally
 * filter-blind. Capability is different: a peer's `isSupported` declares
 * which models it can serve *at all*. Handing a peer a model it has declared
 * unsupported would build a broken Definition or crash inside the peer's
 * constructor.
 *
 * The Driver throws here instead. The throw unwinds into `GenerateContext`'s
 * per-item `try/catch`, so the *calling* generator's item is recorded as
 * `error` and the run continues — loud, isolated failure rather than silent
 * broken output.
 *
 * A peer that exposes no static `isSupported` is treated as supporting every
 * model: `toModelProjectionBase` defaults it to `() => true`, and a
 * hand-rolled projection may omit it.
 */
const assertPeerSupported = <V extends GeneratedValue, EnrichmentType, ProjectionOptions>({
  context,
  projection,
  refName,
  variant
}: AssertPeerSupportedArgs<V, EnrichmentType, ProjectionOptions>): void => {
  const isSupported = projection.isSupported ?? (() => true)

  if (!isSupported({ refName, context, variant })) {
    throw new Error(
      `[${projection.id}] Cannot insert '${refName}' — peer generator ` +
        `does not support this model (isSupported returned false).`
    )
  }
}
