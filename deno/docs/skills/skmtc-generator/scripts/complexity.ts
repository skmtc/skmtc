// Cyclomatic complexity of each function and method in a generator.
//
//   deno run --allow-read --allow-env complexity.ts <generator>/src [--max 10]
//
// The score of a unit is 1, plus one for each `if`, loop, `case`, `catch`,
// `?:`, `&&`, `||` and `??`. A unit is a named function: a declaration, a
// method, a constructor, an accessor, or an arrow function that a variable
// or a property holds. A callback written inline counts toward the unit
// around it. Files named `*.test.ts` are left out.
//
// Exit 1 when a unit is over the limit. A unit whose branches are mostly the
// cases of a `switch` is a router: it is listed as `switch` and is exempt.
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
  /** A function that no class holds. */
  outsideClass: boolean
}

type ScoreSourceArgs = {
  file: string
  text: string
}

const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken
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

const toClassName = (node: ts.Node): string | undefined => {
  const parent = node.parent

  return ts.isClassDeclaration(parent) || ts.isClassExpression(parent)
    ? (parent.name?.text ?? '<class>')
    : undefined
}

/** The name of a unit, or `undefined` for a callback written inline. */
const toUnitName = (node: ts.FunctionLikeDeclaration): string | undefined => {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.text ?? '<default>'
  }

  if (ts.isConstructorDeclaration(node)) {
    return `${toClassName(node)}.constructor`
  }

  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    const owner = toClassName(node)
    const name = node.name.getText()

    return owner === undefined ? name : `${owner}.${name}`
  }

  const parent = node.parent
  const holdsNode =
    (ts.isVariableDeclaration(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent)) &&
    parent.initializer === node

  if (!holdsNode) {
    return undefined
  }

  const owner = ts.isPropertyDeclaration(parent) ? toClassName(parent) : undefined
  const name = parent.name.getText()

  return owner === undefined ? name : `${owner}.${name}`
}

const isInClass = (node: ts.Node): boolean => {
  if (ts.isSourceFile(node)) {
    return false
  }

  return ts.isClassDeclaration(node) || ts.isClassExpression(node) ? true : isInClass(node.parent)
}

/** Each named function of one source file, with its score. */
export const scoreSource = ({ file, text }: ScoreSourceArgs): Unit[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const units: Unit[] = []

  const visit = (node: ts.Node, current: Unit | undefined): void => {
    const name = isFunctionLike(node) ? toUnitName(node) : undefined

    const unit =
      name === undefined
        ? current
        : {
            file,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            name,
            score: 1,
            cases: 0,
            outsideClass: !isInClass(node)
          }

    if (unit !== undefined && unit !== current) {
      units.push(unit)
    }

    if (unit !== undefined && isBranch(node)) {
      unit.score += 1
      unit.cases += ts.isCaseClause(node) ? 1 : 0
    }

    ts.forEachChild(node, child => visit(child, unit))
  }

  visit(source, undefined)

  return units
}

/** A router: more than half of its branches are the cases of a `switch`. */
export const isSwitch = (unit: Unit): boolean => unit.cases * 2 > unit.score - 1

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

if (import.meta.main) {
  const maxIndex = Deno.args.indexOf('--max')
  const max = maxIndex === -1 ? 10 : Number(Deno.args[maxIndex + 1])
  const [root] = Deno.args.filter(
    (arg, index) => !arg.startsWith('--') && (maxIndex === -1 || index !== maxIndex + 1)
  )

  if (root === undefined || Number.isNaN(max)) {
    console.error('usage: complexity.ts <generator>/src [--max 10]')
    Deno.exit(2)
  }

  const base = root.replace(/\/$/, '')
  const units = toFiles(base).flatMap(path =>
    scoreSource({ file: path.slice(base.length + 1) || path, text: Deno.readTextFileSync(path) })
  )

  if (units.length === 0) {
    console.error(`no functions under ${root}`)
    Deno.exit(2)
  }

  const scores = units.map(unit => unit.score)
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const branches = scores.reduce((sum, score) => sum + score - 1, 0)
  const byScore = [...units].sort((a, b) => b.score - a.score)
  const switches = byScore.filter(unit => unit.score > max && isSwitch(unit))
  const over = byScore.filter(unit => unit.score > max && !isSwitch(unit))
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

  Deno.exit(over.length === 0 ? 0 : 1)
}
