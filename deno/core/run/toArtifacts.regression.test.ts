/**
 * Bit-identical regression harness for the variant axis.
 *
 * Runs a hand-crafted fixture (small OpenAPI doc + variants-aware
 * form generator + variants-unaware peer generator) through
 * `toArtifacts`, then asserts that each generated file matches a
 * checked-in snapshot AFTER both are normalised via `deno fmt`.
 *
 * Rationale: the render layer in `@skmtc/core` is unformatted by
 * design (consumers format their own output). A future change to a
 * generator's template trivia — a quote style, a trailing semi, a
 * line break — would produce textually-different but semantically-
 * identical output, breaking a raw-string snapshot. Routing both
 * sides through `deno fmt` tests *semantic* output identity.
 *
 * Requires `--allow-run=deno` (or broader `--allow-run`) so the
 * formatter subprocess can run.
 */

import { assertEquals } from '@std/assert'
import * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { FileBase } from '@/dsl/FileBase.ts'
import { JsonFile } from '@/dsl/JsonFile.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { formatTs } from '@/test/formatTs.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

// ─── Fixture: peer generator (variants-unaware) ────────────────────

const HookBase = toTsOasOperationProjectionBase({
  id: '@test/hook-gen',
  toIdentifierName: () => 'usePatchQuote',
  toIdentifierType: () => ({ kind: 'variable' }),
  toExportPath: () => '@/hooks/usePatchQuote.generated.ts'
})

class HookProjection extends HookBase {
  override toString() {
    // Returns ONLY the value — the Driver wraps it in
    // `export const <name> = <value>` when the file is serialised.
    return `() => fetch('/quotes/{id}', { method: 'patch' })`
  }
}

// ─── Fixture: form generator (variants-aware) ──────────────────────

const FormBase = toTsOasOperationProjectionBase({
  id: '@test/form-gen',
  toIdentifierName: ({ variant }) => withVariant('PatchQuoteForm', variant),
  toIdentifierType: () => ({ kind: 'variable' }),
  toExportPath: ({ variant }) =>
    `@/forms/${withVariant('PatchQuoteForm', variant)}.generated.tsx`
})

class FormProjection extends FormBase {
  hookName: string

  constructor(args: {
    context: GenerateContextType
    operation: OasOperation
    settings: ConstructorParameters<typeof FormBase>[0]['settings']
  }) {
    super(args)
    this.hookName = this.insertOperation(HookProjection, args.operation).toName()
  }

  override toString() {
    const variant = this.settings.variant
    const title = variant === 'main' ? 'Edit Quote' : `Edit Quote — ${variant} section`
    return `() => {
  const mutation = ${this.hookName}();
  return (
    <form onSubmit={mutation.mutate}>
      <h1>${title}</h1>
      <button type="submit">Save</button>
    </form>
  );
}`
  }
}

// ─── Snapshot helpers ──────────────────────────────────────────────

const runFixture = (variants: Record<string, unknown>) => {
  const doc = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [
      new OasOperation({
        path: '/quotes/{id}',
        method: 'patch',
        pathItem: undefined,
        responses: {}
      })
    ]
  })

  const formEntry = toOasOperationEntry({
    id: '@test/form-gen',
    transform: ({ context, operation, variant }) => {
      context.insertOperation({ projection: FormProjection, operation, variant })
    }
  })

  const hookEntry = toOasOperationEntry({
    id: '@test/hook-gen',
    transform: () => {}
  })

  const context = new GenerateContext({
    document: { type: 'oas', value: doc },
    settings: {
      enrichments: {
        '@test/form-gen': {
          '/quotes/{id}': { patch: variants }
        }
        // deno-lint-ignore no-explicit-any
      } as any
    },
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () =>
      // deno-lint-ignore no-explicit-any
      ({ '@test/form-gen': formEntry, '@test/hook-gen': hookEntry } as any)
  })

  return context.toArtifacts(new StackTrail(['test']))
}

const renderFile = (file: FileBase | undefined): string => {
  if (!file) return ''
  if (file instanceof JsonFile) return JSON.stringify(file.content)
  return file.toString()
}

// ─── Snapshots ─────────────────────────────────────────────────────
//
// Update these snapshots intentionally whenever the variant API or
// the render layer changes shape. Both expected and actual go through
// `deno fmt` before comparison, so trivia changes inside the
// templates above do NOT require touching the snapshots — only
// changes to the rendered structure do.

const EXPECTED_HOOK = `
export const usePatchQuote = () => fetch("/quotes/{id}", { method: "patch" });
`

const EXPECTED_FORM_MAIN = `
import { usePatchQuote } from "@/hooks/usePatchQuote.generated.ts";

export const PatchQuoteForm = () => {
  const mutation = usePatchQuote();
  return (
    <form onSubmit={mutation.mutate}>
      <h1>Edit Quote</h1>
      <button type="submit">Save</button>
    </form>
  );
};
`

const EXPECTED_FORM_CUSTOMER = `
import { usePatchQuote } from "@/hooks/usePatchQuote.generated.ts";

export const PatchQuoteFormCustomer = () => {
  const mutation = usePatchQuote();
  return (
    <form onSubmit={mutation.mutate}>
      <h1>Edit Quote — customer section</h1>
      <button type="submit">Save</button>
    </form>
  );
};
`

// ─── Tests ─────────────────────────────────────────────────────────

Deno.test('regression - single-variant fixture produces expected output (formatted)', async () => {
  const { files } = runFixture({ main: {} })

  const hook = await formatTs(renderFile(files.get('@/hooks/usePatchQuote.generated.ts')))
  const form = await formatTs(renderFile(files.get('@/forms/PatchQuoteForm.generated.tsx')))

  assertEquals(hook.trim(), EXPECTED_HOOK.trim())
  assertEquals(form.trim(), EXPECTED_FORM_MAIN.trim())
})

Deno.test('regression - multi-variant fixture: each variant file matches its snapshot', async () => {
  const { files } = runFixture({ main: {}, customer: {} })

  // The hook is shared between variants — same snapshot as the
  // single-variant case.
  const hook = await formatTs(renderFile(files.get('@/hooks/usePatchQuote.generated.ts')))
  assertEquals(hook.trim(), EXPECTED_HOOK.trim())

  // Each variant has its own form file.
  const formMain = await formatTs(renderFile(files.get('@/forms/PatchQuoteForm.generated.tsx')))
  assertEquals(formMain.trim(), EXPECTED_FORM_MAIN.trim())

  const formCustomer = await formatTs(
    renderFile(files.get('@/forms/PatchQuoteFormCustomer.generated.tsx'))
  )
  assertEquals(formCustomer.trim(), EXPECTED_FORM_CUSTOMER.trim())
})

Deno.test('regression - variants-unaware peer Definition is shared across variants', () => {
  // Not a textual snapshot — a structural assertion that complements
  // the snapshot tests. Two variants of the form, exactly ONE hook
  // Definition. If this number ever flips to 2, the peer-cache
  // invariant is broken even if the snapshot still matches.
  const { files } = runFixture({ main: {}, customer: {} })
  const hookFile = files.get('@/hooks/usePatchQuote.generated.ts')

  if (hookFile && 'definitions' in hookFile) {
    assertEquals(hookFile.definitions.size, 1)
  }
})
