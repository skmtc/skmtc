# Security model

> The Worker permissions, the trust boundary, and the threat model.
> What the sandbox protects against — and what it doesn't.

## The question

The engine runs untrusted-ish code: cloned generators may be edited
by anyone on the team, and stock generators come from JSR (a public
registry). When a generator runs, what damage can it do? What's
the security boundary actually protecting?

## The short answer

The Worker is a **soft sandbox** enforced by Deno permissions. It
exists to **limit damage from a bad generator**, not to defeat a
determined attacker. The threat model:

- **Out of scope:** stopping a malicious generator from
  exfiltrating data when the attacker controls the JSR publish
  pipeline.
- **In scope:** preventing a generator with a bug or a minor
  vulnerability from making arbitrary network calls, spawning
  subprocesses, or writing outside the project.

The Worker has `read`, `write`, and `env` Deno permissions. It
**doesn't** have `net` or `run`. The reasoning behind each
follows.

## The trust boundary

The engine has two processes:

### Host process

The CLI itself. Runs with the user's full permissions: anything
the user could do at the shell, the CLI process can do. Reads
configuration files, spawns the Worker, writes artifacts to disk,
exits with status codes.

The host is trusted in the standard sense — it's the binary the
user installed and invoked.

### Worker process

The codegen process. Spawned by the host via `new Worker(...)`
with explicit reduced permissions. Receives the parsed document
and generator map; produces the artifacts and manifest; sends
them back.

The Worker is **partially trusted**. The user installed (or
cloned) the generators it runs, but those generators may include
bugs, unintended behaviors, or — in the worst case —
malicious code. The permissions reflect this distrust.

## Deno permissions granted to the Worker

The Worker spawns with `read: true, write: true, env: true,
net: false, run: false`.

### `read: true`

The Worker can read any file the host process could read. Needed
for:

- Reading template files (generators may include `.txt` /
  `.tmpl` payloads they reference at runtime)
- Reading peer-dependency packages (e.g., a generator that
  imports `@/lib/helper.ts`)
- Reading the project's own configuration if the generator wants
  it

**Why not restrict to the project directory?** Deno's permission
system supports allow-lists for `read`, but the Worker's
exact needs depend on which generators are installed. Restricting
to a specific directory would break generators that need to read
outside it. The trade-off: convenience over precision.

### `write: true`

The Worker can write to any path the host could write. Needed for:

- Writing artifacts to the project's `src/generated/` (or
  wherever `basePath` points)
- Writing the manifest

**Why not restrict?** Same reason as `read`: the exact write
paths depend on the configuration. The Worker writes wherever
the engine tells it to.

### `env: true`

The Worker can read environment variables. Needed for:

- Some generators read env-driven config (e.g., a custom
  scalar map driven by `SKMTC_SCALARS=...`)
- Some generators read `NODE_ENV`-style switches for
  development vs production output style

