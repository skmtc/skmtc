import type { GeneratorReport, PackageFacts } from '../types.ts'
import { runStructure } from './structure.ts'
import { runProducerShare } from './producer-share.ts'
import { runMethodDiscipline } from './method-discipline.ts'
import { runStringComposition } from './string-composition.ts'
import { runTopLevelProjection } from './top-level-projection.ts'
import { runAccumulator } from './accumulator.ts'
import { runProducerSize } from './producer-size.ts'
import { runToStringPurity } from './tostring-purity.ts'
import { runAdHocToString } from './adhoc-tostring.ts'
import { runAsCasts } from './as-casts.ts'
import { runRegistrationChannels } from './registration-channels.ts'
import { runTemplateImports } from './template-imports.ts'
import { runEmittedTodos } from './emitted-todos.ts'
import { runRuntimeDiscipline } from './runtime-discipline.ts'

/** One entry per check module; `doc` names the file under docs/. */
export const CHECKS = [
  { id: 'structure', title: 'Expected file and folder structure', doc: 'structure.md' },
  { id: 'producer-share', title: 'Generator consists primarily of producers', doc: 'producer-share.md' },
  { id: 'method-discipline', title: 'Producers are constructor + toString only', doc: 'method-discipline.md' },
  { id: 'string-composition', title: 'String composition happens inside toString', doc: 'string-composition.md' },
  { id: 'top-level-projection', title: 'A top-level Projection exists', doc: 'top-level-projection.md' },
  { id: 'accumulator', title: 'Evidence-based accumulator detection', doc: 'accumulator.md' },
  { id: 'producer-size', title: 'Producer size buckets', doc: 'producer-size.md' },
  { id: 'tostring-purity', title: 'toString() is pure', doc: 'tostring-purity.md' },
  { id: 'adhoc-tostring', title: 'No ad-hoc { toString } object literals', doc: 'adhoc-tostring.md' },
  { id: 'as-casts', title: 'as-cast count (approval required)', doc: 'as-casts.md' },
  { id: 'registration-channels', title: 'Registration channels (informational)', doc: 'registration-channels.md' },
  { id: 'template-imports', title: 'No import statements in template literals', doc: 'template-imports.md' },
  { id: 'emitted-todos', title: 'TODO markers in emitted text (informational)', doc: 'emitted-todos.md' },
  { id: 'runtime-discipline', title: 'Valid synchronous Deno; side effects are logs + registers', doc: 'runtime-discipline.md' }
] as const

export const runAll = (facts: PackageFacts): GeneratorReport => {
  const producerShare = runProducerShare(facts)
  return {
    generator: facts.packageName ?? facts.dir.split('/').at(-1) ?? facts.dir,
    dir: facts.dir,
    fileCount: facts.fileCount,
    structure: runStructure(facts),
    classes: facts.classes,
    classTotals: producerShare.classTotals,
    producerShare: producerShare.producerShare,
    helperFunctions: producerShare.helperFunctions,
    methodDiscipline: runMethodDiscipline(facts),
    strings: runStringComposition(facts),
    topLevelProjection: runTopLevelProjection(facts),
    accumulator: runAccumulator(facts),
    producerSizes: runProducerSize(facts),
    toStringPurity: runToStringPurity(facts),
    adHocToString: runAdHocToString(facts),
    asCasts: runAsCasts(facts),
    registrationChannels: runRegistrationChannels(facts),
    templateImports: runTemplateImports(facts),
    emittedTodos: runEmittedTodos(facts),
    runtimeDiscipline: runRuntimeDiscipline(facts)
  }
}
