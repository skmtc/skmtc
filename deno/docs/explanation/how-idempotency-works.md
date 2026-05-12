# How idempotency works

> Why generator order doesn't affect output.

## The question

## The short answer

## The invariants that combine

### Identifier and exportPath are pure functions

### Cache key uses both deterministically

### `register` side effects are idempotent (Set, Map.has)

## Walking through a concrete scenario

### Order A: generator X first, generator Y depends on X

### Order B: generator Y first, X triggered as a dependency

### Result: identical `#files` map

## Edge cases

### Same-name collisions across generators

### Inline-schema fallback names

## See also
