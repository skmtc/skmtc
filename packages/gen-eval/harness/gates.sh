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
  gate integrity ok "app sources + build files + schema untouched"
else
  gate integrity FAIL "checksum mismatch — see integrity.log (run disqualified)"
fi

# Gate 0b — contamination audit: no tool call reached into forbidden
# paths (other generator implementations, demo apps, previous runs).
# Scans tool_use INPUTS in the transcript — deny rules alone cannot
# stop Bash reads under skip-permissions, so this is the enforcement.
SKMTC_ROOT=${SKMTC_ROOT:-$(cd "$HARNESS_DIR/../../../.." && pwd)}
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
// Sanctioned framework-source reads (reference/skmtc-deno, the vendored
// lang-kotlin) are legal but each one is time the skills failed to save.
// Counted per tool call and reported as the "source dives" metric.
const diveTools = new Set(['Bash', 'Read', 'Grep', 'Glob'])
const divePattern = /reference\/skmtc-deno|lab\/lang-kotlin/
let dives = 0
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
        // Match the write TARGET only — file content legitimately mentions
        // framework paths (e.g. RETRO.md citing reference/skmtc-deno).
        const target = (item.input ?? {}).file_path ?? (item.input ?? {}).notebook_path ?? ''
        for (const path of writeForbidden) {
          if (target.includes(path)) hits.push(`${item.name} into framework source: …${path.split('/').pop()}`)
        }
      }
      if (diveTools.has(item.name) && divePattern.test(payload)) dives += 1
    }
  }
}
if (hits.length) {
  console.log(`FAIL|${hits.length} forbidden access(es): ${[...new Set(hits)].sort().slice(0, 4).join('; ')}|${dives}`)
} else {
  console.log(`ok|no tool call touched forbidden paths|${dives}`)
}
EOF
)
  SOURCE_DIVES="${AUDIT##*|}"
  AUDIT="${AUDIT%|*}"
  gate contamination "${AUDIT%%|*}" "${AUDIT#*|}"
else
  SOURCE_DIVES="n/a"
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
const schemas = Object.keys(JSON.parse(readFileSync('kotlin-person-api/openapi.json', 'utf8')).components.schemas)
const target = 'kotlin-person-api/src/main/kotlin/com/example/api/dto/Dtos.kt'
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

# Gate 3 — the whole app compiles against the generated DTOs
if command -v gradle > /dev/null; then
  if (cd kotlin-person-api && gradle -q compileKotlin --console=plain) > "$OUT/compile.log" 2>&1; then
    gate compile ok "gradle compileKotlin"
  else
    gate compile FAIL "see compile.log"
  fi
else
  gate compile skip "no gradle available"
fi

# Gate — wire behavior: the app's test suite (DtoContractTest) exercises
# serde round-trips the compile gate cannot see (missing @JsonSerialize,
# enum fallback, read/write-only access all pass compileKotlin).
if command -v gradle > /dev/null; then
  if (cd kotlin-person-api && gradle -q test --console=plain) > "$OUT/test.log" 2>&1; then
    gate dto-contract ok "gradle test"
  else
    gate dto-contract FAIL "see test.log"
  fi
else
  gate dto-contract skip "no gradle available"
fi

# Reference diff (reported, not gated): the generated Dtos.kt against
# the repo's real one. KDoc prose is authored commentary absent from
# the schema, so byte-equality is not demanded — the diff is surfaced
# for inspection instead.
TARGET=kotlin-person-api/src/main/kotlin/com/example/api/dto/Dtos.kt
if [ -f "$TARGET" ]; then
  diff reference/Dtos.kt "$TARGET" > "$OUT/dtos-diff.txt" 2>&1
  DIFF_LINES=$(grep -c '^[<>]' "$OUT/dtos-diff.txt" 2>/dev/null || true)
  # Semantic count: strip comments / blank lines / trailing commas, then
  # compare as order-insensitive line multisets — KDoc prose, banners, and
  # hand-authored declaration order are non-derivable, so only the residue
  # is worth reading.
  SEMANTIC=$(REF=reference/Dtos.kt GEN="$TARGET" NORM_OUT="$OUT/dtos-diff-semantic.txt" node "$HARNESS_DIR/semantic-diff.js")
  DIFF_SUMMARY="raw ${DIFF_LINES:-0} line(s) / semantic ${SEMANTIC:-?} declaration(s) differ from reference/Dtos.kt (dtos-diff.txt, dtos-diff-semantic.txt)"
else
  DIFF_SUMMARY="no generated Dtos.kt to diff"
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
note "**Source dives:** ${SOURCE_DIVES:-n/a} tool call(s) into framework source (reference/skmtc-deno or vendored lang-kotlin) — sanctioned, but each is a fact the skills failed to carry"
note ""
note "**Reference diff:** $DIFF_SUMMARY"
note ""
note "**Feedback channels:** $FRICTION_COUNT friction entr(y/ies) in workspace/FRICTION.md; exit retro: $RETRO_STATE (workspace/RETRO.md)"
note ""
note "**Structural eval:** $VERDICT (details: structural.md)"
note ""
note "Gates passed: $PASS_COUNT, failed: $FAIL_COUNT."
note ""
note "Diagnosis order: report.md -> dtos-diff.txt -> structural.md ->"
note "generate.json -> compile.log -> transcript.jsonl (search for the"
note "Skill invocation and the first Write of base.ts to see where the"
note "model's plan diverged)."

cat "$REPORT"
[ "$FAIL_COUNT" -eq 0 ]
