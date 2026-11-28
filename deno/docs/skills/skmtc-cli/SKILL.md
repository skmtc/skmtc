---
name: skmtc-cli
version: 0.6.0
description: |
  Run the Skmtc CLI: create a project, install or clone generators
  from JSR, set the schema source and enrichments, and generate code
  from an OpenAPI v3 or GraphQL SDL document. Use when the user asks
  to run skmtc, to generate code from an OpenAPI document, to install
  or customize a generator, to configure enrichments, to use Skmtc in
  CI, or to deploy a stack to skmtc-hub. The CLI carries its own guide
  (`skmtc guide`), and this skill says how to reach it. To write or
  change generator source, use `skmtc-generator`.
allowed-tools:
  - Bash(skmtc:*)
  - Read
  - Glob
  - Grep
  - Write
  - Edit
metadata:
  describes:
    '@skmtc/cli': '0.13'
---

# Skmtc CLI

The Skmtc CLI generates code from an OpenAPI v3 or GraphQL SDL
document. The CLI carries its own guide, so what you read matches the
version that is installed. This skill tells you how to reach it.

## Steps

1. **Check the CLI.** `skmtc --version` prints a version. If the
   command is missing, install it:
   `curl -fsSL https://skmtc.dev/install | sh` (on Windows, in
   PowerShell: `irm https://skmtc.dev/install.ps1 | iex`).
2. **Read the workspace.** `skmtc agent-context --json` gives the
   projects, each command with its flags, and the topics of the guide.
3. **Read the topic for the job.** `skmtc guide` lists the topics, and
   `skmtc guide <topic>` prints one. Read `skmtc guide contract`
   first: it has the input modes, the exit codes and how to read an
   error. Then read the topic of your task, such as
   `skmtc guide setup`, `skmtc guide enrichments` or
   `skmtc guide deploy`.
4. **Run each command with `--json`.** `skmtc --help` lists the
   commands, and `skmtc <cmd> -h` gives the flags of one.

If `skmtc guide` is not a command, the CLI is older than 0.12. Install
it again with the line in step 1.

## Rules

- **A generated file is output.** Change the config or the generator,
  and run `skmtc generate` again.
- **Check before you fix.** When a run gives no output, wrong output
  or an error, run `skmtc doctor --json`, and read the manifest and
  the parse issues, before you propose a change.
- **Generator source is another skill.** To write or change a `.ts`
  file under `.skmtc/<project>/<gen-name>/`, follow `skmtc-generator`.
