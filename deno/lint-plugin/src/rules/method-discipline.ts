import { isGeneratorSource } from '../shared/target.ts'
import { toKeyName } from '../shared/nodes.ts'

/**
 * `skmtc/method-discipline` — a producer is constructor + `toString()`.
 *
 * Ported from gen-eval check 3
 * (`packages/gen-eval/docs/method-discipline.md`). The
 * constructor/toString contract is the producer lifecycle: the constructor
 * runs at most once per cache key and does the side effects; `toString()`
 * renders pure. An extra method usually means the class is being used as a
 * service object or a string-builder — logic that belongs in Snippets
 * composed via interpolation. **A getter is the canonical offender**: the
 * protocol mirror (`get annotations() { return this.value.annotations }`)
 * puts the same fact in two places. A field other code reads off a
 * producer belongs directly on that producer, wired by reference-sharing
 * (`this.annotations = this.value.annotations` — one array, two names).
 *
 * ## Producer detection is per-file
 *
 * The harness classifies producers across the whole package: a class is a
 * projection if it extends — transitively — a const built by a
 * `to<X>ProjectionBase` factory, a snippet if it extends a
 * `*Snippet`/`SnippetBase` base. A lint rule sees one file, so detection
 * is by the shapes visible in it:
 *
 * - `extends to<X>ProjectionBase({ … })` — the factory called inline;
 * - `extends <Name>` where `<Name>` is bound in this file to a
 *   `to<X>ProjectionBase(…)` call;
 * - `extends <Name>` where `<Name>` matches `*Snippet` / `*SnippetBase`
 *   (the lang packages' snippet bases: `TsSnippet`, `KtSnippet`,
 *   `CsSnippet`, `SnippetBase`);
 * - `extends <Name>` where `<Name>` ends in `Base` — the naming
 *   convention every stock generator's projection base follows
 *   (`ZodBase`, `KtModelBase`, `TanstackQueryBase`, `CsRecordBase`);
 * - `extends <Name>` where `<Name>` is a producer class declared in the
 *   same file (transitivity, within the file).
 *
 * ## The accumulator exemption is approximated
 *
 * An accumulator producer grows by design — `gen-msw`'s
 * `MockRoutesList.add` is the canonical case — and the harness exempts
 * its mutators only when the package-level accumulator verdict holds
 * (`defineAndRegister` plus `findDefinition` or a container producer).
 * That verdict is cross-file and stays in the harness. Here the exemption
 * is approximated per-method: a method whose body mutates a `this.*`
 * container path (`this.list.values.push(…)`, `this.routes.add(…)`) is
 * exempt. The approximation is looser than the harness's — an accumulator
 * mutator in a package with no accumulator machinery is exempted here and
 * flagged there — which is the safe direction: it never invents a
 * violation. Measured against the stock cohort that costs seven methods:
 * `ExpressApp.append`, `SupabaseHono.append`, and `gen-md-docs`'
 * `TopIndex.add` / `TagIndex.add` / `Catalog.add` / `Definitions.add` +
 * `Definitions.build`.
 *
 * It is also STRICTER than the harness in the other direction, and
 * deliberately so: the harness buckets a container producer's entire
 * `extraMethods` list as exempt, so a mutator's exemption covers its
 * non-mutator siblings. Per-method keeps the siblings — which is how
 * `gen-kotlin-sdk`'s private rendering helpers (`SdkServiceValue.#rawView`
 * / `#methods`, `SdkServiceImplValue.#delegation` / `#rawImpl` /
 * `#rawMethod`) stay visible.
 *
 * A method written as a class FIELD holding a function
 * (`toProperties = (): string => …`) counts too. It is a `PropertyDefinition`
 * rather than a `MethodDefinition`, but it is the same string-builder the
 * rule exists to catch — and `tostring-purity` already treats an arrow-field
 * `toString` as a `toString` body, so the two rules would otherwise disagree
 * about what a method is.
 *
 * `static` members are not methods for this purpose. They are the framework's
 * contract slots — the engine reads `schemaToValueFn` and `createIdentifier`
 * off the projection class, and every clean stock generator declares at least
 * one as a static arrow field. The doctrine is about the instance lifecycle:
 * the constructor sets state, `toString()` renders it. Excluding statics also
 * stops `static override toIdentifierName(…)` firing — a naming static that
 * `string-composition.md` names as expected, and that check 3 flags only
 * because its member collection ignores the modifier.
 *
 * ## Known false negatives
 *
 * - A projection whose base is imported under a name that neither ends in
 *   `Base` nor looks like a snippet base is not recognised as a producer,
 *   so its extra methods are not flagged.
 * - A producer class assembled by a mixin or a factory returning a class
 *   expression is not tracked.
 * - Non-mutator helper logic hidden inside a method that ALSO mutates a
 *   container rides along on the accumulator exemption.
 * - The accumulator exemption matches `CONTAINER_MUTATION` against the
 *   member's SOURCE TEXT, mirroring the harness. So a method whose emitted
 *   template text happens to contain `this.x.push(` is exempted as though it
 *   mutated a container. An AST walk of the body would be tighter; the text
 *   match is kept because it is the harness's own shape and the collision is
 *   remote.
 * - A field assigned a function indirectly (`toProperties = makeBuilder()`)
 *   is not function-like at the AST level and is not flagged.
 * - `abstract` member declarations and `accessor` fields are separate node
 *   kinds and are not inspected. Neither appears in generator code today.
 */

