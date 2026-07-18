#!/usr/bin/env bash
# Seed a fresh, isolated SKMTC workspace for a gen-kotlin-jackson
# authoring run: recreate kotlin-person-api's Dtos.kt from its schema.
# Usage: seed.sh <workspace-dir>
set -euo pipefail

WORKSPACE=${1:?usage: seed.sh <workspace-dir>}
HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
ASSETS="$HARNESS_DIR/assets"
# harness/ -> gen-eval -> packages -> skmtc -> skmtc-root
SKMTC_ROOT=$(cd "$HARNESS_DIR/../../../.." && pwd)
LANG_KOTLIN="$SKMTC_ROOT/skmtc/deno/lang-kotlin"
REF_GENERATORS="$SKMTC_ROOT/skmtc-generators"

[ -d "$LANG_KOTLIN" ] || { echo "lang-kotlin not found at $LANG_KOTLIN" >&2; exit 1; }
[ -d "$REF_GENERATORS/gen-typescript" ] || { echo "gen-typescript not found at $REF_GENERATORS" >&2; exit 1; }
[ -d "$REF_GENERATORS/gen-zod" ] || { echo "gen-zod not found at $REF_GENERATORS" >&2; exit 1; }

mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# 1. SKMTC project + pinned schema. basePath is the consumer's Gradle
#    source root, so `@/com/example/api/dto/Dtos.kt` lands in-package.
skmtc init lab consumer/src/main/kotlin --json > /dev/null
cp "$ASSETS/openapi.json" openapi.json
node - <<'EOF'
const { readFileSync, writeFileSync } = require('node:fs')
const path = '.skmtc/lab/.settings/client.json'
const config = JSON.parse(readFileSync(path, 'utf8'))
config.source = './openapi.json'
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

# 3. Consumer: the kotlin-person-api snapshot WITHOUT its Dtos.kt — the
#    generator under authoring must recreate it. Everything else (app,
#    config, serde seam, controller, services, the pinned contract test)
#    is hand-written consumer code the generated DTOs must satisfy.
cp -R "$ASSETS/kotlin-person-api/." consumer/

# Point gradle at a JDK (homebrew openjdk@21 preferred; else java_home)
JDK_HOME=""
if [ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]; then
  JDK_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
elif JH=$(/usr/libexec/java_home -v 17+ 2>/dev/null); then
  JDK_HOME=$JH
fi
if [ -n "$JDK_HOME" ]; then
  echo "org.gradle.java.home=$JDK_HOME" > consumer/gradle.properties
else
  echo "WARN: no JDK >=17 found — the compile/test gate will be skipped" >&2
fi

# 4. Reference material (read-only; checksum-pinned):
#    - the target output the generator must recreate,
#    - two stock TypeScript model generators as reference
#      implementations (cross-language: principles, not answers).
mkdir -p reference
cp "$ASSETS/reference-Dtos.kt" reference/Dtos.kt
for gen in gen-typescript gen-zod; do
  mkdir -p "reference/$gen"
  cp -R "$REF_GENERATORS/$gen/src" "reference/$gen/src"
  cp "$REF_GENERATORS/$gen/mod.ts" "$REF_GENERATORS/$gen/deno.json" "$REF_GENERATORS/$gen/README.md" "reference/$gen/"
done

# 5. Integrity checksums — the gates disqualify a run that edits these:
#    the schema, the consumer's build files, every hand-written consumer
#    source (incl. the contract test), and the reference target.
{
  shasum -a 256 openapi.json consumer/build.gradle.kts consumer/settings.gradle.kts reference/Dtos.kt
  find consumer/src -type f -print0 | sort -z | xargs -0 shasum -a 256
} > .harness-checksums

echo "seeded: $WORKSPACE"
