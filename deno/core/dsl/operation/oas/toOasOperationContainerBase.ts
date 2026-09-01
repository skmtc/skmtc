import type * as v from 'valibot'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { FindDefinitionsQuery } from '@/dsl/CodeFileBase.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { LangSnippetConstructor } from '@/dsl/Lang.ts'
import { toContainerGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { parseEnrichmentUmbrella } from '@/enrichments/parseEnrichmentUmbrella.ts'
import { matchDefinitions } from '@/dsl/CodeFileBase.ts'
import type {
  IsSupportedOasOperationArgs,
  ToGeneratorKeyArgs,
  ToOasOperationGroupNameArgs,
  ToOasOperationEnrichmentsArgs,
  ToOasOperationExportPathArgs,
  ToOasOperationIdentifierNameArgs
} from '@/dsl/operation/oas/types.ts'

/**
 * Configuration for {@link toOasOperationContainerBase}.
 *
 * The identity half is an operation projection's: `toIdentifierName` and
 * `toExportPath` are pure functions of `(operation, enrichments, variant)`,
 * resolved before construction so the cache probe stays cheap. What differs
 * is that they are expected to be functions of the operation's GROUP — its
 * tag, its file — so every operation in the group resolves to one
 * declaration. Nothing enforces that; an identity that varies per operation
 * simply yields one container per operation, visible in the output.
 *
 * Enrichments are read exactly as an operation projection's are, from the
 * operation inserting into the container.
 */
export type OasOperationContainerBaseConfig<
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
> = {
  id: string
  /**
   * The group this container collects — the operation's tag, its module,
   * whatever the generator gathers subjects by. Pure, and a function of the
   * subject like its identity siblings, so every member of a group computes
   * the same one.
   *
   * It is what the container's key is made of. Deriving the key from the
   * group rather than from where the container lands keeps it saying what
   * the definition is rather than where it sits, and keeps it stable when a
   * generator changes its naming or file policy.
   */
  toGroupName: (args: ToOasOperationGroupNameArgs<EnrichmentType>) => string
  /** Pure: the cache-key name, a function of the operation's group. */
  toIdentifierName: (args: ToOasOperationIdentifierNameArgs<EnrichmentType>) => string
  /** Runs only on cache-miss. Returns this language's identifier type. */
  toIdentifierType: (operation: OasOperation, context: GenerateContextType) => IdType
  /** Pure: the file the container is declared in. */
  toExportPath: (args: ToOasOperationExportPathArgs<EnrichmentType>) => string
  /** The generator's composite `{ subject, generator, stack }` schema. */
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  isSupported?: (args: IsSupportedOasOperationArgs) => boolean
}

/**
 * Arguments every container projection's constructor receives — the same
 * shape an operation projection gets, from the operation that reached the
 * container first.
 */
export type OasOperationContainerConstructorArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: OasOperation
  settings: ContentSettings<EnrichmentType>
}

/**
 * Build a base class for a declaration that HOLDS definitions — a Kotlin
 * interface body, a C# class body — rather than one that is a subject's
 * artifact.
 *
 * Two things separate it from {@link import('./toOasOperationProjectionBase.ts').toOasOperationProjectionBase}:
 *
 * The value carries a {@link toContainerGeneratorKey} rather than the
 * operation's own. A subject-derived key is what makes many operations
 * resolving to one definition fail the integrity check on the second of
 * them; an identity-derived one is computed identically by every member,
 * while still carrying the `generatorId` that stops another generator
 * claiming the declaration.
 *
 * And it implements the member store, so the engine can insert into it —
 * which is also what makes the class assignable where a container is asked
 * for, with nothing to declare. The subclass renders those members; where
 * they sit in the declaration, and at what indentation, is the language's
 * business, not the engine's.
 */
export const toOasOperationContainerBase = <
  EnrichmentType = undefined,
  IdType extends IdentifierType = IdentifierType
>(
  base: LangSnippetConstructor,
  config: OasOperationContainerBaseConfig<EnrichmentType, IdType>
) => {
  const toGeneratorKey = ({ operation, settings }: ToGeneratorKeyArgs<EnrichmentType>) => {
    const variant = settings.variant ?? DEFAULT_VARIANT

    return toContainerGeneratorKey({
      generatorId: config.id,
      group: config.toGroupName({ operation, enrichments: settings.enrichments, variant }),
      name: settings.identifier.name,
      variant
    })
  }

  return class extends base {
    static id = config.id
    static type = 'oasOperation' as const

    static toGroupName = config.toGroupName.bind(config)
    /** Keyed on the group, so every member of it computes the same key. */
    static toGeneratorKey = toGeneratorKey

    static toIdentifierName = config.toIdentifierName.bind(config)
    static toIdentifierType = config.toIdentifierType.bind(config)
    static toExportPath = config.toExportPath.bind(config)
    static isSupported = config.isSupported ?? (() => true)

    static toEnrichments = ({
      operation,
      context,
      variant
    }: ToOasOperationEnrichmentsArgs): EnrichmentType => {
      return parseEnrichmentUmbrella({
        context,
        generatorId: config.id,
        subjectSegments: [operation.path, operation.method, variant],
        schema: config.toEnrichmentSchema()
      })
    }

    settings: ContentSettings<EnrichmentType>
    operation: OasOperation
    /**
     * The members inserted into this declaration, in arrival order — which
     * is the engine's sweep order, so it is stable across runs.
     */
    definitions: DefinitionBase[] = []

    constructor(args: OasOperationContainerConstructorArgs<EnrichmentType>) {
      super({
        context: args.context,
        generatorKey: toGeneratorKey({ operation: args.operation, settings: args.settings })
      })

      this.operation = args.operation
      this.settings = args.settings
    }

    /** {@link import('@/dsl/DefinitionContainer.ts').DefinitionContainer} */
    addDefinition(definition: DefinitionBase): void {
      this.definitions.push(definition)
    }

    /** {@link import('@/dsl/DefinitionContainer.ts').DefinitionContainer} */
    findDefinitions(query?: FindDefinitionsQuery): DefinitionBase[] | undefined {
      return matchDefinitions(this.definitions, query, () => undefined)
    }
  }
}
