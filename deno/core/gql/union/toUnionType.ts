import type { GraphQLUnionType } from 'graphql'
import { OasUnion } from '@/oas/union/Union.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import type { RefName } from '@/types/RefName.ts'
import { recordAppliedDirectives } from '@/gql/_helpers/recordAppliedDirectives.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToUnionTypeArgs = {
  unionType: GraphQLUnionType
  context: ParseContextType
  stackTrail: StackTrail
}

/**
 * Converts a GraphQL union type into an `OasUnion` over refs to its
 * member types.
 *
 * GraphQL unions are always discriminated by `__typename` at the wire
 * level, so we record that discriminator on the union. Generators that
 * emit discriminated TS unions can read it; generators that don't care
 * about discrimination ignore it.
 *
 * Each member ref records the consumer location via `registerRef` so
 * if a member type fails to parse, the union's reference to it can be
 * pruned at the end of parsing.
 */
export const toUnionType = ({
  unionType,
  context,
  stackTrail
}: ToUnionTypeArgs): OasUnion => {
  recordAppliedDirectives({ astNode: unionType.astNode, stackTrail, context })

  const members: OasRef<'schema'>[] = stackTrail.trace('members', membersStack =>
    unionType.getTypes().map((member, index) =>
      membersStack.trace(String(index), memberStack => {
        context.registerRef(memberStack.clone(), member.name)
        return context.registry.createRef(member.name as RefName, context)
      })
    )
  )

  return new OasUnion({
    title: unionType.name,
    description: unionType.description ?? undefined,
    members,
    discriminator: new OasDiscriminator({ propertyName: '__typename' })
  })
}
