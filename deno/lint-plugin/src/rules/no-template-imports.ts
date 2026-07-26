import { isGeneratorSource } from '../shared/target.ts'
import { toEmittedText } from '../shared/nodes.ts'

/**
 * `skmtc/no-template-imports` — imports reach emitted files through
 * `register`, never as template text.
 *
 * Ported from gen-eval check 12
 * (`packages/gen-eval/docs/template-imports.md`). An import written into
 * a template lands in the *body* of the rendered file — after the imports
 * header `File.toString()` produces — so TypeScript rejects it. It also
 * bypasses the per-module `Set` dedup and the identifier-kind-aware
 * rendering (`import type` vs `import`).
 *
 * ## Known false negatives
 *
 * - Emitted text assembled outside a template literal (a `+`
 *   concatenation, an array joined at render) is not scanned.
 * - An import statement that only exists inside an interpolation — a
 *   string literal or a nested template held in `${…}` — is attributed to
 *   that inner node, not to this one (see `toEmittedText`), so a bare
 *   `${"import x from 'y'"}` is missed.
 * - A dynamic `import('…')` in emitted text is not an import statement
 *   and is not matched.
 *
 * ## Known false positive
 *
 * - A generator emitting documentation *about* imports (a markdown docs
 *   generator) can trip this. Allow-list the site with
 *   `// deno-lint-ignore skmtc/no-template-imports` rather than
 *   weakening the pattern.
 */

const TEMPLATE_IMPORT = /^\s*import\b(.*\bfrom\b|\s+['"])/m

const HINT =
  'The register family is the only import channel: this.register({ imports }) for the own file, ' +
  'this.registerInto(path, { imports }) cross-file, this.register({ imports, destinationPath }) ' +
  'from a Snippet. An import in emitted text lands in the file body, after the imports header.'

export const noTemplateImports: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}

    return {
      TemplateLiteral(node) {
        if (!TEMPLATE_IMPORT.test(toEmittedText(node))) return
        context.report({
          node,
          message: 'import statement in emitted text — imports are added via register',
          hint: HINT
        })
      }
    }
  }
}
