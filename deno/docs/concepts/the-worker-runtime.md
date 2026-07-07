# The Worker runtime

> How SKMTC generation actually runs: a Deno Worker spawned per
> generation, sandboxed by Deno's permission model, with a strict
> three-message protocol across the host/worker boundary. The Worker
> isn't just an implementation detail — it's where the engine
> physically executes, and the boundary shapes what crosses cleanly
> and what doesn't.

## The one-paragraph essence

When you run `skmtc generate <project>`, the CLI host process spawns
a sandboxed Deno Worker, loaded from the project's `bundle.js` (built
from `worker.ts`). The host posts a `GENERATE` message containing the
parsed-or-string schema document plus settings; the Worker runs the
three-phase engine (Parse → Generate → Render) inside its sandbox;
the Worker posts back `RESULT` with artifacts and manifest; the host
writes files to disk; the Worker terminates. One Worker per
invocation — no warm pool, no state across runs.

## Why a Worker?

Three reasons, in order of importance:

1. **Sandboxing.** Generator source code is third-party. Stock
   generators come from JSR; cloned generators are user-written.
   Running them in the CLI's host process would give them
   unrestricted access to the user's machine. Deno's Worker
   permission model is the cheapest way to constrain what generator
   code can do.

2. **Process isolation.** The engine catches generator errors per
   operation — one bad operation doesn't crash the whole run. But
   "catching" still leaves the host process polluted with whatever
   memory state the failed generator left behind. A Worker is a
   separate JS context; a runaway generator can corrupt the Worker
   without touching the host.

3. **Bundle decoupling.** The Worker loads a project-specific
   `bundle.js` (or the JSR-published equivalent). The host process
   doesn't need to know how to import each generator — it just hands
   the schema to the Worker and gets artifacts back. New generators
   don't require host updates.

## Worker lifecycle

The Worker is one-shot per generate run:

```
skmtc generate runs
     ↓
host: new Worker(bundle.js, { permissions: {...} })
     ↓
worker: posts 'READY' on boot
     ↓
host: posts 'GENERATE' { document, clientSettings }
     ↓
worker: runs toArtifacts (Parse → Generate → Render)
     ↓
worker: posts 'RESULT' { artifacts, manifest }
     ↓
host: writes files to disk, writes manifest.json
     ↓
host: worker.terminate()
```

Every run spawns a fresh Worker. No state carries between runs. This
is intentional — it makes generation deterministic regardless of
history (no stale caches, no leaked mutations). It also keeps the
runtime model simple: there's no "is the Worker still healthy?"
question.

The cost: each generate pays Worker spawn time (~100ms). For one-shot
runs, this is negligible. For `dev` mode (watch-and-regenerate), each
file save spawns a new Worker. Still fast enough; the alternative
(persistent Worker with state cleanup between runs) would add
substantial complexity for marginal speedup.

## The Deno permission model

The Worker is spawned with explicit Deno permissions:

```ts
new Worker(bundleUrl, {
  type: 'module',
  deno: {
    permissions: {
      read: true,
      net: false,
      run: false,
      write: true,
      env: true
    }
  }
})
```

The permissions in plain English:

- **read: true** — the Worker can read schema files from disk.
- **write: true** — the Worker can write generated artifacts.
- **env: true** — the Worker can read environment variables (used
  for things like `JSR_URL`).
- **net: false** — the Worker **cannot** make network requests.
- **run: false** — the Worker **cannot** spawn subprocesses.

