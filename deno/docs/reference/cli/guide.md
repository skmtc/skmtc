# skmtc guide

> Print a topic of the guide that the CLI carries.

The guide is part of the CLI. Thus it describes the version that you
run, and the command needs no network and no project. It holds
what `--help` does not: the workspace model, the agent contract, the
config reference, and one topic for each common task.

## Synopsis

```
skmtc guide [topic] [--json]
```

## Arguments

### `[topic]`

The id of a topic, such as `setup` or `config-shape`. With no topic,
the command lists the topics.

## Options

### `--json`

Write one JSON object to stdout.

The command has no `--no-input` flag, because it never prompts.

## Behavior

### With no topic

The command prints each topic's id and summary, in three groups.

```
$ skmtc guide
Skmtc guide (CLI 0.12.0). Read a topic with: skmtc guide <topic>

concepts
  model              The workspace: root, project, config, bundle and manifest
  contract           Input modes, --json, exit codes and recipe errors
  ...

reference
  config-shape       Every key of skmtc.config.json, annotated
  ...

tasks
  setup              Create a project, install generators and generate
  ...
```

| Group | What its topics hold |
|---|---|
| `concepts` | How the CLI works: the workspace, the agent contract, the bundle, the config. |
| `reference` | Facts to look up: each config key, the filters, the JSON of each command, the `doctor` checks. |
| `tasks` | One job from start to end: setup, enrichments, CI, deploy and others. |

[`skmtc agent-context`](agent-context.md) gives the same list in its
`guideTopics` key.

### With a topic

The command prints the topic as Markdown.

````
$ skmtc guide pin-source
## Pinning the schema source

```bash
skmtc generate <project> <schema> --save --json
```

`--save` writes the schema you pass as `"source"` at the top level of
`.skmtc/<project>/.settings/skmtc.config.json`, and changes no other
key. The file keeps its indent. A relative path is read from the folder
that holds `.skmtc/`, when you pass it and in later runs, so the stored
path works from any folder. After this, `skmtc generate <project>`
works without the schema positional arg. The result has
`savedSource: { source, configPath, changed, stored }`.
...
````

### A topic that does not exist

The command prints a recipe error on stderr and exits with code 2:

```
Error: no guide topic is named "nope"

Usage:   skmtc guide [topic]
Example: skmtc guide setup

Discover valid values: `skmtc guide` lists the topics.
```

## JSON output

### The list

```jsonc
{
  "type": "guide-index",
  "cliVersion": "0.12.0",
  "topics": [
    {
      "id": "setup",
      "group": "tasks",
      "title": "Setting up Skmtc in a project",
      "summary": "Create a project, install generators and generate"
    }
  ]
}
```

### One topic

```jsonc
{
  "type": "guide-topic",
  "cliVersion": "0.12.0",
  "id": "pin-source",
  "group": "tasks",
  "title": "Pinning the schema source",
  "summary": "Store the schema source, so generate needs no schema argument",
  "body": "## Pinning the schema source\n\n1. Edit ..."
}
```

`body` is the Markdown that the text output prints.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | The list or the topic was printed. |
| `2` | No topic has the id that you gave. |

## Where the text is

The source of the topics is `deno/cli/guide/*.md` in the Skmtc
repository. `deno task build-guide` writes them to
`deno/cli/guide/topics.json`, which the CLI imports. A check in
`deno task verify-docs` fails in three cases:

- the JSON is not current;
- a topic names a command that the CLI does not have;
- a page names a topic that does not exist.

## See also

- [`skmtc agent-context`](agent-context.md) — the projects, the
  commands and the list of topics as one JSON object
- [`skmtc doctor`](doctor.md) — checks that pass or fail
- [CLI overview](overview.md)
