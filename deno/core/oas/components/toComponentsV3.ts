import { toOptionalResponsesV3 } from '../response/toResponseV3.ts'
import { toHeadersV3 } from '../header/toHeadersV3.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toOptionalParametersV3 } from '../parameter/toParameterV3.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRequestBodiesV3 } from '../requestBody/toRequestBodiesV3.ts'
import { OasComponents } from './Components.ts'
import type { ComponentsFields } from './Components.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toSecuritySchemesV3 } from '../securitySchemes/toSecuritySchemes.ts'
import { tracer } from '@/helpers/tracer.ts'

type ToComponentsV3Args = {
  components: OpenAPIV3.ComponentsObject | undefined
  context: ParseContextType
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
    context,
    parentType: 'components'
  })

  const fields: ComponentsFields = {
    schemas: tracer(context.stackTrail, 'schemas', () => toOptionalSchemasV3({ schemas, context })),
    responses: tracer(context.stackTrail, 'responses', () =>
      toOptionalResponsesV3({ responses, context })
    ),
    parameters: tracer(context.stackTrail, 'parameters', () =>
      toOptionalParametersV3({ parameters, context })
    ),
    examples: toExamplesV3({
      examples,
      example: undefined,
      exampleKey: 'TEMP',
      context
    }),
    requestBodies: tracer(context.stackTrail, 'requestBodies', () =>
      toRequestBodiesV3({ requestBodies, context })
    ),
    headers: tracer(context.stackTrail, 'headers', () => toHeadersV3({ headers, context })),
    securitySchemes: tracer(context.stackTrail, 'securitySchemes', () =>
      toSecuritySchemesV3({ securitySchemes, context })
    ),
    extensionFields
  }

  return new OasComponents(fields)
}
