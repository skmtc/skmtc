import type { GraphQLUnionType } from 'graphql'
import { OasUnion } from '@/oas/union/Union.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import type { RefName } from '@/types/RefName.ts'
import type { GqlParseContext } from '@/gql/parse/GqlParseContext.ts'

export type ToUnionTypeArgs = {
  unionType: GraphQLUnionType
  context: GqlParseContext
}

/**
 * Converts a GraphQL union type into an `OasUnion` over refs to its
 * member types.
 *
 * GraphQL unions are always discriminated by `__typename` at the wire
 * level, so we record that discriminator on the union. Generators that
 * emit discriminated TS unions can read it; generators that don't care
 * about discrimination ignore it.
 */
export const toUnionType = ({ unionType, context }: ToUnionTypeArgs): OasUnion => {
  const members: OasRef<'schema'>[] = unionType
    .getTypes()
    .map(member => context.registry.createRef(member.name as RefName))

  return new OasUnion({
    title: unionType.name,
    description: unionType.description ?? undefined,
    members,
    discriminator: new OasDiscriminator({ propertyName: '__typename' })
  })
}
