import type { GraphQLInterfaceType } from 'graphql'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { RefName } from '@/types/RefName.ts'
import { recordAppliedDirectives } from '@/parsers/graphql/recordAppliedDirectives.ts'
import type { ParseContext } from '@/context/ParseContext.ts'

export type ToInterfaceUnionArgs = {
  interfaceType: GraphQLInterfaceType
  context: ParseContext
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
 * Per the v1 design decision, the parser emits both forms by default;
 * generators select whichever they prefer.
 */
export const toInterfaceUnion = ({ interfaceType, context }: ToInterfaceUnionArgs): OasUnion => {
  recordAppliedDirectives(interfaceType.astNode, interfaceType.name, context)

  const implementers = context.schema.getImplementations(interfaceType).objects

  const members: OasRef<'schema'>[] = implementers.map(impl =>
    context.registry.createRef(impl.name as RefName)
  )

  return new OasUnion({
    title: `${interfaceType.name}Union`,
    description: interfaceType.description ?? undefined,
    members,
    discriminator: new OasDiscriminator({ propertyName: '__typename' })
  })
}
