# @skmtc/swagger2openapi

Convert **Swagger 2.0** definitions to **OpenAPI 3.0.x** and validate the result.

A Deno / TypeScript port of [swagger2openapi](https://github.com/Mermade/swagger2openapi) by Mike
Ralphson (BSD-3-Clause). The companion to [`@skmtc/openapi-down-convert`](../openapi-down-convert)
(which goes the other way, 3.1 → 3.0).

## Design

The conversion itself is **synchronous** — it is pure in-memory object manipulation. Asynchrony only
appears where there is genuine I/O:

| Function                          | Sync? | Use it for                                  |
| --------------------------------- | ----- | ------------------------------------------- |
| `convertObj(doc, options)`        | ✅    | An already-parsed document                  |
| `convertStr(text, options)`       | ✅    | A JSON or YAML string                       |
| `convertObjResolve(doc, options)` | ⏳    | A document with external `$ref`s to resolve |
| `convertFile(path, options)`      | ⏳    | Reading + converting a local file           |
| `convertUrl(url, options)`        | ⏳    | Fetching + converting a remote document     |
| `convertStream(stream, options)`  | ⏳    | Converting a readable stream                |

`convertObj` throws if `options.resolve` is set — reach for `convertObjResolve` (or the file/url
wrappers) when you need external references pulled in.

## Usage

```ts
import { convertObj } from '@skmtc/swagger2openapi'

const { openapi } = convertObj(swaggerDocument, { patch: true })
```

```ts
import { convertFile } from '@skmtc/swagger2openapi'

const { openapi } = await convertFile('./swagger.yaml', { patch: true, resolve: true })
```

### Validation

```ts
import { validateSync, ValidationError } from '@skmtc/swagger2openapi'

try {
  validateSync(openapi, {}) // returns true, or throws ValidationError
} catch (err) {
  if (err instanceof ValidationError) console.error(err.message, err.context)
}
```

Validation combines a large set of targeted structural checks (each raising a `ValidationError`
annotated with the JSON-Pointer where the problem was found) with full JSON-Schema validation
against the bundled OpenAPI 3.0 schema (via `ajv` + `ajv-draft-04`).

### Linting

```ts
import { validateSync } from '@skmtc/swagger2openapi'

const options = { lint: true }
validateSync(openapi, options)
console.log(options.violations) // [{ rule, description, pointer }, ...]
```

Unlike the original — which aborted on the first lint failure — linting here **collects** violations
onto `options.violations` and lets validation continue.

## Key options

- `patch` — repair small, recoverable errors instead of throwing.
- `warnOnly` — record non-patchable problems as `x-s2o-warning` extensions.
- `resolve` — resolve external `$ref`s before converting (async paths only).
- `origin` — record an `x-origin` provenance entry.
- `debug` — emit `x-s2o-*` extensions describing the conversion.

## Differences from the upstream package

- Modern, mostly-synchronous API — `call-me-maybe`, `co`, `node-fetch` and the node callback style
  are gone; `js-yaml` → `@std/yaml`, `ajv@5` → `ajv@8` + `ajv-draft-04`.
- The CLI and the corpus `testRunner` harness are not ported; the test suite uses native
  `Deno.test`.
- The linter reports rather than aborts (see above).

## Development

```bash
deno task test        # run the test suite
deno fmt && deno lint # format + lint
deno check mod.ts     # type-check
```