This is the most contestable permission. Most generators don't
*need* env access, and giving it opens an exfiltration channel
(see [residual risks](#residual-risks)). Tightening this to a
specific allow-list is a possible future direction.

### Denied: `net`

The Worker **cannot** make network calls. This is the most
important denial. It means:

- Generators can't phone home (no telemetry to remote servers)
- Generators can't fetch additional schemas at runtime
- Generators can't exfiltrate read data over the wire

The OAS spec fetch (when `source` is a URL) happens **host-side**,
before the Worker spawns. The Worker never sees the network.

### Denied: `run`

The Worker **cannot** spawn subprocesses. This means:

- Generators can't shell out to other tools
- Generators can't invoke compilers, formatters, or arbitrary
  binaries at generate time
- Generators can't manipulate git state, npm packages, etc.

Combined with `net: false`, the Worker is largely confined to
"transform inputs to outputs via in-memory logic." The damage a
bad generator can do is bounded.

## Residual risks

The permission set isn't airtight. Three notable gaps:

### `env` reads + `write` → exfiltration via git push

A malicious generator could:

1. Read environment variables (`AWS_SECRET`, `DATABASE_URL`, etc.)
2. Write them into a generated file (`/* leaked: $AWS_SECRET */`)
3. The user commits and pushes the file
4. The secrets land in a git history (and possibly a public repo)

The Worker permissions don't prevent this — both reads are
allowed. The mitigations live downstream:

- **Code review** of generator changes (cloned generators are
  inspectable source)
- **Secret scanning in CI** (`git-secrets`, GitHub's built-in
  scanner)
- **Lint rules on the generated output** (rejecting suspicious
  patterns like base64-encoded blobs or env-name substrings)

### Workspace pollution

A generator could write into directories outside the configured
output. For example, overwriting `.gitignore`, the project's
own source files, or even `~/.ssh/`.

The permission system allows this. The mitigations:

- **The manifest records every artifact path.** Post-generate
  inspection catches unexpected writes.
- **Code review.** Cloned generators are short and inspectable;
  stock generators are widely-read.
- **Restricted output directories at the OS level** (rarely
  practical, but possible).

### Read-everything

Even with `write` constrained somehow, `read: true` means the
Worker can read **any** file the user could. Sensitive files in
the working directory (test fixtures with real credentials,
`.env` files, ssh keys in `~/.ssh/`) are technically readable.

The Worker has to write somewhere to surface that read data, so
this combines with the `write` issue above. But the read alone
is a concern for generators that might log read content to
stderr.

## Mitigations

What the project does to make the residual risks tractable:

### Clone-to-customize favors auditable source

Stock generators are MIT-licensed, intentionally small (200-500
lines), and meant to be cloned. Users can read the source before
running it. The lack of an opaque plugin API means there's
nowhere for malicious code to hide.

The contrast with plugin-based systems: a generator with a
plugin API can ship a binary plugin you can't read. SKMTC's
"source-code or nothing" approach makes inspection the default.

### Manifest as forensic record

Every `generate` run produces a `manifest.json` listing every
artifact written. After a generate, comparing the manifest's
paths against `git status` surfaces unexpected writes:

```bash
skmtc generate my-api --json > generate-output.json
jq -r '.files[]' generate-output.json | sort > expected-paths.txt
git status --porcelain | awk '{print $2}' | sort > actual-changes.txt
diff expected-paths.txt actual-changes.txt
```

(`skmtc generate --json` stdout has `files` as a flat top-level
array of paths — no `manifest` wrapper. The on-disk
`manifest.json` uses a different shape; see
[manifest format](../reference/manifest-format.md).)

Discrepancies flag both undesired writes and undesired skips.

### CI-side controls

The Worker's permission constraints aren't the last line of
defense. Several CI patterns add layers:

- **Secret scanning** on generated output before merge
- **Diff review** for generated changes (e.g., requiring a human
  approval on PRs that touch `src/generated/`)
- **Lockfiles** to prevent silent generator updates (pin via
  `deno.lock`)
- **Generator-source review** as part of clone hygiene (review
  any change to a cloned generator's source)

## What SKMTC doesn't protect against

To be explicit about the threat model's limits:

- **Supply-chain attacks on JSR packages.** If an attacker
  compromises a stock generator's JSR publish, users who pull
  the new version run the compromised code. The mitigations are
  generic to the JSR ecosystem (lockfiles, integrity checks),
  not SKMTC-specific.
- **Determined adversaries with code-execution intent.** The
  Worker is a damage-limiting boundary, not a cryptographic one.
  An attacker who controls a generator's source can do anything
  the Worker permissions allow.
- **Bugs in generators that leak secrets.** A generator that
  accidentally includes environment data in its output isn't a
  security failure of the engine — it's a bug in the generator.
  Catching this is the user's responsibility (via review and
  secret scanning).
- **Side-channel attacks** (timing, memory observation, etc.).
  Not in scope.

The model: SKMTC ships a sandbox that's strict enough to make
casual abuse hard, but not strict enough to defeat motivated
attackers. Defense-in-depth at the CI/review layer covers what
the sandbox doesn't.

## Why not a stricter sandbox?

We've considered tighter permissions:

- **Restricted `read` and `write` to specific directories.**
  Possible in principle but fragile in practice. Generator
  authors would need to declare which paths they need, and the
  CLI would need to compose permissions across generators. The
  complexity-to-benefit ratio isn't good.
- **`env: false`.** Possible but breaks scalar-customization
  flows. Could be opt-out per-project as a future improvement.
- **Process isolation beyond Workers** (e.g., Firecracker
  microVMs). Massive complexity increase for a marginal threat
  reduction. Off-roadmap.

The current model is the equilibrium: enough sandboxing to make
the common cases safe, not so much that generator authors fight
the system.

## See also

- [The worker runtime concept](../concepts/the-worker-runtime.md) —
  the operational details of Worker spawning
- [Generators as packages concept](../concepts/generators-as-packages.md) —
  how generators are installed and updated
- [Design philosophy](design-philosophy.md) — "build on the
  substrate" as it applies to Deno permissions
- [Manifest format](../reference/manifest-format.md) — the
  manifest-as-forensic-record surface
