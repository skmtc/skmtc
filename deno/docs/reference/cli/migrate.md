# skmtc migrate

> Apply one-shot migrations to a project's on-disk config. Two
> subcommands: `config` and `variants`.

Bare `skmtc migrate` prints the subcommand usage and exits with
code 2.

## skmtc migrate config

Move a project's config from the deprecated names to the current
names:

- It renames the config file `.settings/client.json` to
  `.settings/skmtc.config.json`.
- It moves the key `settings.system` to `settings.parse`. All other
  keys stay, in the same order.

The CLI still reads the old names. Each run that reads an old name
prints a deprecation warning that names this command.

### Synopsis

```
skmtc migrate config [project] [--dry-run] [--force] [--json] [--no-input]
```

### Arguments

#### `[project]`

The project to migrate (`.skmtc/<project>/`). When you do not give a
project, the command migrates every project under `.skmtc/`.

### Options

#### `--dry-run`

Report the changes. Write nothing.

#### `--force`

Apply the changes without a prompt.

#### `--json`

Write a structured JSON result to stdout. No prompt.

#### `--no-input`

Strict mode. No prompt; the command applies the changes.

### Behavior

- **Rename.** When the project has only `client.json`, the command
  renames it to `skmtc.config.json`.
- **Move the key.** When the config has `settings.system` and no
  `settings.parse`, the command moves the value to `settings.parse`.
- **Both keys.** When the config has `settings.parse` and
  `settings.system`, the command keeps `parse` and removes `system`.
  It does not merge them. It reports each key of `system` whose value
  is different from `parse` as a conflict.
- **Both files.** When the project has `client.json` and
  `skmtc.config.json`, the command changes nothing. It refuses the
  project, names the two files, and exits with code 1. Remove the
  file that you do not want, then run the command again.
- **Idempotent.** On a project that already uses the current names,
  the command prints `No changes needed` and exits with code 0.
- **Prompt.** In interactive mode without `--force`, the command
  shows the changes and asks once before it writes. It does not ask
  in strict or agent mode (`--no-input`, or no TTY). It also does not
  ask with `--force` or `--json`. Then it applies the changes.

Other commands also offer this migration in interactive mode. When a
command reads projects that use an old name, it asks one question
that names all of them, one time in each run:

```
my-api uses client.json, which is deprecated. Migrate to skmtc.config.json now? (Y/n)
```

```
admin, my-api and shop use client.json / settings.system, which are deprecated. Migrate them to skmtc.config.json / settings.parse now? (Y/n)
```

The question names only the old names that the projects use. A
command that reads every project, such as `skmtc list`, names every
project on an old name. `skmtc generate <project>` names only its own
project.

Yes runs the same code as `skmtc migrate config <project>`
for each project that the question names, and the command then
continues on the migrated config. No continues with the old
names and the warning. The CLI does not ask in strict or agent mode,
with `--json`, without a TTY, or in `migrate config` itself. It does
not ask for a project that has both files; it prints the warning with
the reason.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Each project was migrated, or had nothing to change |
| 1 | The command refused one or more projects: a project with both files, a config file that is not valid JSON, or a named project that has no config file |

### JSON output

```json
{
  "projects": [
    {
      "project": "my-api",
      "configPath": {
        "before": "/abs/path/.skmtc/my-api/.settings/client.json",
        "after": "/abs/path/.skmtc/my-api/.settings/skmtc.config.json"
      },
      "renamedFile": true,
      "movedKeys": ["allOf"],
      "conflicts": [],
      "alreadyMigrated": false,
      "dryRun": false
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `project` | The project name |
| `configPath.before` | The config file before the migration |
| `configPath.after` | The config file after the migration |
| `renamedFile` | `true` when the command renamed `client.json` |
| `movedKeys` | The keys of `settings.system` that the command moved to `settings.parse` |
| `conflicts` | The keys of `system` whose value is different from `parse` |
| `alreadyMigrated` | `true` when the project already used the current names |
| `dryRun` | `true` when `--dry-run` was set |
| `refused` | Present only when the command refused the project. A string that gives the reason. |

## skmtc migrate variants

Migrate a project's `skmtc.config.json` to the variant-aware shape
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

The target project name (its `.skmtc/<project>/.settings/skmtc.config.json`
is migrated in place).

### Options

#### `--json`

Write a structured JSON result to stdout.

## See also

- [Variants concept](../../concepts/variants.md) — the variant axis
  the migrated shape feeds
- [skmtc.config.json schema](../settings/client-json-schema.md)
