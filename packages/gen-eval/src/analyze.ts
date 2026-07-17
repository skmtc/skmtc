import { buildFacts } from './parse.ts'
import { runAll } from './checks/index.ts'
import type { GeneratorReport } from './types.ts'

/**
 * One shared AST pass (parse.ts → PackageFacts), then each check module
 * under src/checks/ runs as a pure function over the facts. Check docs
 * live in docs/, one file per check (see src/checks/index.ts CHECKS).
 */
export const analyzeGenerator = (dir: string): GeneratorReport => runAll(buildFacts(dir))

export { buildFacts } from './parse.ts'
export { CHECKS, runAll } from './checks/index.ts'
