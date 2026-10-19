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
import { toSpecificationExtensionsV3 } from '@/parse/v3-2/specificationExtensions/toSpecificationExtensionsV3.ts'

// The shared schemas are the 3.0/3.1 shape; these add the 3.2 fields.
const deprecated = v.optional(v.boolean())

const httpSecuritySchemeData = v.object({ ...oasHttpSecuritySchemeData.entries, deprecated })

const apiKeySecuritySchemeData = v.object({ ...oasApiKeySecuritySchemeData.entries, deprecated })

const deviceAuthorizationOAuth2FlowData = v.object({
  deviceAuthorizationUrl: v.string(),
  tokenUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.optional(v.record(v.string(), v.string()))
})

const oAuth2FlowsData = v.object({
  ...oasOAuth2FlowsData.entries,
  deviceAuthorization: v.optional(deviceAuthorizationOAuth2FlowData)
})

const oAuth2SecuritySchemeData = v.object({
  ...oasOAuth2SecuritySchemeData.entries,
  deprecated,
  oauth2MetadataUrl: v.optional(v.string()),
  flows: oAuth2FlowsData
})

const openIdSecuritySchemeData = v.object({ ...oasOpenIdSecuritySchemeData.entries, deprecated })

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
      const { description, deprecated, scheme, bearerFormat } = v.parse(
        httpSecuritySchemeData,
        securityScheme
      )

      logSkippedKeys({
        value: securityScheme,
        known: httpSecuritySchemeData.entries,
        parentType: 'securityScheme:http',
        stackTrail,
        context
      })

      return new OasHttpSecurityScheme({
        description,
        deprecated,
        scheme,
        bearerFormat
      })
    }

    case 'apiKey': {
      const {
        in: location,
        description,
        deprecated,
        name
      } = v.parse(apiKeySecuritySchemeData, securityScheme)

      logSkippedKeys({
        value: securityScheme,
        known: apiKeySecuritySchemeData.entries,
        parentType: 'securityScheme:apiKey',
        stackTrail,
        context
      })

      return new OasApiKeySecurityScheme({
        description,
        deprecated,
        name,
        in: location
      })
    }

    case 'oauth2': {
      const { flows, description, deprecated, oauth2MetadataUrl } = v.parse(
        oAuth2SecuritySchemeData,
        securityScheme
      )

      logSkippedKeys({
        value: securityScheme,
        known: oAuth2SecuritySchemeData.entries,
        parentType: 'securityScheme:oauth2',
        stackTrail,
        context
      })

      stackTrail.trace('flows', st =>
        logSkippedKeys({
          value: securityScheme.flows,
          known: oAuth2FlowsData.entries,
          parentType: 'oauthFlows',
          stackTrail: st,
          context
        })
      )

      return new OasOAuth2SecurityScheme({
        description,
        deprecated,
        oauth2MetadataUrl,
        flows
      })
    }

    case 'openIdConnect': {
      const { description, deprecated, openIdConnectUrl } = v.parse(
        openIdSecuritySchemeData,
        securityScheme
      )

      logSkippedKeys({
        value: securityScheme,
        known: openIdSecuritySchemeData.entries,
        parentType: 'securityScheme:openIdConnect',
        stackTrail,
        context
      })

      return new OasOpenIdSecurityScheme({
        description,
        deprecated,
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
