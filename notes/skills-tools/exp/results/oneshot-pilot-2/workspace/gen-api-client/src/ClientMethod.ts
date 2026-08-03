import { toPathTemplate } from '@skmtc/lang-typescript'
import type { OasOperation } from '@skmtc/core'

type ClientMethodArgs = {
  operation: OasOperation
  methodName: string
  zodResponseName: string
}

export class ClientMethod {
  methodName: string
  path: string
  method: string
  pathParams: string[]
  hasBody: boolean
  zodResponseName: string

  constructor({ operation, methodName, zodResponseName }: ClientMethodArgs) {
    this.methodName = methodName
    this.path = operation.path
    this.method = operation.method
    this.pathParams = operation.toParams(['path']).map(({ name }) => name)
    this.hasBody = ['post', 'put', 'patch'].includes(operation.method)
    this.zodResponseName = zodResponseName
  }

  toString(): string {
    const params = [
      ...this.pathParams.map(name => `${name}: string`),
      ...(this.hasBody ? ['body: unknown'] : [])
    ].join(', ')

    const init = [
      `method: '${this.method.toUpperCase()}'`,
      ...(this.hasBody
        ? [`headers: { 'Content-Type': 'application/json' }`, `body: JSON.stringify(body)`]
        : [])
    ].join(',\n      ')

    return `async ${this.methodName}(${params}) {
    const res = await fetch(\`${toPathTemplate(this.path)}\`, {
      ${init}
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    return ${this.zodResponseName}.parse(await res.json())
  }`
  }
}
