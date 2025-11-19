export type FileType = 'json' | 'yaml'

export type SchemaSource =
  | {
      type: 'local'
      path: string
    }
  | {
      type: 'remote'
      url: string
    }
