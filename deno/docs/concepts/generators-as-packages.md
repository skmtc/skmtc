# Generators as packages

> How generators are structured as JSR packages with peer dependencies.

## The one-line definition

## Per-generator package layout

### `deno.json`

### `mod.ts` (re-export)

### `src/mod.ts` (entry function)

### `src/base.ts` (toIdentifier, toExportPath)

### `src/enrichments.ts` (Valibot schema)

### `src/<MainProjection>.ts`

### `src/<Snippet>.ts` files

## Peer dependencies

### When generators depend on each other

### Version coordination

## JSR publishing

## Local cloning

## Common questions

## Further reading
