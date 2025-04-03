import { toOptionalResponsesV3 } from '../response/toResponseV3.ts'
import { toHeadersV3 } from '../header/toHeadersV3.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toOptionalParametersV3 } from '../parameter/toParameterV3.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRequestBodiesV3 } from '../requestBody/toRequestBodiesV3.ts'
import { OasComponents } from './Components.ts'
import type { ComponentsFields } from './Components.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toSecuritySchemesV3 } from '../securitySchemes/toSecuritySchemes.ts'

type ToComponentsV3Args = {
  components: OpenAPIV3.ComponentsObject | undefined
  context: ParseContext
}

export const toComponentsV3 = ({
  components,
  context
}: ToComponentsV3Args): OasComponents | undefined => {
  if (!components) {
    return undefined
  }

  const {
    schemas,
    responses,
    parameters,
    examples,
    requestBodies,
    headers,
    securitySchemes,
    ...skipped
  } = components

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: components,
    context
  })

  const fields: ComponentsFields = {
    schemas: context.trace('schemas', () => toOptionalSchemasV3({ schemas, context })),
    responses: context.trace('responses', () => toOptionalResponsesV3({ responses, context })),
    parameters: context.trace('parameters', () =>
      toOptionalParametersV3({
        parameters,
        context
      })
    ),
    examples: toExamplesV3({
      examples,
      example: undefined,
      exampleKey: 'TEMP',
      context
    }),
    requestBodies: context.trace('requestBodies', () =>
      toRequestBodiesV3({ requestBodies, context })
    ),
    headers: context.trace('headers', () => toHeadersV3({ headers, context })),
    securitySchemes: context.trace('securitySchemes', () =>
      toSecuritySchemesV3({ securitySchemes, context })
    ),
    extensionFields
  }

  return new OasComponents(fields)
}
