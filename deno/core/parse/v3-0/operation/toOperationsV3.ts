import type { OpenAPIV3 } from 'openapi-types'
import type { Method } from '@/types/Method.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { toRequestBodyV3 } from '../requestBody/toRequestBodiesV3.ts'
import { toResponsesV3 } from '../response/toResponseV3.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { toPathItemV3 } from '../pathItem/toPathItemV3.ts'
import type { OasPathItem } from '@/oas/pathItem/PathItem.ts'
import { methodValues } from '@/types/Method.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toSecurityRequirementsV3 } from '../securityRequirement/toSecurityRequirement.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import { toExternalDocs } from '../externalDocs/toExternalDocs.ts'
import { toOptionalServersV3 } from '../server/toServerV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

type OperationInfo = {
  method: Method
  path: string
  pathItem: OasPathItem | undefined
}

export type ToOperationV3Args = {
  operation: OpenAPIV3.OperationObject
  operationInfo: OperationInfo
  stackTrail: StackTrail
  context: ParseContextType
}

type MethodObjects = {
  rest: OpenAPIV3.PathItemObject
  methodObject: Partial<Record<Method, OpenAPIV3.OperationObject>>
}

export const toOperationV3 = ({
  operation,
  operationInfo,
  stackTrail,
  context
}: ToOperationV3Args): OasOperation => {
  const { method, path, pathItem } = operationInfo

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
    // Callbacks are a deliberate non-goal (no out-of-band callback codegen).
    // Pull it out so it is dropped silently instead of warned as an
    // unexpected property on every operation that declares one.
    callbacks: _callbacks,
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
    new OasOperation(
      {
        pathItem,
        path,
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

export type ToOperationsV3Args = {
  paths: OpenAPIV3.PathsObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOperationsV3 = ({
  paths,
  stackTrail,
  context
}: ToOperationsV3Args): OasOperation[] => {
  return Object.entries(paths).flatMap(([path, pathItem]) => {
    return stackTrail.trace(path, pathStack => {
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
        ? toPathItemV3({ pathItem: cleaned.rest, stackTrail: pathStack, context })
        : undefined

      return Object.entries(cleaned.methodObject)
        .map(([method, operation]) => {
          // Use `pathStack` (the trail with `path` already pushed),
          // not the outer `stackTrail` — otherwise downstream traces
          // record paths:<method>:... and lose the actual path
          // segment, which breaks `OasDocument.removeItem` and the
          // dependency-ref invalidation it backs.
          return pathStack.trace(method, st => {
            if (!operation) {
              return
            }

            try {
              return toOperationV3({
                operation,
                operationInfo: {
                  method: method as Method,
                  path,
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
        .filter((item): item is OasOperation => Boolean(item))
    })
  })
}
