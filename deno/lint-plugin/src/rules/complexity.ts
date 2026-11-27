import { toInlineText } from '../shared/nodes.ts'
import { isGeneratorSource } from '../shared/target.ts'

/**
 * `skmtc/complexity` — each function of a generator has a cyclomatic
 * complexity of 10 or less.
 *
 * A generator renders what the parser gives it: a producer stores the parts
 * of one piece of output in its constructor, and `toString()` arranges
 * them. Code in that shape has few branches. A function with many is doing
 * something else: it inspects or rewrites a schema, which is the parser's
 * work, or it holds two concepts that are two producers. The count finds
 * that function before a review does.
 *
 * The score of a unit is 1, plus one for each `if`, loop, `case`, `catch`,
 * `?:`, `&&`, `||`, `??`, `&&=`, `||=` and `??=`. This is the count of
 * `scripts/complexity.ts` in the `skmtc-generator` skill, and
 * `complexity.test.ts` holds the two to the same result.
 *
 * - A **unit** is a named function: a declaration, a method, a constructor,
 *   an accessor, or a function that a variable or a property holds. A
 *   callback written inline counts toward the unit around it. A method, a
 *   getter and a setter start at the member, so a branch in a decorator or
 *   in a computed key counts too.
 * - With no unit around it, a function with no name is a unit too
 *   (`<default>` for `export default`, `<anonymous>` otherwise), and so is
 *   the value of a class field or of a variable.
 * - A **router** is a unit in which more than half of the branches are the
 *   cases of a `switch`. Its cases do not count toward the limit, and its
 *   other branches do.
 *
 * `deno lint` gives a plugin rule no options, so the limit is fixed. To
 * sign off one function, put `// deno-lint-ignore skmtc/complexity` and
 * the reason above it. To drop the rule, list it in `lint.rules.exclude`.
 *
 * The report is at the name of the unit, not at the function. `deno lint`
 * matches a directive to the line where the report starts, and the function
 * of `const toValue =\n  (schema) => …` starts one line below its name.
 *
 * The rule reads generator source only ({@link isGeneratorSource}): not a
 * test, and not a file under a folder such as `examples/`, `fixtures/` or
 * `scripts/` (`shared/target.ts` has the list). The script reads each `.ts`
 * file under the folder it is given, tests and `.d.ts` files left out. So a
 * file under `src/examples/` is in the script's count only, and a `mod.ts`
 * beside `src/` is in the rule's count only.
 *
 * ## Known false negatives
 *
 * - A branch at the top level of a module, outside a function and outside
 *   the value of a variable (`if (import.meta.main) { … }`), is in no unit.
 * - Dispatch through `ts-pattern` (`match(x).with(…)`) is calls, not
 *   branches, so it scores nothing.
 * - Optional chaining (`a?.b`) is not counted.
 */

type Unit = {
  name: string
  score: number
  cases: number
  /** The node the report goes to. */
  at: Deno.lint.Node
}

/** Where a unit's report goes, and the unit's name. */
type UnitStart = {
  name: string
  /** The name of the unit in the source, or the function when it has none. */
  at: Deno.lint.Node
}

/** The node that starts a unit, with its name and the place of its report. */
type Owner = UnitStart & {
  node: Deno.lint.Node
}

type RuleOptions = {
  limit: number
}

type FunctionLike =
  | Deno.lint.FunctionDeclaration
  | Deno.lint.FunctionExpression
  | Deno.lint.ArrowFunctionExpression

/**
 * A class field. `accessor name = …` is an `AccessorProperty` node, which
 * the `Deno.lint.Node` union leaves out, so it is read as a
 * `PropertyDefinition`: the count reads `key`, `computed` and `value`, and
 * the two nodes both have them.
 */
type Field = Deno.lint.PropertyDefinition

type Initializer = Deno.lint.VariableDeclarator | Field

/** A method, a getter or a setter, of a class or of an object. */
type Member = Deno.lint.MethodDefinition | Deno.lint.Property

type Keyed = Member | Field

export const COMPLEXITY_LIMIT = 10

const LOGICAL_ASSIGNMENTS = new Set(['&&=', '||=', '??='])

const HINT =
  'A function over the limit holds more than one concept. Give each concept its own producer ' +
  'class, or one plain class that reads the document for several producers, and choose ' +
  'between kinds in one place. Split by concept, not by line count. A function that inspects ' +
  'or rewrites a schema does the work of the parser. The cases of a router switch do not count.'

