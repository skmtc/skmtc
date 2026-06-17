import type { OpenAPIV3 } from 'openapi-types'
import type { Method } from '../../types/Method.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toRequestBodyV3 } from '../requestBody/toRequestBodiesV3.ts'
import { toResponsesV3 } from '../response/toResponseV3.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasWebhook } from './Webhook.ts'
import { toPathItemV3 } from '../pathItem/toPathItemV3.ts'
import type { OasPathItem } from '../pathItem/PathItem.ts'
import { methodValues } from '../../types/Method.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toSecurityRequirementsV3 } from '../securityRequirement/toSecurityRequirement.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { toExternalDocs } from '../externalDocs/toExternalDocs.ts'
import { toOptionalServersV3 } from '../server/toServerV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * The 3.1 `webhooks` object: a map of webhook NAME → PathItem, identical
 * in shape to `paths` but keyed by name rather than URL path. Inline
 * PathItems only — a webhook PathItem `$ref` is a 3.1 edge case not yet
 * handled (see the arc note §5 Refs).
 */
export type WebhooksObject = Record<string, OpenAPIV3.PathItemObject>

type WebhookInfo = {
  method: Method
  name: string
  pathItem: OasPathItem | undefined
}

export type ToWebhookV3Args = {
  operation: OpenAPIV3.OperationObject
  webhookInfo: WebhookInfo
  stackTrail: StackTrail
  context: ParseContextType
}

type MethodObjects = {
  rest: OpenAPIV3.PathItemObject
  methodObject: Partial<Record<Method, OpenAPIV3.OperationObject>>
}

/**
 * Parses a single webhook Operation Object into an {@link OasWebhook}.
 *
 * Mirrors `toOperationV3` and reuses the same leaf field parsers
 * (`toParameterListV3` / `toRequestBodyV3` / `toResponsesV3` / …) — the
 * inner Operation Object is structurally identical. Only the orchestration
 * is duplicated (the dialect-shaped glue), and the output is an
 * `OasWebhook` carrying a `name`, not an `OasOperation` carrying a `path`.
 */
export const toWebhookV3 = ({
  operation,
  webhookInfo,
  stackTrail,
  context
}: ToWebhookV3Args): OasWebhook => {
  const { method, name, pathItem } = webhookInfo

  const {
    operationId,
    tags,
    summary,
    description,
    parameters,
    requestBody,
    responses,
    deprecated,
    security,
    externalDocs,
    servers,
    ...skipped
  } = operation

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: operation,
    context,
    stackTrail,
    parentType: 'operation'
  })

  const parsedParameters = stackTrail.trace('parameters', st =>
    toParameterListV3({ parameters, stackTrail: st, context })
  )
  const parsedRequestBody = stackTrail.trace('requestBody', st =>
    toRequestBodyV3({ requestBody, stackTrail: st, context })
  )
  const parsedResponses = stackTrail.trace('responses', st =>
    toResponsesV3({ responses, stackTrail: st, context })
  )
  const parsedSecurity = stackTrail.trace('security', st =>
    toSecurityRequirementsV3({ security, stackTrail: st, context })
  )
  const parsedExternalDocs = stackTrail.trace('externalDocs', st =>
    toExternalDocs({ externalDocs, stackTrail: st, context })
  )
  const parsedServers = stackTrail.trace('servers', st =>
    toOptionalServersV3({ servers, stackTrail: st, context })
  )

  return context.withStackTrail(stackTrail, () =>
    new OasWebhook(
      {
        pathItem,
        name,
        method,
        operationId,
        summary,
        tags,
        description,
        parameters: parsedParameters,
        requestBody: parsedRequestBody,
        responses: parsedResponses,
        deprecated,
        security: parsedSecurity,
        externalDocs: parsedExternalDocs,
        servers: parsedServers,
        extensionFields
      },
      context
    )
  )
}

export type ToWebhooksV3Args = {
  webhooks: WebhooksObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Flattens the 3.1 `webhooks` map into `OasWebhook[]`, mirroring
 * `toOperationsV3`'s `paths` → `OasOperation[]` flattening. Returns `[]`
 * when no `webhooks` object is present (the common 3.0 / no-webhook case).
 * The stack trail nests `webhooks` → `<name>` → `<method>` so
 * `OasDocument.removeItem` can locate a webhook by name.
 */
export const toWebhooksV3 = ({
  webhooks,
  stackTrail,
  context
}: ToWebhooksV3Args): OasWebhook[] => {
  if (!webhooks) {
    return []
  }

  return Object.entries(webhooks).flatMap(([name, pathItem]) => {
    return stackTrail.trace(name, nameStack => {
      if (!pathItem) {
        return []
      }

      const cleaned = Object.entries(pathItem).reduce<MethodObjects>(
        ({ rest, methodObject }, [key, operation]) => {
          const isMethod = methodValues.includes(key as Method)

          if (isMethod) {
            const { [key as Method]: _deleted, ...remaining } = rest

            return {
              rest: remaining,
              methodObject: {
                ...methodObject,
                [key as Method]: operation
              }
            }
          }

          return { rest, methodObject }
        },
        {
          rest: pathItem,
          methodObject: {}
        }
      )

      const pathItemObject = !isEmpty(cleaned.rest)
        ? toPathItemV3({ pathItem: cleaned.rest, stackTrail: nameStack, context })
        : undefined

      return Object.entries(cleaned.methodObject)
        .map(([method, operation]) => {
          // Use `nameStack` (the trail with the webhook name already
          // pushed) so downstream traces record webhooks:<name>:<method>:…
          // — the trail `OasDocument.removeItem` matches a webhook on.
          return nameStack.trace(method, st => {
            if (!operation) {
              return
            }

            try {
              return toWebhookV3({
                operation,
                webhookInfo: {
                  method: method as Method,
                  name,
                  pathItem: pathItemObject
                },
                stackTrail: st,
                context
              })
            } catch (error) {
              const normalized = error instanceof Error ? error : new Error(String(error))
              context.logIssue({
                key: method,
                parent: operation,
                level: 'error',
                message: normalized.message,
                cause: normalized,
                stackTrail: st,
                type: 'INVALID_OPERATION'
              })

              return undefined
            }
          })
        })
        .filter((item): item is OasWebhook => Boolean(item))
    })
  })
}
