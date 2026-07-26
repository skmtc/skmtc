import { isGeneratorSource } from '../shared/target.ts'
import { toKeyName } from '../shared/nodes.ts'

/**
 * `skmtc/runtime-discipline` — generator code is valid synchronous Deno;
 * its only side effects are logs and the register/insert family.
 *
 * Ported from gen-eval check 14
 * (`packages/gen-eval/docs/runtime-discipline.md`). Every sub-check there
 * is per-file, so the whole check ports. Categories:
 *
 * - **node-ism** — `process.*` (use `Deno.env.get`), `require(…)`
 * - **fs** — `Deno` file operations and `node:fs` imports. Output flows
 *   through `register`, never the filesystem: a file written directly is
 *   invisible to `findDefinition`, the artifacts payload, the manifest and
 *   cleanup. `Deno.env` is the sanctioned env read and is allowed.
 * - **network** — `fetch(…)`, `new WebSocket`, `new XMLHttpRequest`. The
 *   worker runs with `net: false`.
 * - **timer** — `setTimeout` / `setInterval`
 * - **async** — `async` functions, `await`, `new Promise`, and
 *   `.then/.catch/.finally(callback)`. The generate loop is synchronous:
 *   `transform` and every producer constructor must complete
 *   synchronously.
 *
 * Detection is AST-level, which is what makes it usable: emitted code is
 * often legitimately async (`await fetch(…)` inside a tanstack-query hook
 * template), but that text lives inside a template literal where it is
 * not an AST construct.
 *
 * ## Known false negatives
 *
 * - An async API reached through an alias
 *   (`const write = Deno.writeTextFile; write(…)`) is not matched.
 * - A returned promise never awaited (`return fs.readFile(…)` via an
 *   aliased import) is not matched.
 * - `for await` is an `AwaitExpression`-free async construct and is not
 *   matched.
 * - `import 'node:fs'` is matched, but `await import('node:fs')` is
 *   caught only by the `await`, not by the specifier.
 */

// Deno file-op namespace methods. `Deno.env` is deliberately absent — it
// is the sanctioned env read.
const DENO_FS_METHOD =
  /^(write|read|remove|mkdir|open|create|copy|rename|truncate|link|symlink|stat|lstat)/

const FS_MODULES = new Set(['fs', 'node:fs', 'node:fs/promises', 'fs/promises'])
const TIMER_CALLS = new Set(['setTimeout', 'setInterval'])
const PROMISE_METHODS = new Set(['then', 'catch', 'finally'])

const HINTS = {
  'node-ism':
    'Generator code runs in a sandboxed Deno worker, not Node. Read env through Deno.env.get and ' +
    'import with ES module syntax.',
  fs:
    'Output reaches disk through register/insert only. A file written directly is invisible to ' +
    'findDefinition, the artifacts payload, the manifest and cleanup.',
  network:
    'The worker runs with net: false — generators have no outbound network by design. Everything ' +
    'a generator needs arrives on the schema, the settings and the enrichments.',
  timer: 'The generate loop is synchronous; there is no later for a timer to fire in.',
  async:
    'The generate loop is synchronous: transform and every producer constructor must complete ' +
    'synchronously. Async in EMITTED code is fine — it lives inside a template literal.'
} as const

type Category = keyof typeof HINTS

export const runtimeDiscipline: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}

    const report = (node: Deno.lint.Node, category: Category, detail: string): void => {
      context.report({
        node,
        message: `${detail} — ${category} in generator code; the worker runs valid synchronous Deno`,
        hint: HINTS[category]
      })
    }

    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return
        if (node.property.type !== 'Identifier') return
        if (node.object.name === 'process') {
          report(node, 'node-ism', `process.${node.property.name}`)
          return
        }
        if (node.object.name === 'Deno' && DENO_FS_METHOD.test(node.property.name)) {
          report(node, 'fs', `Deno.${node.property.name}`)
        }
      },

      CallExpression(node) {
        if (node.callee.type === 'Identifier') {
          const name = node.callee.name
          if (name === 'require') report(node, 'node-ism', 'require(…)')
          if (name === 'fetch') report(node, 'network', 'fetch(…)')
          if (TIMER_CALLS.has(name)) report(node, 'timer', `${name}(…)`)
          return
        }
        if (node.callee.type !== 'MemberExpression') return
        if (node.callee.property.type !== 'Identifier') return
        if (!PROMISE_METHODS.has(node.callee.property.name)) return
        const takesCallback = node.arguments.some(
          argument =>
            argument.type === 'ArrowFunctionExpression' || argument.type === 'FunctionExpression'
        )
        if (!takesCallback) return
        report(node, 'async', `.${node.callee.property.name}(callback)`)
      },

      NewExpression(node) {
        if (node.callee.type !== 'Identifier') return
        const name = node.callee.name
        if (name === 'WebSocket' || name === 'XMLHttpRequest') {
          report(node, 'network', `new ${name}(…)`)
          return
        }
        if (name === 'Promise') report(node, 'async', 'new Promise(…)')
      },

      ImportDeclaration(node) {
        if (!FS_MODULES.has(node.source.value)) return
        report(node, 'fs', `import from '${node.source.value}'`)
      },

      AwaitExpression(node) {
        report(node, 'async', 'await expression')
      },

      FunctionDeclaration(node) {
        if (!node.async) return
        report(node, 'async', `async function ${node.id?.name ?? '<anonymous>'}`)
      },

      FunctionExpression(node) {
        if (!node.async) return
        const owner =
          node.parent.type === 'MethodDefinition' || node.parent.type === 'Property'
            ? toKeyName(node.parent.key)
            : undefined
        report(node, 'async', `async ${owner ?? '<anonymous>'}`)
      },

      ArrowFunctionExpression(node) {
        if (!node.async) return
        report(node, 'async', 'async arrow function')
      }
    }
  }
}
