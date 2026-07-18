#!/usr/bin/env bash
# Runtime gates over a harness workspace. Ground truth only — no
# judged scoring. Usage: gates.sh <workspace-dir> <out-dir>
set -uo pipefail

WORKSPACE=${1:?usage: gates.sh <workspace-dir> <out-dir>}
OUT=${2:?usage: gates.sh <workspace-dir> <out-dir>}
HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
GEN_EVAL="$HARNESS_DIR/.."
mkdir -p "$OUT"
cd "$WORKSPACE"

REPORT="$OUT/report.md"
PASS_COUNT=0
FAIL_COUNT=0

note() { echo "$1" >> "$REPORT"; }
gate() { # gate <name> <ok|FAIL|skip> <detail>
  if [ "$2" = ok ]; then PASS_COUNT=$((PASS_COUNT + 1)); fi
  if [ "$2" = FAIL ]; then FAIL_COUNT=$((FAIL_COUNT + 1)); fi
  note "| $1 | $2 | $3 |"
}

echo "# Harness gates — $(basename "$(dirname "$OUT/x")")" > "$REPORT"
note ""
note "| gate | result | detail |"
note "|---|---|---|"

# Gate 0 — integrity: the acceptance tests were not touched
if shasum -a 256 -c .harness-checksums > "$OUT/integrity.log" 2>&1; then
  gate integrity ok "test + build files untouched"
else
  gate integrity FAIL "checksum mismatch — see integrity.log (run disqualified)"
fi

# Gate 0b — contamination audit: no tool call reached into forbidden
# paths (other generator implementations, demo apps, previous runs).
# Scans tool_use INPUTS in the transcript — deny rules alone cannot
# stop Bash reads under skip-permissions, so this is the enforcement.
SKMTC_ROOT=$(cd "$HARNESS_DIR/../../../.." && pwd)
if [ -f "$OUT/transcript.jsonl" ]; then
  AUDIT=$(TRANSCRIPT="$OUT/transcript.jsonl" SKMTC_ROOT="$SKMTC_ROOT" node - <<'EOF'
const { readFileSync } = require('node:fs')
const root = process.env.SKMTC_ROOT
const forbidden = [
  `${root}/skmtc-generators`,
  `${root}/.skmtc`,
  `${root}/kotlin-person-api`,
  `${root}/kotlin-demos`,
  `${root}/kotlin-spring-demo`,
  `${root}/csharp-demos`,
  'harness/runs/',
  // Package caches hold published @skmtc/* incl. the Kotlin answers;
  // reference/skmtc-deno is the sanctioned framework source instead.
  '.cache/deno',
  'Library/Caches/deno'
]
// reference/skmtc-deno symlinks the LIVE monorepo: reads are
// sanctioned, mutations disqualify (checksums cannot see them).
const writeTools = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const writeForbidden = [`${root}/skmtc/deno`, 'reference/skmtc-deno']
const hits = []
for (const line of readFileSync(process.env.TRANSCRIPT, 'utf8').split('\n')) {
  let event
  try { event = JSON.parse(line) } catch { continue }
  const content = (event.message ?? {}).content
  if (!Array.isArray(content)) continue
  for (const item of content) {
    if (item && item.type === 'tool_use') {
      const payload = JSON.stringify(item.input ?? {})
      for (const path of forbidden) {
        if (payload.includes(path)) hits.push(`${item.name}: …${path.split('/').pop()}`)
      }
      if (writeTools.has(item.name)) {
        for (const path of writeForbidden) {
          if (payload.includes(path)) hits.push(`${item.name} into framework source: …${path.split('/').pop()}`)
        }
      }
    }
  }
}
if (hits.length) {
  console.log(`FAIL|${hits.length} forbidden access(es): ${[...new Set(hits)].sort().slice(0, 4).join('; ')}`)
} else {
  console.log('ok|no tool call touched forbidden paths')
}
EOF
)
  gate contamination "${AUDIT%%|*}" "${AUDIT#*|}"
else
  gate contamination skip "no transcript.jsonl in out dir"
fi