The `net` and `run` denials are the load-bearing safety properties.
A malicious or buggy generator can corrupt its own output files
(within the project's `basePath`), but it can't:

- Phone home with telemetry
- Download additional code
- Exfiltrate the user's environment variables to a remote endpoint
- Run arbitrary shell commands
- Read or modify files outside the project

The threat model isn't "defend against a sophisticated attacker."
It's "limit blast radius of an honest mistake or a compromised JSR
package." For that purpose, the Deno permission model is sufficient
and free.

## The bundle

The Worker loads a project-specific `bundle.js` built by
`deno bundle worker.ts -o bundle.js`. The `worker.ts` is itself a
generated file — the CLI templates it from `deno.json#imports`:

```ts
// .skmtc/<project>/worker.ts (templated)
import toWorker from '@skmtc/worker'
import gen1 from '@skmtc/gen-zod'
import gen2 from '@skmtc/gen-typescript'
import gen3 from './gen-shadcn-form/mod.ts'  // local clone

export default toWorker(() =>
  Object.fromEntries([gen1, gen2, gen3].map(g => [g.id, g]))
)
```

The template:

- Default-imports `toWorker` from `@skmtc/worker` (the engine wrapper)
- Imports each installed generator (JSR or local path)
- `export default toWorker(() => …)` with the generators keyed by `g.id`

`deno bundle` then resolves all imports (JSR + local) into a single
JS file. This is what the Worker spawns.

### One bundle path for every project

`skmtc bundle` always builds the project-local `bundle.js` — it is
the only artifact `generate` loads. Generator source enters the
bundle either as a `jsr:` specifier (installed) or a relative path
(cloned / locally authored); `deno bundle` resolves both through the
project's import map. (Older CLI versions no-op'd on remote-only
projects, which left pure-install projects unable to generate; that
special case is gone.)

### Bundle freshness

A subtle invariant: `worker.ts` and `bundle.js` are derived from
`deno.json#imports`. If you hand-edit `deno.json` (e.g., add a
generator without going through `skmtc install`), the `worker.ts`
becomes stale. Strict-mode `generate` refuses with a recipe error
pointing at `skmtc bundle`.

The `skmtc doctor` command surfaces this as
`project-bundle/<project>` — the check that `worker.ts`'s imports
match `deno.json`'s imports.

## The structured-clone boundary

The host/Worker boundary is `postMessage`, which uses the structured
clone algorithm. This shapes what can cross:

- **Plain JSON-like values cross cleanly**: objects, arrays, strings,
  numbers, booleans, null, undefined, plain objects, Maps, Sets, etc.
- **Class instances do not cross cleanly**: methods are lost; only
  enumerable data properties survive. The class's prototype chain is
  discarded.
- **Cyclic references cross** (structured clone supports them) but
  may be slow.
- **Functions, DOM nodes, Errors with custom prototypes**: not
  cloneable.

This constraint shapes a specific asymmetry in the parse phase:

- **OAS documents are parsed host-side.** The host pre-parses the
  OpenAPI JSON/YAML into a plain object document, runs through
  `@skmtc/convert` for any 2.0 → 3.0 normalization, then posts the
  result. The plain document survives structured clone.

- **GraphQL documents are parsed Worker-side.** The host posts the
  raw SDL string. The Worker calls `parseGqlDocument` itself.
  Why? Because `graphql-js`'s parsed schema objects contain methods
  and prototype chains that structured clone strips — the host
  couldn't pre-parse and post the result without losing information.

See [the GraphQL asymmetry](../explanation/the-graphql-asymmetry.md)
for the full reasoning.

## Message protocol

Three messages cross the boundary in normal operation:

| Direction | Type | Payload |
|---|---|---|
| Worker → Host | `READY` | (none — just an "I'm initialized" signal) |
| Host → Worker | `GENERATE` | `{ document, clientSettings }` |
| Worker → Host | `RESULT` | `{ artifacts, manifest }` |

If the Worker throws unrecoverably, it posts `ERROR` with the
exception details. The host treats this as exit-code-1 territory.

