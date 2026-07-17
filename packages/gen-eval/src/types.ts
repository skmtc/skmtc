export type ProducerKind = 'projection' | 'snippet'

export type ClassReport = {
  className: string
  file: string
  extendsName: string | undefined
  kind: ProducerKind | 'other'
  extraMethods: string[]
}

export type StringSite = {
  site: string
  file: string
  count: number
  chars: number
}

export type StructureReport = {
  present: string[]
  missing: string[]
  pass: boolean
  packageName: string | undefined
}

export type StringsReport = {
  insideToStringCount: number
  insideToStringChars: number
  namingStaticsCount: number
  namingStaticsChars: number
  outsideCount: number
  outsideChars: number
  outsideShare: number
  topOutsideSites: StringSite[]
}

export type MethodDisciplineReport = {
  producers: number
  clean: number
  flagged: { className: string; kind: ProducerKind; extraMethods: string[] }[]
}

export type GeneratorReport = {
  generator: string
  dir: string
  fileCount: number
  structure: StructureReport
  classes: ClassReport[]
  classTotals: { projections: number; snippets: number; other: number }
  producerShare: number
  helperFunctions: string[]
  methodDiscipline: MethodDisciplineReport
  strings: StringsReport
  topLevelProjection: { pass: boolean; exempt: boolean }
  accumulatorPattern: boolean
}
