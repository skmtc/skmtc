// Cyclomatic complexity of each function and method in a generator.
//
//   deno run --allow-read --allow-env complexity.ts <generator>/src [--max 10]
//
// The score of a unit is 1, plus one for each `if`, loop, `case`, `catch`,
// `?:`, `&&`, `||`, `??`, `&&=`, `||=` and `??=`. A unit is a named function:
// a declaration, a method, a constructor, an accessor, or an arrow function
// that a variable or a property holds. A callback written inline counts
// toward the unit around it. Two more things are units when no unit is
// around them: a function with no name (`<default>` for `export default`,
// `<anonymous>` otherwise), and the value of a class field or of a module
// variable when it branches. Files named `*.test.ts` are left out.
//
// Exit 1 when a unit is over the limit. A router is a unit in which more than
// half of the branches are the cases of a `switch`. Its cases do not count
// toward the limit, and its other branches do. A router whose score is over
// the limit for its cases alone is listed as `switch (exempt)`.
//
// The rule `skmtc/complexity` of `@skmtc/lint-plugin` holds the same count in
// `deno lint`. Its test runs both over the same sources, so change the two
// together.
//
// The import names its version here because the script runs from the skill's
// folder, outside any project's `deno.json`.
// deno-lint-ignore no-import-prefix
import ts from 'npm:typescript@5.6.3'

export type Unit = {
  file: string
  line: number
  name: string
  score: number
  cases: number
  /** A function that no class holds. The value of a variable is not a function. */
  outsideClass: boolean
}

type ScoreSourceArgs = {
  file: string
  text: string
}

export type Options = {
  root: string
  max: number
}

type Initializer = ts.PropertyDeclaration | ts.VariableDeclaration

type Holder = Initializer | ts.PropertyAssignment

type Member = ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration

const DEFAULT_MAX = 10

const MAX_FLAG = '--max'

const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken
])

const BRANCH_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression
])

const isBranch = (node: ts.Node): boolean =>
  BRANCH_KINDS.has(node.kind) ||
  (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind))

const isFunctionLike = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node)

/** A class field or a variable whose value is not a function. */
const isInitializer = (node: ts.Node): node is Initializer =>
  (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) &&
  node.initializer !== undefined &&
  !isFunctionLike(node.initializer)

const toClassName = (node: ts.Node): string | undefined => {
  const parent = node.parent

  return ts.isClassDeclaration(parent) || ts.isClassExpression(parent)
    ? (parent.name?.text ?? '<class>')
    : undefined
}

const isMember = (node: ts.Node): node is Member =>
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node)

const isHolder = (node: ts.Node): node is Holder =>
  ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)

/** The name of a member, a field or a variable, with its class when it has one. */
const toOwnedName = (node: Member | Holder): string => {
  const owner = toClassName(node)
  const name = node.name.getText()

  return owner === undefined ? name : `${owner}.${name}`
}

/** The name of a function expression, from the variable or property that holds it. */
const toHeldName = (node: ts.FunctionLikeDeclaration): string | undefined => {
  const parent = node.parent

  if (ts.isExportAssignment(parent)) {
    return '<default>'
  }

  return isHolder(parent) && parent.initializer === node ? toOwnedName(parent) : undefined
}

/** The name of a function, or `undefined` for a callback written inline. */
const toFunctionName = (node: ts.FunctionLikeDeclaration): string | undefined => {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.text ?? '<default>'
  }

  if (ts.isConstructorDeclaration(node)) {
    return `${toClassName(node)}.constructor`
  }

  return isMember(node) ? toOwnedName(node) : toHeldName(node)
}

/**
 * The name of the unit that starts at this node, or `undefined` when the node
 * belongs to the unit around it. With no unit around it (`inUnit` is false),
 * a function with no name and a value that is not a function start a unit.
 */
const toUnitName = (node: ts.Node, inUnit: boolean): string | undefined => {
  if (isFunctionLike(node)) {
    return toFunctionName(node) ?? (inUnit ? undefined : '<anonymous>')
  }

  return !inUnit && isInitializer(node) ? toOwnedName(node) : undefined
}

const isInClass = (node: ts.Node): boolean => {
  if (ts.isSourceFile(node)) {
    return false
  }

  return ts.isClassDeclaration(node) || ts.isClassExpression(node) ? true : isInClass(node.parent)
}

/**
 * Each unit of one source file, with its score. The value of a field or of a
 * module variable is listed only when it branches.
 */
