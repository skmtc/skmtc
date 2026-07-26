import { isGeneratorSource } from '../shared/target.ts'
import {
  isTypeAccess,
  toDeclaredTypeText,
  toFunctionScopes,
  toInlineText,
  toStringLiteralValue
} from '../shared/nodes.ts'

/**
 * `skmtc/single-dispatch` — `schema.type` decides what renders a node in
 * exactly one place: the generator's `SchemaToValueFn` router.
 *
 * The one rule here with no counterpart in `packages/gen-eval` — the
 * harness gained an equivalent check (16) on the `feat/gen-eval-round-3`
 * branch, and it is the source this was written against. The doctrine is
 * the generation model's first axiom, so the rule text below and the hint
 * are the whole statement of it; there is no doc page to follow.
 *
 * A schema node becomes output through exactly two doors: `insertModel` /
 * `insertNormalizedModel` for named schemas, the router for everything
 * else. A `schema.type` conditional anywhere else is a third door — a
 * projection reserving a type for itself, a value class switching on
 * schema type while rendering — and it forks the mapping, so the same
 * node takes different paths depending on who touches it.
 *
 * Dispatch sites are classified by the enclosing function, exactly as the
 * round-3 check does (NOT by module path — a router module's other
 * functions are still outside the router):
 *
 * - **router** — inside `to<X>Value` / `schemaToValueFn`, or a function
 *   whose binding is annotated `SchemaToValueFn`. Sanctioned.
 * - **metadata** — inside `toIdentifierType` / `isSupported`. These
 *   decide what a node is *called* or whether it is handled, never what
 *   renders it. Sanctioned.
 * - **outside** — anywhere else. Reported.
 *
 * ## Deliberate narrowing vs the round-3 check
 *
 * That check counts any `switch (x.type)`. This rule additionally requires
 * at least one `case` testing a schema-type literal, so
 * `switch (node.type)` over an AST or manifest kind does not fire — which
 * removes two false positives it reports on `gen-md-docs`
 * (`switch (scheme.type)` over OpenAPI security-scheme kinds). The
 * comparison form carries that check's own guard: the literal must be one
 * of the schema `type` values.
 *
 * ## Known false negatives
 *
 * - Dispatch through `ts-pattern`'s `match(schema).with({ type: … })` is
 *   invisible (as it is to the round-3 check) — no `switch`, no comparison.
 * - Destructured dispatch (`const { type } = schema; if (type === 'object')`)
 *   is not matched: the comparison's left side is a plain identifier, and
 *   flagging bare `type === 'object'` would fire on unrelated code.
 * - A router named anything other than `to<X>Value` / `schemaToValueFn`
 *   and carrying no `SchemaToValueFn` annotation is unrecognised, so its
 *   own dispatch reports as outside. That is the round-3 check's limit
 *   too, and it is a false POSITIVE risk rather than a negative — see the
 *   rule text: name the router.
 * - The name gate cuts the other way as well: ANY function matching
 *   `to<X>Value` is sanctioned, so a helper named e.g. `toDefaultValue`
 *   or `toAnnotationsValue` could carry dispatch undetected. Reserve
 *   that naming shape for the router.
 * - `if`/`else if` chains and `switch` are both covered, but a
 *   `.type` comparison against a value held in a variable
 *   (`schema.type === wanted`) is not.
 */

const ROUTER_LABEL = /^to[A-Z]\w*Value$|^schemaToValueFn$/
const DISPATCH_METADATA_LABELS = new Set(['toIdentifierType', 'isSupported'])
const ROUTER_ANNOTATION = 'SchemaToValueFn'

const SCHEMA_TYPE_LITERALS = new Set([
  'string',
  'integer',
  'number',
  'boolean',
  'array',
  'object',
  'union',
  'unknown',
  'ref',
  'custom',
  'void',
  'null'
])

const HINT =
  'Route through the generator SchemaToValueFn router (to<X>Value) — it is the only place ' +
  'schema.type chooses what renders a node. A type needing different handling is a NEW router ' +
  'case returning a new snippet, and the per-type decisions (annotations, defaults) live inside ' +
  'that snippet and are exposed as value fields consumers read without narrowing.'

type DispatchContext = 'router' | 'metadata' | 'outside'

const toDispatchContext = (
  sourceCode: Deno.lint.SourceCode,
  node: Deno.lint.Node
): DispatchContext => {
  const scopes = toFunctionScopes(sourceCode, node)
  const isRouter = scopes.some(
    scope =>
      (scope.label !== undefined && ROUTER_LABEL.test(scope.label)) ||
      (toDeclaredTypeText(sourceCode, scope)?.includes(ROUTER_ANNOTATION) ?? false)
  )
  if (isRouter) return 'router'
  const isMetadata = scopes.some(
    scope => scope.label !== undefined && DISPATCH_METADATA_LABELS.has(scope.label)
  )
  return isMetadata ? 'metadata' : 'outside'
}

export const singleDispatch: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}
    const { sourceCode } = context

    const report = (node: Deno.lint.Node, description: string): void => {
      if (toDispatchContext(sourceCode, node) !== 'outside') return
      context.report({
        node,
        message: `${description} outside the router — mapping is decided in exactly one place`,
        hint: HINT
      })
    }

    return {
      SwitchStatement(node) {
        if (!isTypeAccess(node.discriminant)) return
        const dispatchesOnSchemaType = node.cases.some(switchCase => {
          const literal =
            switchCase.test === null ? undefined : toStringLiteralValue(switchCase.test)
          return literal !== undefined && SCHEMA_TYPE_LITERALS.has(literal)
        })
        if (!dispatchesOnSchemaType) return
        report(node, `switch (${toInlineText(sourceCode, node.discriminant)})`)
      },

      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') return
        const sides = [
          [node.left, node.right],
          [node.right, node.left]
        ] as const
        for (const [accessSide, literalSide] of sides) {
          const literal = toStringLiteralValue(literalSide)
          if (!isTypeAccess(accessSide) || literal === undefined) continue
          if (!SCHEMA_TYPE_LITERALS.has(literal)) continue
          report(node, toInlineText(sourceCode, node))
          return
        }
      }
    }
  }
}
