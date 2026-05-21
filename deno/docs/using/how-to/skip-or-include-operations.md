# How to skip or include operations

> Filter which operations or models a generator processes via
> `client.json#settings.include` and `settings.skip`.

## When to use this

- A generator produces files for operations you don't actually want
  (e.g., deprecated endpoints, internal-only paths).
- An opt-in generator (form, table) should run only for specific
  operations, not every supported one.

## Prerequisites

- A SKMTC project with at least one generator installed.
- The operation IDs or refNames you want to filter.

## Steps

### Whole-generator filtering (`skip`)

A bare generator-ID string in `skip` turns that generator off
entirely:

```jsonc
{
  "settings": {
    "skip": ["@skmtc/gen-msw"]
  }
}
```

`include` is **per-generator**, not a global allow-list. A bare
generator-ID string in `include` is a no-op — the generator runs
default-on regardless — and a generator absent from `include` is
**not** excluded. To restrict a generator to specific operations,
use a per-operation `include` entry (below). To turn a generator
off, use `skip`.

### Per-operation filtering

Filter specific operations within a generator:

```jsonc
{
  "settings": {
    "include": [
      {
        "@skmtc/gen-shadcn-form": {
          "/users": { "post": [] },
          "/orders": { "post": [], "put": [] }
        }
      }
    ]
  }
}
```

For `gen-shadcn-form`, only the listed `(path, method)` pairs run;
other supported operations get `result: "skipped"` in the manifest.
Every other generator is unaffected — `include` only constrains the
generators it names. (The `[]` after each method is the variant
list: `[]` means "every variant"; name variants to narrow further.)

### Per-model filtering

For model generators, the entry shape uses refNames:

```jsonc
{
  "settings": {
    "include": [
      {
        "@skmtc/gen-zod": ["User", "Order"]
      }
    ]
  }
}
```

Only the `User` and `Order` schema components produce Zod schemas.

### Order of evaluation (`isSupported` → `include` → `skip`)

The engine applies filters in this order:

1. **`isSupported`** (generator's capability check, hardcoded in
   the generator's source)
2. **`include`** (allow-list from `client.json`; if non-empty,
   item must match)
3. **`skip`** (deny-list from `client.json`; item is excluded
   even if matched by include)

So an operation present in both `include` and `skip` is **skipped**.

## Verification

After regenerating, check the on-disk manifest's `results` tree
(the `--json` stdout doesn't carry per-item results — those live
only in `.skmtc/<project>/.settings/manifest.json`):

```bash
jq '.results[][].generate
    | to_entries[]
    | { gen: .key, skipped: (.value | to_entries
        | map(select(.value == "skipped"))
        | map(.key)) }' \
  .skmtc/<project>/.settings/manifest.json
```

Each leaf in `results` is one of `success`, `warning`, `error`,
`skipped`, or `notSupported`. `skipped` means an item matched a
generator but was excluded by `client.json` filters;
`notSupported` means the generator's `isSupported` predicate
returned false. See
[manifest format → results](../../reference/manifest-format.md#results)
for the full shape.

## Troubleshooting

- **All operations skipped** — Likely a typo in `include`. The
  match is exact — no wildcards. Check the operation IDs against
  the OAS spec.
- **`skip` ignored** — Confirm `skip` is inside `settings`, not at
  the top level. The `client.json` shape is `{ source, settings:
  { ..., skip } }`.
- **Generator produced nothing** — `include` does not exclude
  unmentioned generators (it is per-generator). If a generator
  emitted nothing, check `skip`, its `isSupported` predicate, or —
  if it has a per-operation `include` entry — whether that entry
  matched any operation.

## Related

- [client.json schema reference](../../reference/settings/client-json-schema.md#settingsinclude-optional)
- [Manifest format reference](../../reference/manifest-format.md)
