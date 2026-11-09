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
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { PendingDefinition } from '@/dsl/PendingDefinition.ts'

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

  /** The code File at `path`, created through the projection's language on first use. */
  private ensureCodeFile(path: string): CodeFileBase {
    const file = this.context.getFile(this.ensureFile(path))

    if (!(file instanceof CodeFileBase)) {
      throw new Error(`File at '${path}' is not a code file: a model Definition cannot go there.`)
    }

    return file
  }

  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): DefinitionBase<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    const generatorKey = toModelGeneratorKey({
      generatorId: this.projection.id,
      refName: this.refName,
      variant: this.settings.variant
    })

    const pending = this.context.findPendingDefinition({ name: identifier.name, exportPath })

    if (pending) {
      assertSameKey({ name: identifier.name, exportPath, cachedKey: pending.generatorKey, generatorKey })
      assertSameOptions({ name: identifier.name, exportPath, cachedOptions: pending.options, options: this.options })

      throw new Error(
        `'${identifier.name}' in file '${exportPath}' is being constructed further up the stack. A reference back to it goes through toModelRef, which returns it suspended; a second projection would never finish.`
      )
    }

    // The marker is in the File while the constructor runs: an insert of this
    // model from inside it (a cycle) finds the marker, not a cache miss. The
    // Definition is registered after the constructor returns, so it lands
    // after the models it refers to (post-order), as before the marker.
    const file = this.ensureCodeFile(exportPath)
    const marker = new PendingDefinition({ identifier, generatorKey, options: this.options })

    const value = whilePending({ context: this.context, file, marker }, () =>
      new this.projection({
        refName: this.refName,
        context: this.context,
        settings: this.settings,
        destinationPath: this.settings.exportPath,
        rootRef: this.rootRef,
        options: this.options
      })
    )

    const definition = this.projection.lang.toDefinition({
      context: this.context,
      identifier,
      value,
      noExport: this.noExport
    })
    definition.reaches = marker.reaches

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

    assertSameKey({
      name: definition.identifier.name,
      exportPath,
      cachedKey: definition.generatorKey,
      generatorKey: currentKey
    })

    if (!(definition.value instanceof this.projection)) {
      return false
    }

    // Options are identity, like the variant, but cannot ride the key: a hit
    // is checked against the options its value was built with.
    assertSameOptions({
      name: definition.identifier.name,
      exportPath,
      cachedOptions: toValueOptions(definition.value),
      options: this.options
    })

    return true
  }
}

type AssertSameKeyArgs = {
  name: string
  exportPath: string
  cachedKey: string | undefined
  generatorKey: string
}

/** Two generators, subjects or variants that claim one name in one file collide: `Registered definition mismatch`. */
const assertSameKey = ({ name, exportPath, cachedKey, generatorKey }: AssertSameKeyArgs): void => {
  if (cachedKey !== generatorKey) {
    throw new Error(
      `Registered definition mismatch: '${name}' in file '${exportPath}'. Cached key '${cachedKey}' does not match new key '${generatorKey}'`
    )
  }
}

type AssertSameOptionsArgs = {
  name: string
  exportPath: string
  cachedOptions: unknown
  options: unknown
}

/** One name in one file built with other caller options collides too: options are identity. */
const assertSameOptions = ({ name, exportPath, cachedOptions, options }: AssertSameOptionsArgs): void => {
  if (!isEqual(cachedOptions, options)) {
    throw new Error(
      `Registered definition mismatch: '${name}' in file '${exportPath}'. Cached options ${JSON.stringify(cachedOptions)} do not match new options ${JSON.stringify(options)}. Fold options into toIdentifierName.`
    )
  }
}

type WhilePendingArgs = {
  context: GenerateContextType
  file: CodeFileBase
  marker: PendingDefinition
}

/**
 * Run `construct` with `marker` in `file` and on top of the context's pending
 * stack, and take it out of both however `construct` ends.
 */
