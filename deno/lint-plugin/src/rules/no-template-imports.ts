import { isGeneratorSource } from '../shared/target.ts'

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

// The template's own text starts with a backtick, which is not
// whitespace, so an import on the FIRST line of the template would never
// satisfy the line-start anchor. Dropping the opening backtick makes the
// first line behave like every other one — a deliberate improvement over
// the harness, which reads the node text verbatim and so only catches
// imports from the second line on.
const toEmittedText = (text: string): string => text.replace(/^`/, '')

const HINT =
  'The register family is the only import channel: this.register({ imports }) for the own file, ' +
  'this.registerInto(path, { imports }) cross-file, this.register({ imports, destinationPath }) ' +
  'from a Snippet. An import in emitted text lands in the file body, after the imports header.'

export const noTemplateImports: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}

    return {
      TemplateLiteral(node) {
        if (!TEMPLATE_IMPORT.test(toEmittedText(context.sourceCode.getText(node)))) return
        context.report({
          node,
          message: 'import statement in emitted text — imports are added via register',
          hint: HINT
        })
      }
    }
  }
}
