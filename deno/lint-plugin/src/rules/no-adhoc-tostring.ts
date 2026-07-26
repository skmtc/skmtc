import { isGeneratorSource } from '../shared/target.ts'
import { toKeyName } from '../shared/nodes.ts'

/**
 * `skmtc/no-adhoc-tostring` — a stringable fragment is a Snippet, never an
 * object literal with a `toString` key.
 *
 * Ported from gen-eval check 9
 * (`packages/gen-eval/docs/adhoc-tostring.md`). An ad-hoc
 * `{ toString: () => '…' }` is the duck-type that satisfies `Stringable`
 * while lying about capabilities: it has no `context`, so it can never
 * register an import; no `generatorKey`, so it is invisible to
 * attribution and `affirmDefinition`; and it is not `instanceof
 * SnippetBase`, so generic code over the producer family rejects it.
 *
 * ## Known false negatives
 *
 * - A computed key (`{ ['toString']: … }`) is not matched.
 * - An object assembled field-by-field
 *   (`const value = {}; value.toString = …`) is not matched.
 */

const HINT =
  'Anything stringable is a Snippet — or CustomValue for a raw fragment. An object literal with ' +
  'a toString key has no context (it can never register an import), no generatorKey (invisible ' +
  'to attribution) and is not instanceof SnippetBase.'

export const noAdhocToString: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}

    return {
      ObjectExpression(node) {
        const declaresToString = node.properties.some(
          property =>
            property.type === 'Property' &&
            !property.computed &&
            toKeyName(property.key) === 'toString'
        )
        if (!declaresToString) return
        context.report({
          node,
          message: 'Object literal with a toString key — a stringable fragment is a Snippet',
          hint: HINT
        })
      }
    }
  }
}
