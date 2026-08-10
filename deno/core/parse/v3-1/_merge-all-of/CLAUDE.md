# `_merge-all-of` — squashing combinators into the IR

**Read `core/parse/README.md` § "Combinator squash" first.** It holds the rules,
the reasoning and the verification method. This file is the orientation you need
before editing anything in this directory.

## Why this code exists

The IR has no `allOf` node and no intersection node:

```ts
export type OasSchema =
  | OasArray | OasBoolean | OasInteger | OasNumber
  | OasObject | OasString | OasUnknown | OasUnion
```

So `allOf` must be resolved during parse — there is nowhere to defer it to.
Generators never see a combinator, and that is the contract this directory
upholds.

## This directory is DUPLICATED per dialect, on purpose

There is a copy under `v3-0/` and another under `v3-1/`. They were byte-identical
for a long stretch; that is a coincidence of timing, not a reason to merge them.
The merge reads `type`, which is dialect-shaped — 3.1 allows a list
(`['string','null']`), 3.0 does not — and `check-type-conflicts` /
`check-at-least-one-type-match` differ between the trees for exactly that reason.

**If you are about to unify these two directories: don't.** See
`core/parse/README.md` § "Shared vs duplicated", and note that a previous attempt
was reverted.

## The two things most likely to bite you

1. **Cycles.** A schema reachable from itself has no finite expansion. Two
   mechanisms keep it terminating — the path-scoped `$ref` set on the resolver
   (`ref-cycle.ts`), and `mergeWithRef` routing resolved schemas through
   `mergeSchemasOrRefs` rather than `mergeSchemas` so a referent's `allOf` is
   consumed while the path is still in hand. Removing either reintroduces an
   unbounded expansion that killed docs pages with `exceededMemory` — which never
   reaches Sentry, so it presents as a silent 503.

2. **The guard must stay path-scoped.** A global visited set also stops cycles,
   and additionally leaves the second of two sibling uses of a schema as a bare
   ref — changing output for acyclic documents. `cycles.test.ts` pins this.

## Verifying a change

Do not trust "the tests pass" alone for a semantic change. OpenAPI does not
define schema merging, so there is no correct output to assert against; what is
defined is validation. Use the verdict-equivalence harness described in
`core/parse/README.md` § "Changing any of this", and remember it is blind to
annotation-only changes.

## Open follow-ups

- **skmtc#117** — bound the `allOf`-over-union distribution; refuse rather than
  emit a widened type.
- **skmtc#118** — single-member `allOf` wrappers discard use-site annotations.
