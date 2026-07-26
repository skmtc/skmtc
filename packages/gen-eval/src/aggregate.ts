import type { GeneratorReport } from './types.ts'

/**
 * The per-generator aggregate — a DEFECT aggregate, not a quality
 * score. Zero defects = clean. No weighting: pass/fail check failures
 * are listed by id; warning sites are counted per site. The single
 * threshold (outside-share >= 0.5) is deliberate and documented.
 * Docs: docs/aggregate.md
 */

export type AggregateVerdict = 'clean' | 'warn' | 'fail'

export type Aggregate = {
  verdict: AggregateVerdict
  failedChecks: string[]
  warningCount: number
  warnings: {
    flaggedProducers: number
    asCasts: number
    redundantRefGuards: number
    rawDefinitionRegisters: number
    emittedTodos: number
    otherClasses: number
    outsideShareHigh: boolean
  }
}

export const OUTSIDE_SHARE_THRESHOLD = 0.5

export const toAggregate = (report: Omit<GeneratorReport, 'aggregate'>): Aggregate => {
  const failedChecks: string[] = []
  if (!report.structure.pass) failedChecks.push('structure')
  if (!report.topLevelProjection.pass && !report.topLevelProjection.exempt) {
    failedChecks.push('top-level-projection')
  }
  if (!report.toStringPurity.pass) failedChecks.push('tostring-purity')
  if (!report.adHocToString.pass) failedChecks.push('adhoc-tostring')
  if (!report.templateImports.pass) failedChecks.push('template-imports')
  if (!report.runtimeDiscipline.pass) failedChecks.push('runtime-discipline')
  if (!report.singleDispatch.pass) failedChecks.push('single-dispatch')

  const warnings = {
    flaggedProducers: report.methodDiscipline.flagged.length,
    asCasts: report.asCasts.count,
    redundantRefGuards: report.redundantRefGuards.count,
    rawDefinitionRegisters: report.registrationChannels.rawDefinitionRegisters.length,
    emittedTodos: report.emittedTodos.count,
    otherClasses: report.classTotals.other,
    outsideShareHigh: report.strings.outsideShare >= OUTSIDE_SHARE_THRESHOLD
  }
  const warningCount =
    warnings.flaggedProducers +
    warnings.asCasts +
    warnings.redundantRefGuards +
    warnings.rawDefinitionRegisters +
    warnings.emittedTodos +
    warnings.otherClasses +
    (warnings.outsideShareHigh ? 1 : 0)

  const verdict: AggregateVerdict =
    failedChecks.length > 0 ? 'fail' : warningCount > 0 ? 'warn' : 'clean'

  return { verdict, failedChecks, warningCount, warnings }
}

export const formatAggregate = (aggregate: Aggregate): string => {
  if (aggregate.verdict === 'fail') {
    return `FAIL(${aggregate.failedChecks.length}F${aggregate.warningCount > 0 ? `+${aggregate.warningCount}W` : ''})`
  }
  if (aggregate.verdict === 'warn') {
    return `warn(${aggregate.warningCount})`
  }
  return 'clean'
}