export const scoreSource = ({ file, text }: ScoreSourceArgs): Unit[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const units: Unit[] = []
  const values = new Set<Unit>()

  const visit = (node: ts.Node, current: Unit | undefined): void => {
    const name = toUnitName(node, current !== undefined)

    const unit =
      name === undefined
        ? current
        : {
            file,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            name,
            score: 1,
            cases: 0,
            outsideClass: isFunctionLike(node) && !isInClass(node)
          }

    if (unit !== undefined && unit !== current) {
      units.push(unit)
    }

    if (unit !== undefined && unit !== current && isInitializer(node)) {
      values.add(unit)
    }

    if (unit !== undefined && isBranch(node)) {
      unit.score += 1
      unit.cases += ts.isCaseClause(node) ? 1 : 0
    }

    ts.forEachChild(node, child => visit(child, unit))
  }

  visit(source, undefined)

  return units.filter(unit => !values.has(unit) || unit.score > 1)
}

/** A router: more than half of its branches are the cases of a `switch`. */
export const isSwitch = (unit: Unit): boolean => unit.cases * 2 > unit.score - 1

/** The score that the limit applies to. The cases of a router do not count. */
export const toLimitedScore = (unit: Unit): number =>
  isSwitch(unit) ? unit.score - unit.cases : unit.score

const toMaxText = (args: string[], index: number): string | undefined => {
  if (index === -1) {
    return String(DEFAULT_MAX)
  }

  return args[index] === MAX_FLAG ? args[index + 1] : args[index].slice(MAX_FLAG.length + 1)
}

/**
 * The folder and the limit from the command line: `--max 5` or `--max=5`.
 * `undefined` for a missing folder, a limit that is not a whole number above
 * 0, and any other `--` argument, so that a misspelled limit cannot pass as
 * the default.
 */
export const toOptions = (args: string[]): Options | undefined => {
  const maxIndex = args.findIndex(arg => arg === MAX_FLAG || arg.startsWith(`${MAX_FLAG}=`))
  const valueIndex = args[maxIndex] === MAX_FLAG ? maxIndex + 1 : maxIndex
  const max = Number(toMaxText(args, maxIndex))
  const rest = args.filter((_arg, index) => index !== maxIndex && index !== valueIndex)
  const [root] = rest

  const isValid =
    rest.length === 1 && !root.startsWith('--') && Number.isInteger(max) && max > 0

  return isValid ? { root, max } : undefined
}

const toFiles = (path: string): string[] => {
  if (Deno.statSync(path).isFile) {
    return [path]
  }

  return [...Deno.readDirSync(path)]
    .flatMap(entry => {
      const child = `${path}/${entry.name}`

      if (entry.isDirectory) {
        return entry.name === 'node_modules' ? [] : toFiles(child)
      }

      return entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.d.ts')
        ? [child]
        : []
    })
    .sort()
}

const toMedian = (scores: number[]): number => {
  const sorted = [...scores].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const toLine = (unit: Unit): string =>
  `  ${String(unit.score).padStart(3)}  ${unit.file}:${unit.line}  ${unit.name}`

const run = ({ root, max }: Options): number => {
  const base = root.replace(/\/$/, '')
  const units = toFiles(base).flatMap(path =>
    scoreSource({ file: path.slice(base.length + 1) || path, text: Deno.readTextFileSync(path) })
  )

  if (units.length === 0) {
    console.error(`no functions under ${root}`)

    return 2
  }

  const scores = units.map(unit => unit.score)
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const branches = scores.reduce((sum, score) => sum + score - 1, 0)
  const byScore = [...units].sort((a, b) => b.score - a.score)
  const over = byScore.filter(unit => toLimitedScore(unit) > max)
  const switches = byScore.filter(unit => unit.score > max && toLimitedScore(unit) <= max)
  const outside = byScore.filter(unit => unit.outsideClass)

  console.log(
    `${units.length} functions, mean ${mean.toFixed(2)}, median ${toMedian(scores)}, ` +
      `max ${Math.max(...scores)}, ${branches} branches`
  )

  console.log(`\nOver ${max}: ${over.length}`)
  over.forEach(unit => console.log(toLine(unit)))

  console.log(`\nswitch (exempt): ${switches.length}`)
  switches.forEach(unit => console.log(toLine(unit)))

  console.log(`\nFunctions outside a class: ${outside.length}`)
  outside.forEach(unit => console.log(toLine(unit)))

  return over.length === 0 ? 0 : 1
}

if (import.meta.main) {
  const options = toOptions(Deno.args)

  if (options === undefined) {
    console.error('usage: complexity.ts <generator>/src [--max 10]')
    Deno.exit(2)
  }

  Deno.exit(run(options))
}
