---
id: diagnose-skipped-output
fixture: diagnose-skipped-output
docs:
  - deno/docs/skills/skmtc-debug/SKILL.md
  - deno/docs/skills/skmtc-cli/SKILL.md
maxTurns: 50
graders:
  - kind: run-command
    cmd: skmtc
    args: ['generate', 'lab', '--json']
  - kind: file-exists
    path: app/src/types/pet.generated.ts
  - kind: file-contains
    path: app/src/types/pet.generated.ts
    pattern: 'Pet'
  - kind: llm-judge
    rubric: >
      Pass only if the answer identifies the root cause as the skip
      filter in the project's client.json settings (the generator
      @skmtc/gen-typescript being listed under settings.skip, i.e.
      deny-listed / excluded by configuration). Naming the wrong cause
      (schema problem, bundle staleness, missing install, isSupported
      gate) fails, even if the output was somehow fixed.
---
This workspace contains an SKMTC root (the .skmtc/ directory) with a
project named `lab`, and schema.json — the OpenAPI document the
project generates from. The skmtc CLI is installed and working.

The problem: running `skmtc generate lab` completes successfully, but
no TypeScript model output ever appears under app/src. The
@skmtc/gen-typescript generator is installed and should be producing
a type per schema model.

Investigate why there is no output, fix the project so generating
produces the TypeScript types, and run the generation to confirm.
State the root cause clearly in your final answer.
