/**
 * Experimental lint plugin: cyclomatic complexity per producer and per
 * module-level function, with the text of every decision so branches can be
 * grouped by what they test. It reports one diagnostic per producer or
 * function whose message is JSON; `measure.ts` turns those into tables.
 *
 * Producer detection copies `skmtc/method-discipline`
 * (`deno/lint-plugin/src/rules/method-discipline.ts`).
 *
 * Counted as decisions: `if`, `? :`, `for`/`for-in`/`for-of`/`while`/
 * `do-while`, `catch`, each non-default `case`, `&&`, `||`, `??`, `&&=`,
 * `||=`, `??=`, and each ts-pattern `.with(` / `.when(`. Not counted: `?.`
 * and default parameter values.
 */

const PROJECTION_BASE_FACTORY = /^to[A-Z]\w*ProjectionBase$/
const SNIPPET_BASE_NAME = /(^|[a-z0-9])(Snippet|SnippetBase)$/i
const PROJECTION_BASE_NAME = /(^|[a-z0-9])Base$/

const PLAIN_DECISIONS = new Set([
  'IfStatement',
  'ConditionalExpression',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause'
])
const LOGICAL_ASSIGNMENTS = new Set(['&&=', '||=', '??='])
const MATCH_ARMS = new Set(['with', 'when'])

export type MemberCounts = { name: string; decisions: number; tests: string[] }
export type Entry = { kind: 'producer' | 'function'; name: string; members: MemberCounts[] }

type ClassNode = Deno.lint.ClassDeclaration | Deno.lint.ClassExpression

const isNode = (value: unknown): value is Deno.lint.Node =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'

const keyName = (key: Deno.lint.Node): string =>
  key.type === 'Identifier'
    ? key.name
    : key.type === 'PrivateIdentifier'
      ? `#${key.name}`
      : '<computed>'

const toDecisions = (sourceCode: Deno.lint.SourceCode, root: Deno.lint.Node, name: string) => {
  const tests: string[] = []
  const text = (node: Deno.lint.Node): string =>
    sourceCode.getText(node).replace(/\s+/g, ' ').slice(0, 160)

  const decisionOf = (node: Deno.lint.Node): string | undefined => {
    if (PLAIN_DECISIONS.has(node.type)) {
      const test = 'test' in node && isNode(node.test) ? node.test : node
      return `${node.type}: ${text(test)}`
    }
    if (node.type === 'SwitchCase')
      return node.test === null ? undefined : `SwitchCase: ${text(node.test)}`
    if (node.type === 'LogicalExpression') return `Logical ${node.operator}: ${text(node)}`
    if (node.type === 'AssignmentExpression') {
      return LOGICAL_ASSIGNMENTS.has(node.operator)
        ? `Assign ${node.operator}: ${text(node)}`
        : undefined
    }
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.property.type === 'Identifier' &&
      MATCH_ARMS.has(node.callee.property.name)
    ) {
      const [pattern] = node.arguments
      return `match.${node.callee.property.name}: ${pattern === undefined ? '' : text(pattern)}`
    }
    return undefined
  }

  // Deno lint nodes expose their children as prototype getters, so walk
  // them with for...in rather than Object.entries.
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!isNode(value)) return
    const decision = decisionOf(value)
    if (decision !== undefined) tests.push(decision)
    for (const key in value) {
      if (key === 'parent' || key === 'range') continue
      visit(Reflect.get(value, key))
    }
  }

  visit(root)
  return { name, decisions: tests.length, tests }
}

const plugin: Deno.lint.Plugin = {
  name: 'cc',
  rules: {
    'producer-complexity': {
      create(context) {
        if (/\.(test|spec|bench)\.ts$/.test(context.filename)) return {}
        const { sourceCode } = context
        const baseNames = new Set<string>()
        const producers = new Set<string>()
        const classes: ClassNode[] = []
        const functions: { name: string; node: Deno.lint.Node }[] = []

        const isTopLevel = (node: Deno.lint.Node): boolean =>
          sourceCode
            .getAncestors(node)
            .every(
              ancestor =>
                ancestor.type === 'Program' ||
                ancestor.type === 'VariableDeclaration' ||
                ancestor.type === 'ExportNamedDeclaration' ||
                ancestor.type === 'ExportDefaultDeclaration'
            )

        const isProducerSuper = (superClass: Deno.lint.Node | null): boolean => {
          if (superClass === null) return false
          if (
            superClass.type === 'CallExpression' &&
            superClass.callee.type === 'Identifier' &&
            PROJECTION_BASE_FACTORY.test(superClass.callee.name)
          ) {
            return true
          }
          if (superClass.type !== 'Identifier') return false
          return (
            baseNames.has(superClass.name) ||
            producers.has(superClass.name) ||
            SNIPPET_BASE_NAME.test(superClass.name) ||
            PROJECTION_BASE_NAME.test(superClass.name)
          )
        }

        const report = (node: Deno.lint.Node, entry: Entry) =>
          context.report({ node, message: JSON.stringify(entry) })

        return {
          VariableDeclarator(node) {
            if (node.id.type !== 'Identifier' || node.init === null) return
            const { init } = node
            if (
              init.type === 'CallExpression' &&
              init.callee.type === 'Identifier' &&
              PROJECTION_BASE_FACTORY.test(init.callee.name)
            ) {
              baseNames.add(node.id.name)
            }
            if (
              (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') &&
              isTopLevel(node)
            ) {
              functions.push({ name: node.id.name, node: init })
            }
          },
          FunctionDeclaration(node) {
            if (isTopLevel(node)) functions.push({ name: node.id?.name ?? '<default>', node })
          },
          ClassDeclaration(node) {
            classes.push(node)
          },
          ClassExpression(node) {
            classes.push(node)
          },
          'Program:exit'() {
            const grow = (): boolean =>
              classes.reduce((changed, classNode) => {
                const name = classNode.id?.name
                if (name === undefined || producers.has(name)) return changed
                if (!isProducerSuper(classNode.superClass)) return changed
                producers.add(name)
                return true
              }, false)
            while (grow()) continue

            for (const classNode of classes) {
              const name = classNode.id?.name
              if (name === undefined || !producers.has(name)) continue
              const members = classNode.body.body.flatMap(member => {
                if (member.type !== 'MethodDefinition' && member.type !== 'PropertyDefinition') {
                  return []
                }
                const label = `${member.static ? 'static ' : ''}${keyName(member.key)}`
                return member.value === null ? [] : [toDecisions(sourceCode, member.value, label)]
              })
              report(classNode, { kind: 'producer', name, members })
            }

            for (const fn of functions) {
              report(fn.node, {
                kind: 'function',
                name: fn.name,
                members: [toDecisions(sourceCode, fn.node, fn.name)]
              })
            }
          }
        }
      }
    }
  }
}

export default plugin