const PROJECTION_BASE_FACTORY = /^to[A-Z]\w*ProjectionBase$/
const SNIPPET_BASE_NAME = /(^|[a-z0-9])(Snippet|SnippetBase)$/i
// Projection bases are consts, conventionally named `<Something>Base`.
// Case-sensitive on `Base` so `Database` does not match.
const PROJECTION_BASE_NAME = /(^|[a-z0-9])Base$/

const CONTRACT_MEMBERS = new Set(['constructor', 'toString'])

// The harness's container-mutation shape: a this-rooted path, any depth,
// ending in a mutator call.
const CONTAINER_MUTATION =
  /this\.(\w+)(?:\.\w+|\[[^\]]*\])*\.(?:push|add|set|unshift|splice|delete)\(/

const HINT =
  'State is set in the constructor; toString() renders it. Extra methods mean the class is a ' +
  'service object or a string-builder — delegate that composition to child Snippets and ' +
  'interpolate them. A getter mirroring a nested field is the anti-pattern: put the field on ' +
  'this producer and share the reference in the constructor.'

type ClassNode = Deno.lint.ClassDeclaration | Deno.lint.ClassExpression

/**
 * How a method reads in the diagnostic, or `undefined` when the member is
 * not one — a contract member, or a field holding data rather than a
 * function.
 */
const toMemberDescription = (
  member: Deno.lint.MethodDefinition | Deno.lint.PropertyDefinition
): string | undefined => {
  // `static` members are the framework's contract slots, not instance
  // behaviour: `schemaToValueFn` and `createIdentifier` are read off the
  // projection CLASS by the engine, and every clean stock generator declares
  // them. The doctrine governs the constructor/toString lifecycle, which is
  // an instance concern.
  if (member.static) return undefined

  const memberName = toKeyName(member.key)
  if (memberName !== undefined && CONTRACT_MEMBERS.has(memberName)) return undefined
  const label = memberName ?? '<computed>'

  if (member.type === 'PropertyDefinition') {
    const holdsFunction =
      member.value?.type === 'ArrowFunctionExpression' ||
      member.value?.type === 'FunctionExpression'
    return holdsFunction ? `function field ${label}` : undefined
  }

  if (member.kind === 'get') return `getter ${label}`
  if (member.kind === 'set') return `setter ${label}`
  return `method ${label}()`
}

export const methodDiscipline: Deno.lint.Rule = {
  create(context) {
    if (!isGeneratorSource(context.filename)) return {}
    const { sourceCode } = context

    // Names bound in this file to a `to<X>ProjectionBase(…)` call, and
    // classes already found to be producers. Both grow as the file is
    // walked, so the verdict is deferred to Program:exit.
    const projectionBaseNames = new Set<string>()
    const producerClassNames = new Set<string>()
    const classNodes: ClassNode[] = []

    const isProducerSuperClass = (superClass: Deno.lint.Node | null): boolean => {
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
        projectionBaseNames.has(superClass.name) ||
        producerClassNames.has(superClass.name) ||
        SNIPPET_BASE_NAME.test(superClass.name) ||
        PROJECTION_BASE_NAME.test(superClass.name)
      )
    }

    const classifyClasses = (): void => {
      // Fixed point, so a subclass declared before its base is still
      // classified.
      const grow = (): boolean =>
        classNodes.reduce((changed, classNode) => {
          const name = classNode.id?.name
          if (name === undefined || producerClassNames.has(name)) return changed
          if (!isProducerSuperClass(classNode.superClass)) return changed
          producerClassNames.add(name)
          return true
        }, false)
      while (grow()) continue
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || node.init === null) return
        if (node.init.type !== 'CallExpression') return
        if (node.init.callee.type !== 'Identifier') return
        if (!PROJECTION_BASE_FACTORY.test(node.init.callee.name)) return
        projectionBaseNames.add(node.id.name)
      },

      ClassDeclaration(node) {
        classNodes.push(node)
      },

      ClassExpression(node) {
        classNodes.push(node)
      },

      'Program:exit'() {
        classifyClasses()

        for (const classNode of classNodes) {
          const className = classNode.id?.name
          if (className === undefined || !producerClassNames.has(className)) continue

          for (const member of classNode.body.body) {
            if (member.type !== 'MethodDefinition' && member.type !== 'PropertyDefinition') continue
            const described = toMemberDescription(member)
            if (described === undefined) continue
            if (CONTAINER_MUTATION.test(sourceCode.getText(member))) continue

            context.report({
              node: member,
              message: `${described} on producer ${className} — a producer is constructor + toString only`,
              hint: HINT
            })
          }
        }
      }
    }
  }
}
