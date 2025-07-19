import type { Identifier } from './Identifier.ts'

type EmptyArgs = {
  exportPath: string
  identifier: Identifier
}

type CreateArgs<EnrichmentType = undefined> = {
  identifier: Identifier
  exportPath: string
  enrichments: EnrichmentType
}

export class ContentSettings<EnrichmentType = undefined> {
  identifier: Identifier
  exportPath: string
  enrichments: EnrichmentType
  constructor({ identifier, exportPath, enrichments }: CreateArgs<EnrichmentType>) {
    this.identifier = identifier
    this.exportPath = exportPath
    this.enrichments = enrichments
  }

  static empty({ identifier, exportPath }: EmptyArgs): ContentSettings<undefined> {
    return new ContentSettings({
      identifier,
      exportPath,
      enrichments: undefined
    })
  }
}
