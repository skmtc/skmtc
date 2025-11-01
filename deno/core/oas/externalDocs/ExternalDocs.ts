export type ExternalDocsFields = {
  url: string
  description: string | undefined
}

export class OasExternalDocs {
  url: string
  description: string | undefined

  constructor(fields: ExternalDocsFields) {
    this.url = fields.url
    this.description = fields.description
  }
}