const isFunctionLike = (node: Deno.lint.Node): node is FunctionLike =>
  node.type === 'FunctionDeclaration' ||
  node.type === 'FunctionExpression' ||
  node.type === 'ArrowFunctionExpression'

const FIELD_TYPES = new Set<string>(['PropertyDefinition', 'AccessorProperty'])

const isField = (node: Deno.lint.Node): node is Field => FIELD_TYPES.has(node.type)

/** A variable or a class field whose value is not a function. */
const isInitializer = (node: Deno.lint.Node): node is Initializer => {
  if (node.type === 'VariableDeclarator') {
    return node.init !== null && !isFunctionLike(node.init)
  }

  return isField(node) && node.value !== null && !isFunctionLike(node.value)
}

const isMember = (node: Deno.lint.Node): node is Member =>
  node.type === 'MethodDefinition' ||
  (node.type === 'Property' && (node.method || node.kind !== 'init'))

/** The function of a member. It is in the unit that the member started. */
const isMemberFunction = (node: Deno.lint.Node, parent: Deno.lint.Node | undefined): boolean =>
  isFunctionLike(node) && parent !== undefined && isMember(parent)

const isClass = (
  node: Deno.lint.Node
): node is Deno.lint.ClassDeclaration | Deno.lint.ClassExpression =>
  node.type === 'ClassDeclaration' || node.type === 'ClassExpression'

/** The name of the innermost class among `ancestors`. */
const toClassName = (ancestors: Deno.lint.Node[]): string =>
  ancestors.findLast(isClass)?.id?.name ?? '<class>'

/**
 * Whether a key is written in brackets. The parser leaves `computed` false
 * on a method (`[key]() {}`), so the source decides for it: only a computed
 * key comes straight after a `[`.
 */
const isComputedKey = (sourceCode: Deno.lint.SourceCode, { key, computed }: Keyed): boolean =>
  computed || sourceCode.getText().slice(0, key.range[0]).trimEnd().endsWith('[')

/**
 * A key as the source writes it, on one line: `name`, `#name`,
 * `'quoted-key'`, `[computed]`. The script names a unit the same way.
 */
const toKeyText = (sourceCode: Deno.lint.SourceCode, keyed: Keyed): string => {
  const text = toInlineText(sourceCode, keyed.key)

  return isComputedKey(sourceCode, keyed) ? `[${text}]` : text
}

/** The name of a variable. A pattern is quoted on one line, without its type. */
const toVariableName = (
  sourceCode: Deno.lint.SourceCode,
  { id }: Deno.lint.VariableDeclarator
): string => (id.type === 'Identifier' ? id.name : toInlineText(sourceCode, id))

/**
 * The name of what holds a function or a value: a class member with its
 * class, an object property by its key, a variable by its name.
 * `ancestors` are the nodes above `holder`.
 */
const toHolderName = (
  sourceCode: Deno.lint.SourceCode,
  holder: Deno.lint.Node,
  ancestors: Deno.lint.Node[]
): string | undefined => {
  if (holder.type === 'MethodDefinition' || isField(holder)) {
    return `${toClassName(ancestors)}.${toKeyText(sourceCode, holder)}`
  }

  if (holder.type === 'Property') {
    return toKeyText(sourceCode, holder)
  }

  if (holder.type === 'VariableDeclarator') {
    return toVariableName(sourceCode, holder)
  }

  return holder.type === 'ExportDefaultDeclaration' ? '<default>' : undefined
}

/** The node that names what `holder` holds: a key, or the name of a variable. */
const toNameNode = (holder: Deno.lint.Node): Deno.lint.Node => {
  if (holder.type === 'VariableDeclarator') {
    return holder.id
  }

  return holder.type === 'MethodDefinition' || holder.type === 'Property' || isField(holder)
    ? holder.key
    : holder
}

/** The unit that `holder` names, or `undefined` when it names none. */
const toHeldStart = (
  sourceCode: Deno.lint.SourceCode,
  holder: Deno.lint.Node,
  ancestors: Deno.lint.Node[]
): UnitStart | undefined => {
  const name = toHolderName(sourceCode, holder, ancestors)

  return name === undefined ? undefined : { name, at: toNameNode(holder) }
}

