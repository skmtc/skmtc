import type { OpenAPIV3 } from 'openapi-types'
import type { Method } from '../../types/Method.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toRequestBodyV3 } from '../requestBody/toRequestBodiesV3.ts'
import { toResponsesV3 } from '../response/toResponseV3.ts'
import { toParameterListV3 } from '../parameter/toParameterV3.ts'
import { OasOperation } from './Operation.ts'
import { toPathItemV3 } from '../pathItem/toPathItemV3.ts'
import type { OasPathItem } from '../pathItem/PathItem.ts'
import { methodValues } from '../../types/Method.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toSecurityRequirementsV3 } from '../securityRequirement/toSecurityRequirement.ts'
type OperationInfo = {
  method: Method
  path: string
  pathItem: OasPathItem
}

type ToOperationV3Args = {
  operation: OpenAPIV3.OperationObject
  operationInfo: OperationInfo
  context: ParseContext
}

type MethodObjects = {
  rest: OpenAPIV3.PathItemObject
  methodObject: Partial<Record<Method, OpenAPIV3.OperationObject>>
}

export const toOperationV3 = ({
  operation,
  operationInfo,
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
    ...skipped
  } = operation

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: operation,
    context,
    parentType: 'operation'
  })

  return new OasOperation({
    pathItem,
    path,
    method,
    operationId,
    summary,
    tags,
    description,
    parameters: context.trace('parameters', () => toParameterListV3({ parameters, context })),
    requestBody: context.trace('requestBody', () => toRequestBodyV3({ requestBody, context })),
    responses: context.trace('responses', () => toResponsesV3({ responses, context })),
    deprecated,
    security: context.trace('security', () => toSecurityRequirementsV3({ security, context })),
    extensionFields
  })
}

type ToOperationsV3Args = {
  paths: OpenAPIV3.PathsObject
  context: ParseContext
}

export const toOperationsV3 = ({ paths, context }: ToOperationsV3Args): OasOperation[] => {
  return Object.entries(paths).flatMap(([path, pathItem]) => {
    return context.trace(path, () => {
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

      const pathItemObject = toPathItemV3({ pathItem: cleaned.rest, context })

      return Object.entries(cleaned.methodObject)
        .map(([method, operation]) => {
          return context.trace(method, () => {
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
                context
              })
            } catch (error) {
              console.log('ERROR IN OPERATION', error)

              context.logWarning({
                key: method,
                message: error instanceof Error ? error.message : 'Failed to parse operation',
                parent: operation,
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
