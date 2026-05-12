# Refs and resolution

> How `$ref` is parsed, tracked, and resolved through the pipeline.

## The one-line definition

## OAS refs in the parsed model

### The OasRef class

### Forward refs and the shared mutable document

## Resolution

### `resolve()` vs `resolveOnce()`

### Type-integrity check on resolution

### Cycle protection via MAX_LOOKUPS

## Ref tracking during parse

### `registerRef` and #refConsumers

### `registerRefError` and #refErrors

## Cascade pruning

### One-hop default

### Transitive failures at generate time

## Common questions

## Further reading
