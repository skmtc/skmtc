import type { GraphQLInterfaceType } from 'graphql'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { RefName } from '@/types/RefName.ts'
import { recordAppliedDirectives } from '@/gql/_helpers/recordAppliedDirectives.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToInterfaceUnionArgs = {
  interfaceType: GraphQLInterfaceType
  context: ParseContextType
  stackTrail: StackTrail
}

/**
 * Builds an `OasUnion` over the implementers of a GraphQL interface.
 *
 * The interface itself is registered separately as an `OasObject` (via
 * {@link toObjectType}) so generators that want to emit a base type/
 * interface can. The union returned here is a sibling registry entry
 * holding the discriminated union of concrete implementers — the
 * representation closer to what a typed client cares about at a usage
 * site.
 *
 * Each implementer ref records its consumer location via `registerRef`
 * so if an implementer type fails to parse the union's reference to it
 * can be pruned at the end of parsing.
 *
 * Per the v1 design decision, the parser emits both forms by default;
 * generators select whichever they prefer.
 */
export const toInterfaceUnion = ({
  interfaceType,
  context,
  stackTrail
}: ToInterfaceUnionArgs): OasUnion => {
  recordAppliedDirectives({ astNode: interfaceType.astNode, stackTrail, context })

  const implementers = context.schema.getImplementations(interfaceType).objects

  const members: OasRef<'schema'>[] = stackTrail.trace('members', membersStack =>
    implementers.map((impl, index) =>
      membersStack.trace(String(index), memberStack => {
        context.registerRef(memberStack.clone(), impl.name)
        return context.registry.createRef(impl.name as RefName, context.parsedDocument)
      })
    )
  )

  return new OasUnion({
    title: `${interfaceType.name}Union`,
    description: interfaceType.description ?? undefined,
    members,
    discriminator: new OasDiscriminator({ propertyName: '__typename' })
  })
}
