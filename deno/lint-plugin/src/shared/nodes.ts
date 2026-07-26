/**
 * AST helpers shared by the rules. Deliberately small: each helper
 * answers one structural question about a `Deno.lint` node, in the same
 * terms the gen-eval fact pass (`packages/gen-eval/src/parse.ts`) uses,
 * so a rule reads as a report over facts rather than a tree walk.
 *
 * Two notes on the Deno lint AST that shape these helpers:
 *
 * - `node.parent` exists on every node EXCEPT `Program` and the comment
 *   nodes, so it cannot be read off the `Deno.lint.Node` union without a
 *   cast. `context.sourceCode.getAncestors(node)` returns the same chain
 *   (root first, excluding the node) as a typed array — that is the
 *   route every helper here takes.
 * - `TemplateElement` carries `raw`/`cooked`, but a template's emitted
 *   text is read with `sourceCode.getText(node)` to match the harness:
 *   an import statement broken across an interpolation
 *   (`import { ${name} } from '${path}'`) is only visible in the raw
 *   source text.
 */

/** A function-like node — the frames of the enclosing-scope chain. */
type FunctionLike =
  | Deno.lint.FunctionDeclaration
  | Deno.lint.FunctionExpression
  | Deno.lint.ArrowFunctionExpression

/**
 * One enclosing function, as the rules ask about it: the node that declares
 * it, and the name it is known by — a declaration's own name, the method or
 * object-property key it is assigned to, or the `const` it is bound to.
 */
export type FunctionScope = {
  declaredBy: Deno.lint.Node | undefined
  label: string | undefined
}

const isFunctionLike = (node: Deno.lint.Node): node is FunctionLike =>
  node.type === 'FunctionDeclaration' ||
  node.type === 'FunctionExpression' ||
  node.type === 'ArrowFunctionExpression'

/** The name of a non-computed object-property or class-member key. */
export const toKeyName = (key: Deno.lint.Node): string | undefined =>
  key.type === 'Identifier'
    ? key.name
    : key.type === 'Literal' && typeof key.value === 'string'
      ? key.value
      : undefined

const toFunctionLabel = (
  fn: FunctionLike,
  declaredBy: Deno.lint.Node | undefined
): string | undefined => {
  if (fn.type === 'FunctionDeclaration') return fn.id?.name
  if (declaredBy === undefined) return undefined
  if (declaredBy.type === 'MethodDefinition') return toKeyName(declaredBy.key)
  if (declaredBy.type === 'Property') return toKeyName(declaredBy.key)
  if (declaredBy.type === 'PropertyDefinition') return toKeyName(declaredBy.key)
  if (declaredBy.type === 'VariableDeclarator' && declaredBy.id.type === 'Identifier') {
    return declaredBy.id.name
  }
  return undefined
}

/**
 * The chain of functions enclosing `node`, outermost first. Mirrors the
 * `Frame[]` stack the gen-eval fact pass threads through its visit.
 */
export const toFunctionScopes = (
  sourceCode: Deno.lint.SourceCode,
  node: Deno.lint.Node
): FunctionScope[] => {
  const ancestors = sourceCode.getAncestors(node)
  return ancestors.flatMap((ancestor, index) =>
    isFunctionLike(ancestor)
      ? [
          {
            declaredBy: ancestors[index - 1],
            label: toFunctionLabel(ancestor, ancestors[index - 1])
          }
        ]
      : []
  )
}

/**
 * The declared type of the binding a function is assigned to, as source
 * text — how a router is recognised when it carries a `SchemaToValueFn`
 * annotation instead of a `to<X>Value` name.
 */
export const toDeclaredTypeText = (
  sourceCode: Deno.lint.SourceCode,
  scope: FunctionScope
): string | undefined => {
  const { declaredBy } = scope
  if (declaredBy === undefined) return undefined
  if (declaredBy.type === 'VariableDeclarator' && declaredBy.id.type === 'Identifier') {
    const annotation = declaredBy.id.typeAnnotation
    return annotation === undefined ? undefined : sourceCode.getText(annotation)
  }
  if (declaredBy.type === 'PropertyDefinition') {
    const annotation = declaredBy.typeAnnotation
    return annotation === undefined ? undefined : sourceCode.getText(annotation)
  }
  return undefined
}

/** True when any enclosing function is a `toString` body. */
export const isInsideToString = (sourceCode: Deno.lint.SourceCode, node: Deno.lint.Node): boolean =>
  toFunctionScopes(sourceCode, node).some(scope => scope.label === 'toString')

/**
 * The expression inside an optional chain. `body?.type === 'object'` parses
 * as `ChainExpression(MemberExpression)`, so a rule matching member access
 * has to look through the wrapper or it silently misses every
 * optional-chained read.
 */
const unwrapChain = (node: Deno.lint.Node): Deno.lint.Node =>
  node.type === 'ChainExpression' ? unwrapChain(node.expression) : node

/** `this`, `this.a`, `this.a.b[0]` — anything rooted at `this`. */
export const isThisRooted = (expression: Deno.lint.Expression): boolean =>
  expression.type === 'ThisExpression' ||
  (expression.type === 'ChainExpression' && isThisRooted(expression.expression)) ||
  (expression.type === 'MemberExpression' && isThisRooted(expression.object))

/**
 * The called name: `f()` -> `f`, `x.f()` -> `f`. Property access through
 * a computed key has no name.
 */
export const toCalleeName = (callee: Deno.lint.Expression): string | undefined =>
  callee.type === 'Identifier'
    ? callee.name
    : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
      ? callee.property.name
      : undefined

/** The string value of a string literal, when the node is one. */
export const toStringLiteralValue = (node: Deno.lint.Node): string | undefined =>
  node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined

/**
 * A node's source text, collapsed to one line and truncated — the form
 * every message quotes it in. Diagnostic messages MUST stay single-line:
 * `deno lint --json` does not escape control characters, so a newline
 * inside a message makes the whole report unparseable.
 */
export const toInlineText = (
  sourceCode: Deno.lint.SourceCode,
  node: Deno.lint.Node,
  limit = 60
): string => {
  const text = sourceCode.getText(node).replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

/**
 * A member access ending in `.type` — `schema.type`, `args.schema.type`,
 * `body?.type`.
 */
export const isTypeAccess = (node: Deno.lint.Node): boolean => {
  const access = unwrapChain(node)
  return (
    access.type === 'MemberExpression' &&
    !access.computed &&
    access.property.type === 'Identifier' &&
    access.property.name === 'type'
  )
}
