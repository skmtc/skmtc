---
id: author-model-generator
fixture: author-model-generator
docs:
  - deno/docs/skills/skmtc-generator/SKILL.md
  - deno/docs/skills/skmtc-lang-typescript/SKILL.md
  - deno/docs/skills/skmtc-cli/SKILL.md
maxTurns: 60
graders:
  - kind: run-command
    cmd: skmtc
    args: ['bundle', 'lab', '--json']
  - kind: run-command
    cmd: skmtc
    args: ['generate', 'lab', '--json']
  - kind: file-exists
    path: app/src/types/Pet.generated.ts
  - kind: file-contains
    path: app/src/types/Pet.generated.ts
    pattern: 'export type Pet'
  - kind: file-contains
    path: app/src/types/Order.generated.ts
    pattern: 'export type Order'
  - kind: run-command
    cmd: deno
    args: ['check', 'app/src/types/Pet.generated.ts', 'app/src/types/Order.generated.ts']
---
This workspace contains an SKMTC root (the .skmtc/ directory) with an
initialized but empty project named `lab`, and schema.json — an
OpenAPI document with two component schemas (Pet, Order). The skmtc
CLI is installed and working.

Author a local SKMTC generator, from scratch, that emits one
TypeScript type alias per schema model:

- Package name: `@acme/gen-types`
- For each model in components.schemas, emit a file at
  `@/types/<RefName>.generated.ts` (so Pet lands at
  app/src/types/Pet.generated.ts) containing an exported type alias
  named exactly after the model (e.g. `export type Pet = { ... }`).
  Model property types map to TypeScript equivalents; non-required
  properties are optional.
- Wire the generator into the `lab` project so `skmtc bundle lab`
  and `skmtc generate lab` succeed and produce the files.

Environment facts (registry state, not derivable from the docs): pin
`@skmtc/core` to `jsr:@skmtc/core@0.23.2` and `@skmtc/lang-typescript`
to `jsr:@skmtc/lang-typescript@0.12.8` wherever your generator source
needs them. Other bare specifiers you use must also be pinned in the
generator's deno.json (e.g. `@std/path`: `jsr:@std/path@^1.1.2`).

When done, run the generation to confirm output, and summarize what
you built in your final answer.
