# skmtc agent-context

> Print what an agent needs to start work. The output has the projects
> of the workspace, each command with its flags, and the topics of the
> CLI's guide.

`agent-context` is the first command an agent runs. It reads the
workspace and the CLI and changes nothing. [`doctor`](doctor.md) tells
you whether something is wrong. `agent-context` tells you what is there.

## Synopsis

```
skmtc agent-context [--json]
```

The command takes no arguments. It reads the workspace of the current
directory.

## Options

### `--json`

Write one JSON object to stdout. Use it from an agent or a script.
Without `--json`, the command prints the same data as text.

The command has no `--no-input` flag, because it never prompts.

## Output

```jsonc
{
  "cliVersion": "0.12.0",
  "skmtcRootPath": "/path/to/app/.skmtc",
  "globalStateDir": "/home/me/.skmtc",
  "jsrUrl": "https://jsr.io",
  "projects": [
    {
      "name": "petstore",
      "basePath": "src/generated",
      "schemaSource": null,
      "generators": {
        "remote": ["@skmtc/gen-zod"],
        "local": []
      }
    }
  ],
  "deprecations": [],
  "commands": [
    {
      "name": "init",
      "description": "Initialize a new project in current directory",
      "args": ["[projectName]", "[basePath]"],
      "flags": [
        { "flag": "--json", "description": "Emit structured JSON output (implies --no-input)." },
        { "flag": "--no-input", "description": "Disable interactive prompts; fail on missing args." }
      ],
      "agentMode": "full"
    }
  ],
  "guideTopics": [
    {
      "id": "setup",
      "group": "tasks",
      "title": "Setting up Skmtc in a project",
      "summary": "Create a project, install generators and generate"
    }
  ]
}
```

| Key | What it holds |
|---|---|
| `cliVersion` | The version of the CLI that ran. |
| `skmtcRootPath` | The `.skmtc/` folder the CLI reads. |
| `globalStateDir` | `~/.skmtc`, where the hub sign-in is stored. |
| `jsrUrl` | The registry: `JSR_URL` when it is set, with no trailing slash. |
| `projects` | One entry for each folder in `.skmtc/`, sorted by name. |
| `deprecations` | Each deprecated config name that a project uses. |
| `commands` | Each command of the CLI. |
| `guideTopics` | Each topic of the guide. [`skmtc guide <id>`](guide.md) prints one. |

### `projects`

- `basePath` is `settings.basePath` of the project's
  `skmtc.config.json`, or `null`.
- `schemaSource` is the top-level `source` of that file, or `null`
  when the project has none. `skmtc generate <project>` then needs the
  schema as an argument.
- `generators.remote` lists the generators that the project's
  `deno.json` imports from JSR. `generators.local` lists the ones it
  imports from a path: a cloned generator or a local one.

A project can have no `deno.json` or no `skmtc.config.json`, or one
that does not parse. The command still lists that project, with empty
lists and `null` values. `skmtc doctor` reports why.

### `deprecations`

Each entry has `kind` (`configFile` or `settingsKey`), `old`, `new`
and `fix`. The `fix` is the command that migrates the project, for
example `skmtc migrate config my-api`. A project that has both
`client.json` and `skmtc.config.json` gets an entry of kind
`ignoredConfigFile`: skmtc ignores `client.json`, and the `fix`
deletes it. The text output lists the same entries under "Deprecated
config names".

### `commands`

- `args` are usage patterns. You must give `<x>`, you can give `[x]`,
  and `[x...]` takes one or more values.
- `flags` are the flags of the command, as you type them.
- `agentMode` says how the command works for an agent:
  - `full`: it has `--json` and `--no-input`.
  - `json-only`: it has `--json` and never prompts.
  - `none`: it is interactive only.

A subcommand has a name with a space, such as `migrate config`.

### `guideTopics`

The CLI carries a guide: the workspace model, the agent contract, the
config reference and one topic for each common task. Each entry gives
a topic's `id`, its `group`, its `title` and a one-line `summary`.
Read a topic with [`skmtc guide <id>`](guide.md).

## Examples

### Start an agent session

```bash
skmtc agent-context --json
skmtc guide contract
```

### List the generators of one project

```bash
skmtc agent-context --json | jq '.projects[] | select(.name == "my-api") | .generators'
```

## What the output does not have

- The schema document. `schemaSource` says where it is.
- The generated files and the result of the last run. Read
  `.skmtc/<project>/.settings/manifest.json` for those.
- Generator source.
- Tokens. The command does not read `~/.skmtc/auth.json`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | The context was printed. A workspace with no project gives an empty `projects` list. |
| `1` | `JSR_URL` is set to a value that is not a URL. |

The command needs no network.

## See also

- [`skmtc guide`](guide.md) — read a topic of the guide
- [`skmtc doctor`](doctor.md) — checks that pass or fail
- [`skmtc list`](list.md) — the generators of one project
- [How to debug a failing generation](../../using/how-to/debug-failing-generation.md)
- [CLI overview](overview.md)
