import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { match } from 'ts-pattern'
import {
  OasHttpSecurityScheme,
  OasApiKeySecurityScheme,
  OasOAuth2SecurityScheme,
  OasOpenIdSecurityScheme
} from './SecurityScheme.ts'

import * as v from 'valibot'
import {
  oasApiKeySecuritySchemeData,
  oasHttpSecuritySchemeData,
  oasOAuth2SecuritySchemeData,
  oasOpenIdSecuritySchemeData
} from './security-scheme-types.ts'
import type { OasSecurityScheme } from './SecurityScheme.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import type { OasRef } from '../ref/Ref.ts'
import { isRef } from '../../helpers/isRef.ts'

type ToSecuritySchemesArgs = {
  securitySchemes:
    | Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SecuritySchemeObject>
    | undefined
  context: ParseContext
}

export const toSecuritySchemesV3 = ({
  securitySchemes,
  context
}: ToSecuritySchemesArgs): // 'http' | 'apiKey' | 'oauth2' | 'openIdConnect'
Record<string, OasSecurityScheme> | undefined => {
  if (!securitySchemes) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(securitySchemes).map(([key, value]) => {
      return [key, context.trace(key, () => toSecuritySchemeV3({ securityScheme: value, context }))]
    })
  ) as Record<string, OasSecurityScheme>
}

type ToSecuritySchemeV3Args = {
  securityScheme: OpenAPIV3.ReferenceObject | OpenAPIV3.SecuritySchemeObject
  context: ParseContext
}

const toSecuritySchemeV3 = ({
  securityScheme,
  context
}: ToSecuritySchemeV3Args):
  | OasHttpSecurityScheme
  | OasApiKeySecurityScheme
  | OasOAuth2SecurityScheme
  | OasOpenIdSecurityScheme
  | OasRef<'securityScheme'> => {
  if (isRef(securityScheme)) {
    return toRefV31({ ref: securityScheme, refType: 'securityScheme', context })
  }

  return match(securityScheme)
    .with({ type: 'http' }, matched => {
      const { description, scheme, bearerFormat, ...skipped } = v.parse(
        oasHttpSecuritySchemeData,
        matched
      )

      context.logSkippedFields(skipped)

      return new OasHttpSecurityScheme({
        description,
        scheme,
        bearerFormat
      })
    })

    .with({ type: 'apiKey' }, matched => {
      const {
        in: location,
        description,
        name,
        ...skipped
      } = v.parse(oasApiKeySecuritySchemeData, matched)

      context.logSkippedFields(skipped)

      return new OasApiKeySecurityScheme({
        description,
        name,
        in: location as 'header' | 'query' | 'cookie'
      })
    })
    .with({ type: 'oauth2' }, matched => {
      const { flows, description, ...skipped } = v.parse(oasOAuth2SecuritySchemeData, matched)

      context.logSkippedFields(skipped)

      return new OasOAuth2SecurityScheme({
        description,
        flows
      })
    })
    .with({ type: 'openIdConnect' }, matched => {
      const { description, openIdConnectUrl, ...skipped } = v.parse(
        oasOpenIdSecuritySchemeData,
        matched
      )

      context.logSkippedFields(skipped)

      return new OasOpenIdSecurityScheme({
        description,
        openIdConnectUrl
      })
    })
    .otherwise(other => {
      // TODO: skip ref
      throw new Error(`Unknown security scheme type: ${other}`)
    })
}