const whilePending = <T>({ context, file, marker }: WhilePendingArgs, construct: () => T): T => {
  file.pendingDefinitions.set(marker.identifier.name, marker)
  context.pendingStack.push(marker)

  try {
    return construct()
  } finally {
    context.pendingStack.pop()
    file.pendingDefinitions.delete(marker.identifier.name)
    marker.pending = false
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

/**
 * Whether `projection`'s model for `refName` is pending: its projection is
 * being constructed further up the stack, so a reference to it now is a
 * back-reference, which {@link toModelRef} returns suspended. Answered from
 * the model's File, as the cache probe is.
 */
export const isModelPending = <V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined>(
  args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>
): boolean => toPendingDefinition(args) !== undefined

/**
 * Whether a reference to `projection`'s model for `refName`, made now, is
 * deferred: the model is pending (a reference back), or it reached a model
 * that is still pending (the reference is inside a cycle). This is what
 * {@link toModelRef} reports as `suspended` or `inCycle`.
 */
export const isReferenceDeferred = <V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined>(
  args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>
): boolean => {
  const settings = toReferencedSettings(args)
  const location = { name: settings.identifier.name, exportPath: settings.exportPath }

  if (args.context.findPendingDefinition(location)) {
    return true
  }

  return toOpenReaches(args.context.findDefinition(location)).length > 0
}

/** The models `definition`'s construction reached that are still pending. */
const toOpenReaches = (definition: DefinitionBase | undefined): PendingDefinition[] =>
  [...(definition?.reaches ?? [])].filter(reached => reached.pending)

/**
 * Whether anything referred back to the model of `settings` while its
 * projection was being constructed: the model is recursive, on its own or in
 * a cycle with others. Call it from the projection's constructor, after the
 * value is built, while the model is still pending.
 */
export const isReferencedBack = ({ context, settings }: IsReferencedBackArgs): boolean => {
  const pending = context.findPendingDefinition({
    name: settings.identifier.name,
    exportPath: settings.exportPath
  })

  return pending !== undefined && pending.backReferences > 0
}

type IsReferencedBackArgs = {
  context: GenerateContextType
  settings: { identifier: { name: string }; exportPath: string }
}

/** The settings of the model a reference names, and its marker when it is pending. */
const toPendingDefinition = <V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined>(
  args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>
): PendingDefinition | undefined => {
  const settings = toReferencedSettings(args)

  return args.context.findPendingDefinition({
    name: settings.identifier.name,
    exportPath: settings.exportPath
  })
}

const toReferencedSettings = <V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined>(
  args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>
): ContentSettings<EnrichmentType> => {
  const { context, projection, refName, variant = DEFAULT_VARIANT } = args

  return context.toModelContentSettings({
    refName,
    projection,
    variant,
    options: readProjectionOptions<ProjectionOptions>(args)
  })
}

/**
 * What a ref snippet gets for a reference to a model: `suspended` when the
 * model is pending (a back-reference, which the snippet renders deferred,
 * e.g. `z.lazy(() => Name)`: the value does not exist yet), else the
 * Definition the Driver constructed or found.
 */
export type ModelRef<V extends GeneratedValue, EnrichmentType> =
  | { suspended: true; settings: ContentSettings<EnrichmentType> }
  | {
    suspended: false
    settings: ContentSettings<EnrichmentType>
    definition: GeneratedDefinition<V>
    /**
     * The model reached a model that is still pending, so this reference is
     * inside a cycle. Every reference inside a cycle must be deferred where
     * the target language reads the value when the module loads (zod's
     * `z.lazy`): any model of the cycle can be the first one loaded.
     */
    inCycle: boolean
  }

/**
 * Reference a model from a ref snippet. A pending model (its projection is
 * being constructed further up the stack) is a back-reference: its marker
 * counts it, so its projection can tell that it is recursive
 * ({@link isReferencedBack}), and its import is stitched into
 * `destinationPath` as for any reference. The import matters when the
 * back-reference crosses files: in a cycle of two or more models, the model
 * that refers back lives in another file. Any other model goes through the
 * {@link ModelDriver}.
 */
export const toModelRef = <V extends GeneratedValue, EnrichmentType, ProjectionOptions = undefined>(
  args: CreateModelArgs<V, EnrichmentType, ProjectionOptions>
): ModelRef<V, EnrichmentType> => {
  const { context, projection, refName, destinationPath, variant = DEFAULT_VARIANT } = args
  const settings = toReferencedSettings(args)
  const pending = context.findPendingDefinition({
    name: settings.identifier.name,
    exportPath: settings.exportPath
  })

  if (pending) {
    const generatorKey = toModelGeneratorKey({ generatorId: projection.id, refName, variant })

    assertSameKey({
      name: settings.identifier.name,
      exportPath: settings.exportPath,
      cachedKey: pending.generatorKey,
      generatorKey
    })
    assertSameOptions({
      name: settings.identifier.name,
      exportPath: settings.exportPath,
      cachedOptions: pending.options,
      options: readProjectionOptions<ProjectionOptions>(args)
    })

    pending.backReferences++
    // The model whose constructor is running reached a pending model.
    context.pendingStack.at(-1)?.reaches.add(pending)

    stitchModelImport({
      context,
      lang: projection.lang,
      identifier: settings.identifier,
      exportPath: settings.exportPath,
      destinationPath
    })

    return { suspended: true, settings }
  }

  const driver = new ModelDriver(args)
  // What the model reached that is still pending, the source reaches too:
  // through this reference. Constructed now or found in the cache, the
  // Definition carries what its construction reached.
  const open = toOpenReaches(driver.definition)
  const source = context.pendingStack.at(-1)

  open.forEach(reached => source?.reaches.add(reached))

  return { suspended: false, settings: driver.settings, definition: driver.definition, inCycle: open.length > 0 }
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
