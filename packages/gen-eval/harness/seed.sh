#!/usr/bin/env bash
# Seed a fresh, isolated SKMTC workspace for a gen-kotlin-jackson
# authoring run: recreate kotlin-person-api's Dtos.kt from its schema.
# Usage: seed.sh <workspace-dir>
set -euo pipefail

WORKSPACE=${1:?usage: seed.sh <workspace-dir>}
HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
# harness/ -> gen-eval -> packages -> skmtc -> skmtc-root. Overridable so
# the harness can run from a worktree checkout (whose walk-up lands in
# .claude/worktrees) while still seeding from the real sibling repos.
SKMTC_ROOT=${SKMTC_ROOT:-$(cd "$HARNESS_DIR/../../../.." && pwd)}
LANG_KOTLIN="$SKMTC_ROOT/skmtc/deno/lang-kotlin"
REF_GENERATORS="$SKMTC_ROOT/skmtc-generators"
PERSON_API="$SKMTC_ROOT/kotlin-person-api"

[ -d "$LANG_KOTLIN" ] || { echo "lang-kotlin not found at $LANG_KOTLIN" >&2; exit 1; }
[ -d "$REF_GENERATORS/gen-typescript" ] || { echo "gen-typescript not found at $REF_GENERATORS" >&2; exit 1; }
[ -d "$REF_GENERATORS/gen-zod" ] || { echo "gen-zod not found at $REF_GENERATORS" >&2; exit 1; }
[ -f "$PERSON_API/openapi.json" ] || { echo "kotlin-person-api not found at $PERSON_API" >&2; exit 1; }

mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# 1. SKMTC project pinned at the app's own schema. basePath is the
#    app's Gradle source root, so `@/com/example/api/dto/Dtos.kt`
#    lands in package com.example.api.dto.
skmtc init lab kotlin-person-api/src/main/kotlin --json > /dev/null
node - <<'EOF'
const { readFileSync, writeFileSync } = require('node:fs')
const path = '.skmtc/lab/.settings/client.json'
const config = JSON.parse(readFileSync(path, 'utf8'))
config.source = './kotlin-person-api/openapi.json'
writeFileSync(path, JSON.stringify(config, null, 2))
EOF

# 2. Vendored lang-kotlin (pre-alpha; not on public JSR) as a workspace
#    member, wired into the project import map
cp -R "$LANG_KOTLIN" .skmtc/lab/lang-kotlin
node - <<'EOF'
const { readFileSync, writeFileSync } = require('node:fs')
const path = '.skmtc/lab/deno.json'
const config = JSON.parse(readFileSync(path, 'utf8'))
config.imports = config.imports ?? {}
config.workspace = ['./lang-kotlin']
writeFileSync(path, JSON.stringify(config, null, 2))
EOF

# 3. The app, under its own name: kotlin-person-api copied straight
#    from the repo (no vendored fork), minus ONLY its Dtos.kt — the
#    file the generator under authoring must recreate. Everything else
#    (app, config, serde seam, controller, services, gradle wiring) is
#    the real app the generated DTOs must satisfy.
rsync -a \
  --exclude '.git' --exclude '.gradle' --exclude '.kotlin' --exclude 'build' \
  --exclude 'src/main/kotlin/com/example/api/dto/Dtos.kt' \
  "$PERSON_API/" kotlin-person-api/

# 4. Reference material (read-only; checksum-pinned):
#    - the target output the generator must recreate,
#    - two stock TypeScript model generators as reference
#      implementations (cross-language: principles, not answers),
#    - the framework monorepo's deno workspace (core engine source,
#      lang packages, concept docs) as a READ-ONLY symlink — so the
#      agent never needs to hunt API surfaces in package caches.
mkdir -p reference
cp "$PERSON_API/src/main/kotlin/com/example/api/dto/Dtos.kt" reference/Dtos.kt
for gen in gen-typescript gen-zod; do
  mkdir -p "reference/$gen"
  cp -R "$REF_GENERATORS/$gen/src" "reference/$gen/src"
  cp "$REF_GENERATORS/$gen/mod.ts" "$REF_GENERATORS/$gen/deno.json" "$REF_GENERATORS/$gen/README.md" "reference/$gen/"
done
ln -s "$SKMTC_ROOT/skmtc/deno" reference/skmtc-deno
# The structural eval the harness grades with, runnable mid-task:
#   node reference/structural-eval/cli.ts --scan .skmtc/lab
# (src only — run transcripts stay out of reach)
# The harness's OWN eval package — never $SKMTC_ROOT's copy: with an
# SKMTC_ROOT override (worktree runs) they can differ, and the agent
# must iterate against the exact eval that grades it.
ln -s "$HARNESS_DIR/../src" reference/structural-eval

# 5. Integrity checksums — the gates disqualify a run that edits these:
#    the schema, the app's build files, every hand-written app source,
#    and the reference target.
{
  shasum -a 256 kotlin-person-api/openapi.json kotlin-person-api/build.gradle.kts \
    kotlin-person-api/settings.gradle.kts kotlin-person-api/gradle.properties reference/Dtos.kt
  find kotlin-person-api/src -type f -print0 | sort -z | xargs -0 shasum -a 256
} > .harness-checksums

echo "seeded: $WORKSPACE"
