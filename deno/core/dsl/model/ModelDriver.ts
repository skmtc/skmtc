import type { ModelProjection } from './types.ts'
import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '../GeneratedValue.ts'
import type { GeneratedValue } from '../GeneratedValue.ts'
import type { RefName } from '@/types/RefName.ts'
import { toModelGeneratorKey } from '../GeneratorKeys.ts'

type CreateModelArgs<V extends GeneratedValue, EnrichmentType> = {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType>
  refName: RefName
  destinationPath?: string
  rootRef?: RefName
  noExport?: boolean
}
type ApplyArgs = {
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
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
export class ModelDriver<V extends GeneratedValue, EnrichmentType> {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType>
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  rootRef?: RefName
  noExport?: boolean

  constructor({
    context,
    projection,
    refName,
    destinationPath,
    rootRef,
    noExport
  }: CreateModelArgs<V, EnrichmentType>) {
    this.context = context
    this.projection = projection
    this.refName = refName
    this.destinationPath = destinationPath
    this.rootRef = rootRef
    this.noExport = noExport

    this.context.modelDepth[`${projection.id}:${refName}`] = 0

    this.settings = this.context.toModelContentSettings({ refName, projection })
    this.definition = this.apply({ destinationPath })

    this.context.modelDepth[`${projection.id}:${refName}`] = 0
  }

  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    if (destinationPath && normalize(exportPath) !== normalize(destinationPath)) {
      this.context.register({
        imports: { [exportPath]: [identifier.name] },
        destinationPath
      })
    }

    return definition
  }

  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): Definition<V> {
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
      rootRef: this.rootRef
    })

    const definition = new Definition({
      context: this.context,
      value,
      identifier,
      noExport: this.noExport
    })

    this.context.register({
      definitions: [definition],
      destinationPath: exportPath
    })

    return definition
  }

  private affirmDefinition<V extends GeneratedValue>(
    definition: Definition | undefined,
    exportPath: string
  ): definition is Definition<V> {
    if (!definition) {
      return false
    }

    const currentKey = toModelGeneratorKey({
      generatorId: this.projection.id,
      refName: this.refName
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.projection
  }
}
