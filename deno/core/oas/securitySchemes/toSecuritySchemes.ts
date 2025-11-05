import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
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
import { isRef } from '@/helpers/refFns.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToSecuritySchemesArgs = {
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
Record<string, OasSecurityScheme> | undefined => {
  if (!securitySchemes) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(securitySchemes).map(([key, value]) => {
      return [
        key,
        stackTrail.trace(key, st =>
          toSecuritySchemeV3({ securityScheme: value, stackTrail: st, context })
        )
      ]
    })
  ) as Record<string, OasSecurityScheme>
}

type ToSecuritySchemeV3Args = {
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

  return match(securityScheme)
    .with({ type: 'http' }, matched => {
      const {
        type: _type,
        description,
        scheme,
        bearerFormat,
        ...skipped
      } = v.parse(oasHttpSecuritySchemeData, matched)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: matched,
          stackTrail,
          parentType: 'securityScheme:http'
        })
      }
      return new OasHttpSecurityScheme({
        description,
        scheme,
        bearerFormat
      })
    })

    .with({ type: 'apiKey' }, matched => {
      const {
        type: _type,
        in: location,
        description,
        name,
        ...skipped
      } = v.parse(oasApiKeySecuritySchemeData, matched)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: matched,
          stackTrail,
          parentType: 'securityScheme:apiKey'
        })
      }

      return new OasApiKeySecurityScheme({
        description,
        name,
        in: location as 'header' | 'query' | 'cookie'
      })
    })
    .with({ type: 'oauth2' }, matched => {
      const {
        type: _type,
        flows,
        description,
        ...skipped
      } = v.parse(oasOAuth2SecuritySchemeData, matched)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: matched,
          stackTrail,
          parentType: 'securityScheme:oauth2'
        })
      }

      return new OasOAuth2SecurityScheme({
        description,
        flows
      })
    })
    .with({ type: 'openIdConnect' }, matched => {
      const {
        type: _type,
        description,
        openIdConnectUrl,
        ...skipped
      } = v.parse(oasOpenIdSecuritySchemeData, matched)

      if (!isEmpty(skipped)) {
        context.logSkippedFields({
          skipped,
          parent: matched,
          stackTrail,
          parentType: 'securityScheme:openIdConnect'
        })
      }

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
