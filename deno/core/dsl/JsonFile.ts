type JsonFileArgs = {
  path: string
  content: Record<string, unknown>
}

export class JsonFile {
  fileType: 'json' = 'json'
  path: string
  content: Record<string, unknown>

  constructor({ path, content }: JsonFileArgs) {
    this.path = path
    this.content = content
  }

  toString(): string {
    return JSON.stringify(this.content, null, 2)
  }
}
