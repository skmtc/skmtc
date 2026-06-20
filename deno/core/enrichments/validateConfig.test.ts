import { assert, assertEquals } from '@std/assert'
import * as v from 'valibot'
import { validateConfig } from './validateConfig.ts'
import type { EnrichmentSource } from './toEnrichmentDescriptor.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'

const formSource: EnrichmentSource = {
  id: 'gen-form',
  type: 'oasOperation',
  toEnrichmentSchema: () =>
    v.object({
      subject: v.optional(
        v.object({
          title: v.optional(v.string()),
          submitLabel: v.optional(v.string())
        })
      ),
      generator: v.undefined(),
      stack: v.undefined()
    })
}

const modelSource: EnrichmentSource = {
  id: 'gen-zod',
  type: 'model',
  toEnrichmentSchema: () =>
    v.object({
      subject: v.optional(v.object({ coerce: v.optional(v.boolean()) })),
      generator: v.undefined(),
      stack: v.undefined()
    })
}

Deno.test('validateConfig — undefined / empty enrichments yields no issues', () => {
  assertEquals(validateConfig(undefined, [formSource]), [])
  assertEquals(validateConfig({}, [formSource]), [])
})

Deno.test('validateConfig — a well-formed operation enrichment passes', () => {
  const enrichments = {
    'gen-form': { '/contacts': { post: { main: { title: 'Create contact' } } } }
  }
  assertEquals(validateConfig(enrichments, [formSource]), [])
})

Deno.test('validateConfig — wrong-typed operation value is reported with full routing', () => {
  const enrichments = {
    'gen-form': { '/contacts': { post: { main: { title: 123 } } } }
  }
  const issues = validateConfig(enrichments, [formSource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].generator, 'gen-form')
  assertEquals(issues[0].scope, 'subject')
  assertEquals(issues[0].subject, '/contacts')
  assertEquals(issues[0].method, 'post')
  assertEquals(issues[0].variant, 'main')
  assertEquals(issues[0].field, 'title')
})

Deno.test('validateConfig — model routing tags refName + variant, no method', () => {
  const enrichments = {
    'gen-zod': { Customer: { main: { coerce: 'yes' } } }
  }
  const issues = validateConfig(enrichments, [modelSource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].scope, 'subject')
  assertEquals(issues[0].subject, 'Customer')
  assertEquals(issues[0].method, undefined)
  assertEquals(issues[0].variant, 'main')
  assertEquals(issues[0].field, 'coerce')
})

Deno.test('validateConfig — a model whose only variant is non-main is NOT mis-walked as an operation', () => {
  // The retired `'main' in value` heuristic would misclassify this (no `main`
  // key) as an operation and drop it. With kind-driven routing it validates
  // correctly as a model subject.
  const enrichments = {
    'gen-zod': { Customer: { coercive: { coerce: 'nope' } } }
  }
  const issues = validateConfig(enrichments, [modelSource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].scope, 'subject')
  assertEquals(issues[0].subject, 'Customer')
  assertEquals(issues[0].variant, 'coercive')
  assertEquals(issues[0].field, 'coerce')
})

Deno.test('validateConfig — a generator configured but absent from the stack is reported', () => {
  const enrichments = {
    'gen-missing': { '/x': { get: { main: {} } } }
  }
  const issues = validateConfig(enrichments, [formSource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].generator, 'gen-missing')
  assertEquals(issues[0].scope, 'generator')
  assert(issues[0].message.includes('not present in the stack'))
})

Deno.test('validateConfig — a no-enrichment generator receiving a value fails loud', () => {
  const emptySource: EnrichmentSource = {
    id: 'gen-ts',
    type: 'model',
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
  const enrichments = {
    'gen-ts': { User: { main: { anything: 1 } } }
  }
  const issues = validateConfig(enrichments, [emptySource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].scope, 'subject')
  assertEquals(issues[0].subject, 'User')
})

Deno.test('validateConfig — generator run-constant (_generator) value is validated', () => {
  const genScopeSource: EnrichmentSource = {
    id: 'gen-zod',
    type: 'model',
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(v.unknown()),
        generator: v.optional(v.object({ strict: v.optional(v.boolean()) })),
        stack: v.undefined()
      })
  }
  const enrichments = {
    'gen-zod': { _generator: { strict: 'no' } }
  }
  const issues = validateConfig(enrichments, [genScopeSource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].scope, 'generator')
  assertEquals(issues[0].field, 'strict')
})

Deno.test('validateConfig — gql operation routing tags fieldName + rootKind', () => {
  const gqlSource: EnrichmentSource = {
    id: 'gen-gql',
    type: 'gqlOperation',
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(v.object({ label: v.optional(v.string()) })),
        generator: v.undefined(),
        stack: v.undefined()
      })
  }
  const enrichments = {
    'gen-gql': { mutation: { createUser: { main: { label: 42 } } } }
  }
  const issues = validateConfig(enrichments, [gqlSource])
  assertEquals(issues.length, 1)
  assertEquals(issues[0].scope, 'subject')
  assertEquals(issues[0].subject, 'createUser')
  assertEquals(issues[0].method, 'mutation')
  assertEquals(issues[0].variant, 'main')
  assertEquals(issues[0].field, 'label')
})

Deno.test('validateConfig — issues from multiple generators are aggregated', () => {
  const enrichments = {
    'gen-form': { '/contacts': { post: { main: { title: 123 } } } },
    'gen-zod': { Customer: { main: { coerce: 'yes' } } }
  }
  const issues = validateConfig(enrichments, [formSource, modelSource])
  assertEquals(issues.length, 2)
  assert(issues.some(issue => issue.generator === 'gen-form' && issue.field === 'title'))
  assert(issues.some(issue => issue.generator === 'gen-zod' && issue.field === 'coerce'))
})
