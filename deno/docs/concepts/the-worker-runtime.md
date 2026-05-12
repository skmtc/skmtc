# The Worker runtime

> How generation runs in a sandboxed Deno Worker.

## The one-line definition

## Why a worker

### Sandboxing

### Process isolation

### The Deno permission model

## Worker lifecycle

### One-shot per generate run

### Spawn → READY → GENERATE → RESULT → terminate

## The structured-clone boundary

### What can cross

### What can't (and why GraphQL is parsed worker-side)

## The bundle

### deno bundle of worker.ts

### Local vs JSR-published bundle

### Freshness checks

## Permissions in detail

### What's granted

### What's denied

### Residual risks (env reads)

## Common questions

## Further reading
