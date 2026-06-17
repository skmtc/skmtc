import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import {
  OasHttpSecurityScheme,
  OasApiKeySecurityScheme,
  OasOAuth2SecurityScheme,
  OasOpenIdSecurityScheme
} from '@/oas/securitySchemes/SecurityScheme.ts'

import * as v from 'valibot'
import {
  oasApiKeySecuritySchemeData,
  oasHttpSecuritySchemeData,
  oasOAuth2SecuritySchemeData,
  oasOpenIdSecuritySchemeData
} from '@/oas/securitySchemes/security-scheme-types.ts'
import type { OasSecurityScheme } from '@/oas/securitySchemes/SecurityScheme.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { isRef } from '@/helpers/refFns.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToSecuritySchemesArgs = {
  securitySchemes:
    | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SecuritySchemeObject>
    | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toSecuritySchemesV3 = ({
  securitySchemes,
  stackTrail,
  context
}: ToSecuritySchemesArgs): // 'http' | 'apiKey' | 'oauth2' | 'openIdConnect'
Record<string, OasSecurityScheme | OasRef<'securityScheme'>> | undefined => {
  if (!securitySchemes) {
    return undefined
  }

  const output: Record<string, OasSecurityScheme | OasRef<'securityScheme'>> = {}

  for (const [key, value] of Object.entries(securitySchemes)) {
    // Isolate per scheme: a single malformed security scheme is logged and
    // skipped, the rest of the record continues (parity with toSchemasV3).
    const parsed = tryParseAt({
      stackTrail,
      key,
      context,
      type: 'INVALID_SECURITY_SCHEME',
      parent: value,
      fn: st => toSecuritySchemeV3({ securityScheme: value, stackTrail: st, context })
    })

    if (parsed !== undefined) {
      output[key] = parsed
    }
  }

  return output
}

export type ToSecuritySchemeV3Args = {
  securityScheme: OpenAPIV3.ReferenceObject | OpenAPIV3.SecuritySchemeObject
  stackTrail: StackTrail
  context: ParseContextType
}

const toSecuritySchemeV3 = ({
  securityScheme,
  stackTrail,
  context
}: ToSecuritySchemeV3Args):
  | OasHttpSecurityScheme
  | OasApiKeySecurityScheme
  | OasOAuth2SecurityScheme
  | OasOpenIdSecurityScheme
  | OasRef<'securityScheme'> => {
  if (isRef(securityScheme)) {
    return toRefV31({ ref: securityScheme, refType: 'securityScheme', stackTrail, context })
  }

  switch (securityScheme.type) {
    case 'http': {
      const {
        type: _type,
        description,
        scheme,
        bearerFormat,
        ...skipped
      } = v.parse(oasHttpSecuritySchemeData, securityScheme)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: securityScheme,
          stackTrail,
          parentType: 'securityScheme:http'
        })
      }
      return new OasHttpSecurityScheme({
        description,
        scheme,
        bearerFormat
      });
    }

    case 'apiKey': {
      const {
        type: _type,
        in: location,
        description,
        name,
        ...skipped
      } = v.parse(oasApiKeySecuritySchemeData, securityScheme)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: securityScheme,
          stackTrail,
          parentType: 'securityScheme:apiKey'
        })
      }

      return new OasApiKeySecurityScheme({
        description,
        name,
        in: location
      });
    }

    case 'oauth2': {
      const {
        type: _type,
        flows,
        description,
        ...skipped
      } = v.parse(oasOAuth2SecuritySchemeData, securityScheme)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: securityScheme,
          stackTrail,
          parentType: 'securityScheme:oauth2'
        })
      }

      return new OasOAuth2SecurityScheme({
        description,
        flows
      });
    }

    case 'openIdConnect': {
      const {
        type: _type,
        description,
        openIdConnectUrl,
        ...skipped
      } = v.parse(oasOpenIdSecuritySchemeData, securityScheme)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: securityScheme,
          stackTrail,
          parentType: 'securityScheme:openIdConnect'
        })
      }

      return new OasOpenIdSecurityScheme({
        description,
        openIdConnectUrl
      });
    }

    default: {
      // Exhaustive over the discriminated union: a value reaching here has a
      // `type` outside the OpenAPI set. `tryParseAt` isolates the throw to
      // this one scheme.
      const _exhaustiveCheck: never = securityScheme
      throw new Error(`Unknown security scheme type: ${JSON.stringify(_exhaustiveCheck)}`)
    }
  }
}
