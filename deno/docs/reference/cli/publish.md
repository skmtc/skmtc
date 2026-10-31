# skmtc publish

> The old name of [`skmtc deploy`](deploy.md), kept for one release.

`skmtc publish <project> …` runs the same code as `skmtc deploy`, with the
same options, output and exit codes. First it prints one line on stderr:

```
`skmtc publish` is now `skmtc deploy`
```

The line goes to stderr, so with `--json` stdout stays one JSON document.

A stack is deployed, not published: `deploy` stores the new version on the
hub and deploys it in one step. A later release removes `publish`. Change
scripts and CI jobs to `skmtc deploy`.

## Synopsis

```
skmtc publish <project> --token <pat> [--version <semver>] [--existing] [--env <env>] [--json] [--no-input]
```

The options, the JSON output, the failure stages and the exit codes are
on the [deploy](deploy.md) page.

## See also

- [deploy](deploy.md) — store a stack version and deploy it
- [overview](overview.md) — shared flags and strict-mode semantics
