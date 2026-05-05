import type { GraphQLInterfaceType, GraphQLSchema } from 'graphql'
import { OasUnion } from '@/oas/union/Union.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import type { RefName } from '@/types/RefName.ts'

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
export const toInterfaceUnion = (
  iface: GraphQLInterfaceType,
  schema: GraphQLSchema,
  registry: GqlRegistry
): OasUnion => {
  const implementers = schema.getImplementations(iface).objects

  const members: OasRef<'schema'>[] = implementers.map(impl =>
    registry.createRef(impl.name as RefName)
  )

  return new OasUnion({
    title: `${iface.name}Union`,
    description: iface.description ?? undefined,
    members,
    discriminator: new OasDiscriminator({ propertyName: '__typename' })
  })
}
