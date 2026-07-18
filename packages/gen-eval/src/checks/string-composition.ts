import type { PackageFacts, StringSite, StringsReport } from '../types.ts'

/**
 * Check 4 — string composition happens inside toString(). Template
 * expressions, string concatenation and .join() calls are bucketed by
 * their lexically enclosing function. Docs: docs/string-composition.md
 */

export const runStringComposition = (facts: PackageFacts): StringsReport => {
  let insideToStringCount = 0
  let insideToStringChars = 0
  let namingStaticsCount = 0
  let namingStaticsChars = 0
  let outsideCount = 0
  let outsideChars = 0
  const outsideSites = new Map<string, StringSite>()

  for (const file of facts.files) {
    for (const [key, value] of file.stringSites) {
      if (value.bucket === 'toString') {
        insideToStringCount += value.count
        insideToStringChars += value.chars
      } else if (value.bucket === 'naming') {
        namingStaticsCount += value.count
        namingStaticsChars += value.chars
      } else {
        outsideCount += value.count
        outsideChars += value.chars
        const site = key.split('|')[2] ?? '<module>'
        const existing = outsideSites.get(`${file.file}|${site}`) ?? {
          site,
          file: file.file,
          count: 0,
          chars: 0
        }
        existing.count += value.count
        existing.chars += value.chars
        outsideSites.set(`${file.file}|${site}`, existing)
      }
    }
  }

  const composed = insideToStringChars + outsideChars
  return {
    insideToStringCount,
    insideToStringChars,
    namingStaticsCount,
    namingStaticsChars,
    outsideCount,
    outsideChars,
    outsideShare: composed === 0 ? 0 : outsideChars / composed,
    topOutsideSites: [...outsideSites.values()].sort((a, b) => b.chars - a.chars).slice(0, 8)
  }
}
