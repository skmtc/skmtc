import type { ASTNode, DirectiveNode } from 'graphql'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * Names of directives we don't bother reporting as dropped, either
 * because they're built-ins handled at the schema level or because we
 * already capture their semantics elsewhere (`@deprecated`'s reason
 * lifts onto the entity's `deprecationReason` field).
 */
const SUPPRESSED_DIRECTIVES = new Set(['skip', 'include', 'deprecated', 'specifiedBy', 'oneOf'])

export type RecordAppliedDirectivesArgs = {
  astNode: { directives?: ReadonlyArray<DirectiveNode> } | ASTNode | undefined | null
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Reads the `directives` array off any `astNode` and records each
 * non-suppressed directive as a `DROPPED_DIRECTIVE` warning on the
 * given context.
 *
 * Use this on object/input/interface/union types and their fields so
 * the user sees a precise location (e.g. `User.secret`) for any
 * applied directive the schema-driven pipeline can't represent.
 *
 * Works defensively: nodes from a `GraphQLSchema` built via
 * `buildSchema` always have ASTs, but the type allows `undefined` for
 * pure-runtime constructions, so we guard.
 */
export const recordAppliedDirectives = ({
  astNode,
  stackTrail,
  context
}: RecordAppliedDirectivesArgs): void => {
  const directives = astNode && 'directives' in astNode ? astNode.directives : undefined
  if (!directives || directives.length === 0) return

  const location = stackTrail.toString()
  for (const directive of directives) {
    const name = directive.name.value
    if (SUPPRESSED_DIRECTIVES.has(name)) continue
    context.log({
      level: 'warning',
      location,
      message: `Applied directive '@${name}' is not represented in generated output`,
      type: 'DROPPED_DIRECTIVE'
    })
  }
}
