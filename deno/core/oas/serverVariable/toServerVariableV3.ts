import type { ParseContext } from '../../context/ParseContext.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { OasServerVariable } from './ServerVariable.ts'

type ToServerVariablesV3Args = {
  serverVariables: Record<string, OpenAPIV3.ServerVariableObject>
  context: ParseContext
}

export const toServerVariablesV3 = ({
  serverVariables,
  context
}: ToServerVariablesV3Args): Record<string, OasServerVariable> => {
  return Object.fromEntries(
    Object.entries(serverVariables).map(([key, serverVariable]) => [
      key,
      toServerVariableV3({ serverVariable, context })
    ])
  )
}

type ToOptionalServerVariablesV3Args = {
  serverVariables: Record<string, OpenAPIV3.ServerVariableObject> | undefined
  context: ParseContext
}

export const toOptionalServerVariablesV3 = ({
  serverVariables,
  context
}: ToOptionalServerVariablesV3Args): Record<string, OasServerVariable> | undefined => {
  if (!serverVariables) {
    return undefined
  }

  return toServerVariablesV3({ serverVariables, context })
}

type ToServerVariableV3Args = {
  serverVariable: OpenAPIV3.ServerVariableObject
  context: ParseContext
}

export const toServerVariableV3 = ({
  serverVariable,
  context
}: ToServerVariableV3Args): OasServerVariable => {
  const { description, default: defaultValue, enum: enums, ...skipped } = serverVariable

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: serverVariable,
    context,
    parentType: 'serverVariable'
  })

  return new OasServerVariable({
    description,
    default: defaultValue,
    enums,
    extensionFields
  })
}