# Gate 1 — clean regenerate from the bundle (catches hand-written output)
skmtc clean lab --json > "$OUT/clean.json" 2>&1
skmtc generate lab --json > "$OUT/generate.json" 2>&1
GEN_SUMMARY=$(GENERATE_JSON="$OUT/generate.json" node - <<'EOF'
const { readFileSync } = require('node:fs')
let data
try {
  data = JSON.parse(readFileSync(process.env.GENERATE_JSON, 'utf8'))
} catch (error) {
  console.log(`FAIL|unparseable generate output: ${error.message}`)
  process.exit(0)
}
if (data.type !== 'generated' || (data.errors ?? []).length) {
  console.log(`FAIL|type=${data.type} errors=${JSON.stringify(data.errors)}`)
} else {
  const kotlinFiles = (data.files ?? []).filter(file => file.endsWith('.kt'))
  console.log(`ok|${kotlinFiles.length} kotlin file(s)`)
}
EOF
)
gate generate "${GEN_SUMMARY%%|*}" "${GEN_SUMMARY#*|}"

# Gate 2 — target file: the single Dtos.kt exists and declares every
# components.schemas entry (the objective is ONE file, not one per schema)
COVERAGE=$(node - <<'EOF'
const { readFileSync, existsSync } = require('node:fs')
const schemas = Object.keys(JSON.parse(readFileSync('openapi.json', 'utf8')).components.schemas)
const target = 'consumer/src/main/kotlin/com/example/api/dto/Dtos.kt'
if (!existsSync(target)) {
  console.log(`FAIL|${target} was not generated`)
} else {
  const source = readFileSync(target, 'utf8')
  const missing = schemas.filter(
    name => !new RegExp(`(class|interface|typealias)\\s+${name}\\b`).test(source)
  )
  if (missing.length) {
    console.log(`FAIL|Dtos.kt missing ${missing.length}/${schemas.length} declarations: ${missing.slice(0, 6).join(', ')}`)
  } else {
    console.log(`ok|Dtos.kt declares all ${schemas.length} schemas`)
  }
}
EOF
)
gate dtos-file "${COVERAGE%%|*}" "${COVERAGE#*|}"

# Gate 3 + 4 — the whole app compiles against the generated DTOs, and
# the pinned DTO contract test passes
if [ -f consumer/gradle.properties ] && command -v gradle > /dev/null; then
  if (cd consumer && gradle -q compileKotlin --console=plain) > "$OUT/compile.log" 2>&1; then
    gate compile ok "gradle compileKotlin"
    if (cd consumer && gradle -q test --console=plain) > "$OUT/test.log" 2>&1; then
      gate dto-contract ok "gradle test (DtoContractTest)"
    else
      gate dto-contract FAIL "see test.log"
    fi
  else
    gate compile FAIL "see compile.log"
    gate dto-contract skip "compile failed"
  fi
else
  gate compile skip "no JDK/gradle available"
  gate dto-contract skip "no JDK/gradle available"
fi

# Structural eval over the authored generator
node "$GEN_EVAL/src/cli.ts" --scan .skmtc/lab \
  --json "$OUT/structural.json" --md "$OUT/structural.md" > "$OUT/structural.txt" 2>&1
VERDICT=$(STRUCTURAL_JSON="$OUT/structural.json" node - <<'EOF'
const { readFileSync } = require('node:fs')
try {
  const reports = JSON.parse(readFileSync(process.env.STRUCTURAL_JSON, 'utf8'))
  if (!reports.length) {
    console.log('no generator found')
  } else {
    const aggregate = reports[0].aggregate
    const extra = aggregate.failedChecks.length ? ` — failed: ${aggregate.failedChecks.join(', ')}` : ''
    console.log(`${aggregate.verdict} (${aggregate.warningCount} warnings)${extra}`)
  }
} catch (error) {
  console.log(`unavailable: ${error.message}`)
}
EOF
)
FRICTION_COUNT=$([ -f FRICTION.md ] && grep -c '^## ' FRICTION.md || echo 0)
RETRO_STATE=$([ -f RETRO.md ] && echo yes || echo no)
note ""
note "**Feedback channels:** $FRICTION_COUNT friction entr(y/ies) in workspace/FRICTION.md; exit retro: $RETRO_STATE (workspace/RETRO.md)"
note ""
note "**Structural eval:** $VERDICT (details: structural.md)"
note ""
note "Gates passed: $PASS_COUNT, failed: $FAIL_COUNT."
note ""
note "Diagnosis order: report.md -> structural.md -> generate.json ->"
note "test.log -> diff consumer/src/main/kotlin/com/example/api/dto/Dtos.kt"
note "against workspace/reference/Dtos.kt -> transcript.jsonl (search for"
note "the Skill invocation and the first Write of base.ts to see where"
note "the model's plan diverged)."

cat "$REPORT"
[ "$FAIL_COUNT" -eq 0 ]