The protocol is intentionally minimal. There's no progress-streaming,
no incremental artifact streaming, no bidirectional question-asking.
Generation is a request/response, period. If a generator needs to
report progress, it does so via `console.log` (which the Worker's
stdout pipe routes to the host's stderr); structured progress
reporting isn't part of the protocol.

## Sandbox API (the remote path)

`skmtc generate` has a remote-execution path via
`GenerateArtifacts.generateWithSandboxApi`. Instead of spawning a
local Worker, the schema is posted to a hosted service. The service
runs the same engine and returns the same `artifacts` / `manifest`.

The remote path:

- Skips local Worker spawn (no Deno-on-the-user's-machine required)
- Uses the SaaS endpoint's bundle, not the user's
- Authenticates via the user's stored token

It's optional and orthogonal to the local Worker model — same
inputs, same outputs, different execution location. Useful for
agents and CI environments that can't or won't install Deno.

## Common questions

### Why doesn't SKMTC use a long-running Worker?

Two reasons:

1. **Determinism.** Each Worker is a fresh JS context. No
   accumulated state, no cache pollution, no order-dependent
   behavior. The output is the same whether you ran 1 generation or
   1000 in this session.

2. **Simplicity.** A long-running Worker needs lifecycle management
   (health checks, restart on crash, cleanup between runs). One-shot
   spawn is dumb but correct.

The cost (Worker spawn time) is small enough that the simplification
wins.

### Can a generator make a network request via the Worker's `read` permission?

No. `read` only grants filesystem access. Network requires `net`,
which is denied. A generator that tries `fetch(...)` will get a
permission error at runtime.

The intentional consequence: generators can't dynamically fetch
schema fragments, external templates, or anything else over the
network. Whatever code they generate has to be derivable from the
inputs they're given.

### Why `env: true`? Couldn't a generator exfiltrate env vars?

Yes, in principle. The threat model assumes generators are trusted
enough to read env vars but not trusted enough to make network
requests. A generator could read `process.env.GITHUB_TOKEN` and
write it into a generated file as a side channel — but it couldn't
send it anywhere on its own.

The `env: true` is needed for legitimate use cases like reading
`JSR_URL` to support private registries. Removing it would break
those flows. The pragmatic stance is "limit network egress; trust
read access to env."

For high-security setups, users can spawn `skmtc generate` in a
container or sandbox that restricts env vars further.

### What happens if the Worker hangs?

The host has no built-in timeout. If a generator goes into an
infinite loop, the host waits indefinitely. In practice this is
rare — generators don't typically have loops with non-terminating
conditions — but it's a real edge case.

Mitigation: run `skmtc generate` with a shell-level timeout if
hanging is a concern (e.g., in CI). The host's `worker.terminate()`
on a normal RESULT or ERROR is the only termination signal.

### Why aren't artifacts streamed?

Structured clone has reasonable throughput for the artifact sizes
SKMTC produces (typically hundreds of files, ~MB total). Streaming
would add complexity (message ordering, partial-write recovery)
without measurable benefit at typical scales.

If schemas grow to the point where artifact assembly is slow,
streaming could be added later. For now, batch-post is fine.

### Can I run the engine without a Worker?

Yes, in principle — `toArtifacts` from `@skmtc/core` is just a
function. You can call it directly in a Deno script without the
Worker layer. The CLI uses the Worker for sandboxing and
isolation; direct calls skip that but also skip sandboxing.

Bench scripts and integration tests sometimes do this. End-user
generation always goes through the Worker.

## Further reading

- [The three phases](the-three-phases.md) — what runs inside the Worker
- [Security model](../explanation/security-model.md) — permissions and threat model in depth
- [The GraphQL asymmetry](../explanation/the-graphql-asymmetry.md) — why GraphQL parses Worker-side
- [Projects and workspaces](projects-and-workspaces.md) — where `bundle.js` and `worker.ts` live
- [Generators as packages](generators-as-packages.md) — how bundles are built
- [API reference: to-artifacts](../reference/api/to-artifacts.md) — the engine entry point
- [`skmtc-cli` skill](../skills/skmtc-cli/SKILL.md) — operational guidance including bundle freshness
