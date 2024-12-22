import type { Identifier } from './Identifier.ts'

type EmptyArgs = {
  exportPath: string
  identifier: Identifier
}

type CreateArgs = {
  identifier: Identifier
  selected: boolean
  exportPath: string
}

export class ContentSettings {
  identifier: Identifier
  selected: boolean
  exportPath: string

  constructor({ identifier, selected, exportPath }: CreateArgs) {
    this.identifier = identifier
    this.selected = selected
    this.exportPath = exportPath
  }

  static empty({ identifier, exportPath }: EmptyArgs): ContentSettings {
    return new ContentSettings({
      selected: true,
      identifier,
      exportPath
    })
  }
}
