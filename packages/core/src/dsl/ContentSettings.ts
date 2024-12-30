import type { Identifier } from './Identifier.js'

type EmptyArgs = {
  exportPath: string
  identifier: Identifier
}

type CreateArgs<EnrichmentType> = {
  identifier: Identifier
  selected: boolean
  exportPath: string
  enrichments: EnrichmentType
}

export class ContentSettings<EnrichmentType> {
  identifier: Identifier
  selected: boolean
  exportPath: string
  enrichments: EnrichmentType
  constructor({ identifier, selected, exportPath, enrichments }: CreateArgs<EnrichmentType>) {
    this.identifier = identifier
    this.selected = selected
    this.exportPath = exportPath
    this.enrichments = enrichments
  }

  static empty({ identifier, exportPath }: EmptyArgs): ContentSettings<undefined> {
    return new ContentSettings({
      selected: true,
      identifier,
      exportPath,
      enrichments: undefined
    })
  }
}
