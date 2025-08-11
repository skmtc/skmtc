export class PackageJson {
  name: string

  constructor(name: string) {
    this.name = name
  }

  toString() {
    return `{
  "name": "${this.name}",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "dependencies": {
    "@typespec/compiler": "latest",
    "@typespec/http": "latest",
    "@typespec/rest": "latest",
    "@typespec/openapi": "latest",
    "@typespec/json-schema": "latest",
    "@typespec/openapi3": "latest"
  }
}`
  }
}
