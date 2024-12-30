import type {
  GeneratedDefinition,
  GeneratedValue,
  GenerationType
} from '../types/GeneratedValue.js'
import type { ContentSettings } from './ContentSettings.js'
import type { Identifier } from './Identifier.js'

type ConstructorArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
  settings: ContentSettings<EnrichmentType>
  definition: GeneratedDefinition<V, T>
}

export class Inserted<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
  settings: ContentSettings<EnrichmentType>
  definition: GeneratedDefinition<V, T>
  constructor({ settings, definition }: ConstructorArgs<V, T, EnrichmentType>) {
    this.settings = settings
    this.definition = definition
  }

  toName(): string {
    return this.settings.identifier.name
  }

  toIdentifier(): Identifier {
    return this.settings.identifier
  }

  toExportPath(): string {
    return this.settings.exportPath
  }

  toValue(): T extends 'force' ? V : V | undefined {
    return this.definition?.value as T extends 'force' ? V : V | undefined
  }
}
