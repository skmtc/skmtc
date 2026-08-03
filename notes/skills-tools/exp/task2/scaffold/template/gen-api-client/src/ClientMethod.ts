import { OasVoid, decapitalize, toEndpointName, type GenerateContextType, type OasOperation } from '@skmtc/core'
import { TsSnippet, toPathTemplate } from '@skmtc/lang-typescript'
import { ZodProjection } from '@skmtc/gen-zod'

type ConstructorArgs = {
  context: GenerateContextType
  operation: OasOperation
  destinationPath: string
}

export class ClientMethod extends TsSnippet {
/*SLOT:method-fields*/

  constructor({ context, operation, destinationPath }: ConstructorArgs) {
    super({ context })
/*SLOT:method-data*/
  }

  override toString(): string {
/*SLOT:method-render*/
  }
}