/** The unit of a function, or `undefined` for a callback written inline. */
const toFunctionStart = (
  sourceCode: Deno.lint.SourceCode,
  fn: FunctionLike,
  ancestors: Deno.lint.Node[]
): UnitStart | undefined => {
  if (fn.type === 'FunctionDeclaration') {
    return { name: fn.id?.name ?? '<default>', at: fn.id ?? fn }
  }

  const holder = ancestors.at(-1)

  return holder === undefined ? undefined : toHeldStart(sourceCode, holder, ancestors.slice(0, -1))
}

/**
 * The unit that starts at `node`, or `undefined` when the node belongs to
 * the unit around it. `ancestors` are the nodes above `node`.
 */
const toUnitStart = (
  sourceCode: Deno.lint.SourceCode,
  node: Deno.lint.Node,
  ancestors: Deno.lint.Node[],
  inUnit: boolean
): UnitStart | undefined => {
  if (isMember(node)) {
    return toHeldStart(sourceCode, node, ancestors)
  }

  if (isMemberFunction(node, ancestors.at(-1))) {
    return undefined
  }

  if (isFunctionLike(node)) {
    return (
      toFunctionStart(sourceCode, node, ancestors) ??
      (inUnit ? undefined : { name: '<anonymous>', at: node })
    )
  }

  return !inUnit && isInitializer(node) ? toHeldStart(sourceCode, node, ancestors) : undefined
}

/** A router: more than half of its branches are the cases of a `switch`. */
const isSwitch = (unit: Unit): boolean => unit.cases * 2 > unit.score - 1

/** The score that the limit applies to. The cases of a router do not count. */
const toLimitedScore = (unit: Unit): number =>
  isSwitch(unit) ? unit.score - unit.cases : unit.score

const toMessage = (unit: Unit, limit: number): string =>
  isSwitch(unit)
    ? `${unit.name} has a complexity of ${toLimitedScore(unit)} without its ${unit.cases} ` +
      `switch cases (${unit.score} with them); the limit is ${limit}`
    : `${unit.name} has a complexity of ${unit.score}; the limit is ${limit}`

/** The rule for one limit. The plugin registers it at {@link COMPLEXITY_LIMIT}. */
export const toComplexityRule = ({ limit }: RuleOptions): Deno.lint.Rule => ({
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}
    const { sourceCode } = context
    const units = new Map<Deno.lint.Node, Unit>()

    // The unit a node is in: the last node on its way down from the root
    // that starts a unit. A named function starts one wherever it is.
    const toOwner = (node: Deno.lint.Node): Owner | undefined => {
      const path = sourceCode.getAncestors(node)

      return path.reduce<Owner | undefined>((current, ancestor, index) => {
        const start = toUnitStart(
          sourceCode,
          ancestor,
          path.slice(0, index),
          current !== undefined
        )

        return start === undefined ? current : { node: ancestor, ...start }
      }, undefined)
    }

    const count = (node: Deno.lint.Node, isCase = false): void => {
      const owner = toOwner(node)

      if (owner === undefined) return

      const unit = units.get(owner.node) ?? { name: owner.name, score: 1, cases: 0, at: owner.at }

      unit.score += 1
      unit.cases += isCase ? 1 : 0
      units.set(owner.node, unit)
    }

    return {
      IfStatement: node => count(node),
      ForStatement: node => count(node),
      ForInStatement: node => count(node),
      ForOfStatement: node => count(node),
      WhileStatement: node => count(node),
      DoWhileStatement: node => count(node),
      CatchClause: node => count(node),
      ConditionalExpression: node => count(node),
      LogicalExpression: node => count(node),

      SwitchCase(node) {
        // `default:` is the path with no branch taken, as in the script.
        if (node.test !== null) count(node, true)
      },

      AssignmentExpression(node) {
        if (LOGICAL_ASSIGNMENTS.has(node.operator)) count(node)
      },

      'Program:exit'() {
        for (const unit of units.values()) {
          if (toLimitedScore(unit) <= limit) continue

          context.report({ node: unit.at, message: toMessage(unit, limit), hint: HINT })
        }
      }
    }
  }
})

export const complexity: Deno.lint.Rule = toComplexityRule({ limit: COMPLEXITY_LIMIT })
