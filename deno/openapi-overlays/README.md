# @skmtc/openapi-overlays

Apply [OpenAPI Overlay](https://spec.openapis.org/overlay/v1.0.0.html) (1.0.0) documents to an
OpenAPI description.

This is a Deno port of [openapi-overlays-js](https://github.com/lornajane/openapi-overlays-js) by
Lorna Mitchell (Apache-2.0). The merge and removal semantics match the reference tool, but **every
dependency is replaced with a Deno-native equivalent or built in** — the only runtime dependency is
`@std/yaml` (a JSR package). There is **no npm dependency**, so consuming projects never have to
deal with `node_modules` resolution for this library:

| Concern         | Reference (npm)   | This port                         |
| --------------- | ----------------- | --------------------------------- |
| JSONPath        | `jsonpath`        | built-in engine (`./jsonpath.ts`) |
| Deep merge      | `mergician`       | built-in (`appendArrays`)         |
| YAML parse/dump | `@stoplight/yaml` | `@std/yaml@^1.1.0` (JSR)          |
| CLI args        | `arg`             | built-in                          |

The built-in JSONPath engine covers the subset Overlays use — child/bracket access, wildcard `*`,
recursive descent `..`, array indices and unions, and filter expressions (`[?(@.field == 'value')]`
with `== != < <= > >=`, `&& || !`, existence, nested paths, and literals). Filter path resolution is
**null-safe**: a missing or `null` node yields no match rather than throwing, so a recursive filter
like `$..[?(@.description == '…')]` applies cleanly over real specs (no `@ && …` guard needed).

## Library

```ts
import { applyOverlay } from '@skmtc/openapi-overlays'

const updated = applyOverlay(spec, {
  overlay: '1.0.0',
  actions: [
    { target: "$.paths['/pets'].get", update: { 'x-overlaid': true } },
    { target: "$.servers[?(@.description == 'Dev')]", remove: true },
  ],
})
```

`applyOverlay(spec, overlay)` operates on an already-parsed document. It mutates in place where
possible, but a root (`$`) update produces a new object — always use the return value.

To read files from disk and serialise the result (requires `--allow-read`):

```ts
import { overlayFiles } from '@skmtc/openapi-overlays'

const yaml = await overlayFiles('openapi.yaml', 'overlay.yaml')
const json = await overlayFiles('openapi.yaml', 'overlay.yaml', { format: 'json' })
```

Unlike the reference tool — which only emits YAML — this port can output **YAML or JSON**. Both
formats order well-known OpenAPI fields consistently. To serialise an already-overlaid document
(e.g. from `applyOverlay`), use `stringifyDocument(document, 'json' | 'yaml')`.

## Behaviour notes

- **Updates merge**, they don't replace. Objects are deep-merged and arrays are **appended**
  (`mergician({ appendArrays: true })` semantics). To inject a `$ref` cleanly over an inline schema,
  `remove` it first, then add it via the parent node — see the test suite for a worked example.
- **`remove`** deletes every node matching the JSONPath `target`, re-querying after each deletion so
  array index shifts and recursive descent (`$..foo`) behave correctly.
- Merging an update into a **primitive** value is a no-op (the value is left unchanged), matching
  the reference tool.
- An overlay document with no `actions` is a no-op.
- By default a **failed action is logged and skipped** (reference behaviour). Pass
  `{ strict: true }` to `applyOverlay`/`overlayFiles` — or `--strict` on the CLI — to throw instead,
  so a build can't silently ship an un-applied overlay. An action whose target simply matches
  nothing is never an error.

## CLI

```bash
deno task overlay --openapi openapi.yaml --overlay overlay.yaml
# or directly
deno run --allow-read cli.ts --openapi openapi.yaml --overlay overlay.yaml

# JSON output
deno task overlay --openapi openapi.yaml --overlay overlay.yaml --json
deno task overlay --openapi openapi.yaml --overlay overlay.yaml --format json

# Fail the build if any action doesn't apply
deno task overlay --openapi openapi.yaml --overlay overlay.yaml --strict
```

When `--format` is omitted, the output format is inferred from the `--openapi` file extension
(`.json` → JSON, otherwise YAML).

## Develop

```bash
deno task test     # run the test suite (--allow-read)
```
