import type { ParseContextType } from '@/context/parseTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { OasServer } from './Server.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServerVariablesV3 } from '../serverVariable/toServerVariableV3.ts'
import { tracer } from '@/helpers/tracer.ts'
type ToServersV3Args = {
  servers: OpenAPIV3.ServerObject[]
  context: ParseContextType
}

export const toServersV3 = ({ servers, context }: ToServersV3Args): OasServer[] => {
  return servers.map((server, index) => {
    return tracer(context.stackTrail, server.url ?? index, () => toServerV3({ server, context }))
  })
}

type ToOptionalServersV3Args = {
  servers: OpenAPIV3.ServerObject[] | undefined
  context: ParseContextType
}

export const toOptionalServersV3 = ({
  servers,
  context
}: ToOptionalServersV3Args): OasServer[] | undefined => {
  if (!servers) {
    return undefined
  }

  return toServersV3({ servers, context })
}

type ToServerV3Args = {
  server: OpenAPIV3.ServerObject
  context: ParseContextType
}

export const toServerV3 = ({ server, context }: ToServerV3Args): OasServer => {
  const { description, url, variables, ...skipped } = server

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: server,
    context,
    parentType: 'server'
  })

  return new OasServer({
    description,
    url,
    variables: toOptionalServerVariablesV3({ serverVariables: variables, context }),
    extensionFields
  })
}
