import { toOptionalResponsesV3 } from '../response/toResponseV3.js'
import { toHeadersV3 } from '../header/toHeadersV3.js'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.js'
import { toOptionalParametersV3 } from '../parameter/toParameterV3.js'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { toExamplesV3 } from '../example/toExamplesV3.js'
import { toRequestBodiesV3 } from '../requestBody/toRequestBodiesV3.js'
import { OasComponents } from './Components.js'
import type { ComponentsFields } from './Components.js'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js'

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
  const { schemas, responses, parameters, examples, requestBodies, headers, ...skipped } =
    components

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  const fields: ComponentsFields = {
    schemas: context.trace('schemas', () =>
      toOptionalSchemasV3({ schemas, context, childOfComponents: true })
    ),
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
    extensionFields
  }

  return new OasComponents(fields)
}
