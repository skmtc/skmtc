# skmtc migrate

> Apply one-shot migrations to a project's on-disk config. One
> subcommand today: `variants`.

Bare `skmtc migrate` prints the subcommand usage and exits with
code 2.

## skmtc migrate variants

Migrate a project's `client.json` to the variant-aware shape
introduced in `@skmtc/core@0.5.0`: operation enrichments are wrapped
under the trailing `variant` level, and `skip`/`include` filters are
reshaped for the variant axis. Idempotent — safe to re-run; an
already-migrated file is left unchanged.

### Synopsis

```
skmtc migrate variants <project> [--json]
```

### Arguments

#### `<project>`

The target project name (its `.skmtc/<project>/.settings/client.json`
is migrated in place).

### Options

#### `--json`

Write a structured JSON result to stdout.

## See also

- [Variants concept](../../concepts/variants.md) — the variant axis
  the migrated shape feeds
- [client.json schema](../settings/client-json-schema.md)
