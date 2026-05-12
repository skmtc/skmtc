# How to skip or include operations

> Filter which operations or models a generator processes via
> `client.json#settings.include` and `settings.skip`.

## When to use this

- A generator emits files for operations you don't actually want
  (e.g., deprecated endpoints, internal-only paths).
- An opt-in generator (form, table) should run only for specific
  operations, not every supported one.

## Prerequisites

- A SKMTC project with at least one generator installed.
- The operation IDs or refNames you want to filter.

## Steps

### Whole-generator filtering

`include` and `skip` accept generator IDs as strings ("run this
generator on everything supported" / "skip this generator
entirely"):

```jsonc
{
  "settings": {
    "include": [
      "@skmtc/gen-zod",
      "@skmtc/gen-typescript"
    ],
    "skip": []
  }
}
```

With this `include` set non-empty, generators **not mentioned**
are silently excluded. With an empty/absent `include`, all
installed generators run.

### Per-operation filtering

Filter specific operations within a generator:

```jsonc
{
  "settings": {
    "include": [
      "@skmtc/gen-zod",
      {
        "@skmtc/gen-shadcn-form": {
          "/users": ["post"],
          "/orders": ["post", "put"]
        }
      }
    ]
  }
}
```

For `gen-shadcn-form`, only the two listed `(path, method)` pairs
emit. Other supported operations get `result: "skipped"` in the
manifest.

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

Only the `User` and `Order` schema components emit Zod schemas.

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

After regenerating, check the manifest:

```bash
skmtc generate <project> --json | jq '.manifest.files[] |
  select(.result == "skipped") | .destinationPath'
```

Skipped items appear with `result: "skipped"`. Items not handled
by any generator don't appear at all.

## Troubleshooting

- **All operations skipped** — Likely a typo in `include`. The
  match is exact — no wildcards. Check the operation IDs against
  the OAS spec.
- **`skip` ignored** — Confirm `skip` is inside `settings`, not at
  the top level. The `client.json` shape is `{ source, settings:
  { ..., skip } }`.
- **Generator missing from output entirely** — If `include` is
  non-empty but the generator isn't mentioned, it's excluded.
  Either remove `include` (allow all), or add the generator's ID
  to it.

## Related

- [client.json schema reference](../../reference/settings/client-json-schema.md#settingsinclude-optional)
- [Manifest format reference](../../reference/manifest-format.md)
