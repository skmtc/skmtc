import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageFacts, StructureReport } from '../types.ts'

/** Check 1 — expected file and folder structure. Docs: docs/structure.md */

const EXPECTED_FILES = ['deno.json', 'mod.ts', 'src/mod.ts', 'src/base.ts', 'src/enrichments.ts']

export const runStructure = (facts: PackageFacts): StructureReport => {
  const present: string[] = []
  const missing: string[] = []
  for (const expected of EXPECTED_FILES) {
    if (existsSync(join(facts.dir, expected))) {
      present.push(expected)
    } else {
      missing.push(expected)
    }
  }

  if (facts.denoJsonParseError) missing.push('deno.json (unparseable)')

  const namePass =
    facts.packageName !== undefined && /^@[\w-]+\/gen-[\w-]+$/.test(facts.packageName)
  if (!namePass) missing.push('deno.json#name (@scope/gen-*)')

  return { present, missing, pass: missing.length === 0, packageName: facts.packageName }
}
