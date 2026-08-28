import { toOptionalResponsesV3 } from '../response/toResponseV3.ts'
import { toHeadersV3 } from '../header/toHeadersV3.ts'
import { toLinksV3 } from '../link/toLinksV3.ts'
import { toOptionalSchemasV3 } from '../schema/toSchemasV3.ts'
import { toOptionalParametersV3 } from '../parameter/toParameterV3.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRequestBodiesV3 } from '../requestBody/toRequestBodiesV3.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import type { ComponentsFields } from '@/oas/components/Components.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toSecuritySchemesV3 } from '../securitySchemes/toSecuritySchemes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToComponentsV3Args = {
  components: OpenAPIV3.ComponentsObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toComponentsV3 = ({
  components,
  stackTrail,
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
    links,
    ...skipped
  } = components

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: components,
    context,
    stackTrail,
    parentType: 'components'
  })

  const fields: ComponentsFields = {
    schemas: stackTrail.trace('schemas', st =>
      toOptionalSchemasV3({ schemas, stackTrail: st, context })
    ),
    responses: stackTrail.trace('responses', st =>
      toOptionalResponsesV3({ responses, stackTrail: st, context })
    ),
    parameters: stackTrail.trace('parameters', st =>
      toOptionalParametersV3({ parameters, stackTrail: st, context })
    ),
    examples: toExamplesV3({
      examples,
      example: undefined,
      exampleKey: 'TEMP',
      stackTrail,
      context
    }),
    requestBodies: stackTrail.trace('requestBodies', st =>
      toRequestBodiesV3({ requestBodies, stackTrail: st, context })
    ),
    headers: stackTrail.trace('headers', st => toHeadersV3({ headers, stackTrail: st, context })),
    securitySchemes: stackTrail.trace('securitySchemes', st =>
      toSecuritySchemesV3({ securitySchemes, stackTrail: st, context })
    ),
    links: stackTrail.trace('links', st => toLinksV3({ links, stackTrail: st, context })),
    extensionFields
  }

  return new OasComponents(fields)
}
