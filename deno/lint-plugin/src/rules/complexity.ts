import { toKeyName } from '../shared/nodes.ts'
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
 *   callback written inline counts toward the unit around it.
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
}

/** The node that starts a unit, and the unit's name. */
type Owner = {
  node: Deno.lint.Node
  name: string
}

type RuleOptions = {
  limit: number
}

type FunctionLike =
  | Deno.lint.FunctionDeclaration
  | Deno.lint.FunctionExpression
  | Deno.lint.ArrowFunctionExpression

type Initializer = Deno.lint.VariableDeclarator | Deno.lint.PropertyDefinition

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

/** A variable or a class field whose value is not a function. */
const isInitializer = (node: Deno.lint.Node): node is Initializer => {
  if (node.type === 'VariableDeclarator') {
    return node.init !== null && !isFunctionLike(node.init)
  }

  return node.type === 'PropertyDefinition' && node.value !== null && !isFunctionLike(node.value)
}

const isClass = (
  node: Deno.lint.Node
): node is Deno.lint.ClassDeclaration | Deno.lint.ClassExpression =>
  node.type === 'ClassDeclaration' || node.type === 'ClassExpression'

/** The name of the innermost class among `ancestors`. */
const toClassName = (ancestors: Deno.lint.Node[]): string =>
  ancestors.findLast(isClass)?.id?.name ?? '<class>'

const toKeyText = (sourceCode: Deno.lint.SourceCode, key: Deno.lint.Node): string =>
  toKeyName(key) ?? sourceCode.getText(key)

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
  if (holder.type === 'MethodDefinition' || holder.type === 'PropertyDefinition') {
    return `${toClassName(ancestors)}.${toKeyText(sourceCode, holder.key)}`
  }

  if (holder.type === 'Property') {
    return toKeyText(sourceCode, holder.key)
  }

  if (holder.type === 'VariableDeclarator') {
    return sourceCode.getText(holder.id)
  }

  return holder.type === 'ExportDefaultDeclaration' ? '<default>' : undefined
}

/** The name of a function, or `undefined` for a callback written inline. */
const toFunctionName = (
  sourceCode: Deno.lint.SourceCode,
  fn: FunctionLike,
  ancestors: Deno.lint.Node[]
): string | undefined => {
  if (fn.type === 'FunctionDeclaration') {
    return fn.id?.name ?? '<default>'
  }

  const holder = ancestors.at(-1)

  return holder === undefined
    ? undefined
    : toHolderName(sourceCode, holder, ancestors.slice(0, -1))
}

/**
 * The name of the unit that starts at `node`, or `undefined` when the node
 * belongs to the unit around it. `ancestors` are the nodes above `node`.
 */
const toUnitName = (
  sourceCode: Deno.lint.SourceCode,
  node: Deno.lint.Node,
  ancestors: Deno.lint.Node[],
  inUnit: boolean
): string | undefined => {
  if (isFunctionLike(node)) {
    return toFunctionName(sourceCode, node, ancestors) ?? (inUnit ? undefined : '<anonymous>')
  }

  return !inUnit && isInitializer(node) ? toHolderName(sourceCode, node, ancestors) : undefined
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
        const name = toUnitName(sourceCode, ancestor, path.slice(0, index), current !== undefined)

        return name === undefined ? current : { node: ancestor, name }
      }, undefined)
    }

    const count = (node: Deno.lint.Node, isCase = false): void => {
      const owner = toOwner(node)

      if (owner === undefined) return

      const unit = units.get(owner.node) ?? { name: owner.name, score: 1, cases: 0 }

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
        for (const [node, unit] of units) {
          if (toLimitedScore(unit) <= limit) continue

          context.report({ node, message: toMessage(unit, limit), hint: HINT })
        }
      }
    }
  }
})

export const complexity: Deno.lint.Rule = toComplexityRule({ limit: COMPLEXITY_LIMIT })
