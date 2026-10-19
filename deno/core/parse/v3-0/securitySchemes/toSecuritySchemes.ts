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
  oasOAuth2FlowsData,
  oasOAuth2SecuritySchemeData,
  oasOpenIdSecuritySchemeData
} from '@/oas/securitySchemes/security-scheme-types.ts'
import type { OasSecurityScheme } from '@/oas/securitySchemes/SecurityScheme.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { isRef } from '@/helpers/refFns.ts'
import { tryParseAt } from '@/context/tryParseAt.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { toSpecificationExtensionsV3 } from '@/parse/v3-0/specificationExtensions/toSpecificationExtensionsV3.ts'
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

type LogSkippedKeysArgs = {
  value: object
  known: Record<string, unknown>
  parentType: string
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Log the keys of `value` that `known` does not name as skipped fields.
 * `v.parse` on a `v.object` schema strips unknown keys, so they are read
 * off the raw object. `x-` extensions are not logged.
 */
const logSkippedKeys = ({ value, known, parentType, stackTrail, context }: LogSkippedKeysArgs) => {
  const skipped = Object.fromEntries(
    Object.entries(value).filter(([key]) => !Object.hasOwn(known, key))
  )

  toSpecificationExtensionsV3({ skipped, parent: value, parentType, stackTrail, context })
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
      const { description, scheme, bearerFormat } = v.parse(
        oasHttpSecuritySchemeData,
        securityScheme
      )

      logSkippedKeys({
        value: securityScheme,
        known: oasHttpSecuritySchemeData.entries,
        parentType: 'securityScheme:http',
        stackTrail,
        context
      })

      return new OasHttpSecurityScheme({
        description,
        scheme,
        bearerFormat
      })
    }

    case 'apiKey': {
      const {
        in: location,
        description,
        name
      } = v.parse(oasApiKeySecuritySchemeData, securityScheme)

      logSkippedKeys({
        value: securityScheme,
        known: oasApiKeySecuritySchemeData.entries,
        parentType: 'securityScheme:apiKey',
        stackTrail,
        context
      })

      return new OasApiKeySecurityScheme({
        description,
        name,
        in: location
      })
    }

    case 'oauth2': {
      const { flows, description } = v.parse(oasOAuth2SecuritySchemeData, securityScheme)

      logSkippedKeys({
        value: securityScheme,
        known: oasOAuth2SecuritySchemeData.entries,
        parentType: 'securityScheme:oauth2',
        stackTrail,
        context
      })

      stackTrail.trace('flows', st =>
        logSkippedKeys({
          value: securityScheme.flows,
          known: oasOAuth2FlowsData.entries,
          parentType: 'oauthFlows',
          stackTrail: st,
          context
        })
      )

      return new OasOAuth2SecurityScheme({
        description,
        flows
      })
    }

    case 'openIdConnect': {
      const { description, openIdConnectUrl } = v.parse(oasOpenIdSecuritySchemeData, securityScheme)

      logSkippedKeys({
        value: securityScheme,
        known: oasOpenIdSecuritySchemeData.entries,
        parentType: 'securityScheme:openIdConnect',
        stackTrail,
        context
      })

      return new OasOpenIdSecurityScheme({
        description,
        openIdConnectUrl
      })
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
