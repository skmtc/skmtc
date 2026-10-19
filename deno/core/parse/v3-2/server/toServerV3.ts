import type { ParseContextType } from '@/context/parseTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { OasServer } from '@/oas/server/Server.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServerVariablesV3 } from '../serverVariable/toServerVariableV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/** A 3.2 Server Object: the 3.0 shape plus `name`. */
export type ServerObjectV32 = OpenAPIV3.ServerObject & { name?: string }

export type ToServersV3Args = {
  servers: ServerObjectV32[]
  stackTrail: StackTrail
  context: ParseContextType
}

export const toServersV3 = ({ servers, stackTrail, context }: ToServersV3Args): OasServer[] => {
  return servers.map((server, index) => {
    return stackTrail.trace(server.url ?? index, st =>
      toServerV3({ server, stackTrail: st, context })
    )
  })
}

export type ToOptionalServersV3Args = {
  servers: ServerObjectV32[] | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalServersV3 = ({
  servers,
  stackTrail,
  context
}: ToOptionalServersV3Args): OasServer[] | undefined => {
  if (!servers) {
    return undefined
  }

  return toServersV3({ servers, stackTrail, context })
}

export type ToServerV3Args = {
  server: ServerObjectV32
  stackTrail: StackTrail
  context: ParseContextType
}

export const toServerV3 = ({ server, stackTrail, context }: ToServerV3Args): OasServer => {
  const { description, name, url, variables, ...skipped } = server

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: server,
    context,
    stackTrail,
    parentType: 'server'
  })

  return new OasServer({
    description,
    name,
    url,
    variables: toOptionalServerVariablesV3({ serverVariables: variables, stackTrail, context }),
    extensionFields
  })
}
