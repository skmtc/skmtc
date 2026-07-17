export type ProducerKind = 'projection' | 'snippet'

export type ClassReport = {
  className: string
  file: string
  extendsName: string | undefined
  kind: ProducerKind | 'other'
  extraMethods: string[]
  lines: number
  sizeBucket: number
}

export type ContainerProducer = {
  className: string
  containerProps: string[]
  mutatorMethods: string[]
}

export type AccumulatorReport = {
  verdict: boolean
  signals: string[]
  containerProducers: ContainerProducer[]
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
  accumulatorExempt: { className: string; kind: ProducerKind; extraMethods: string[] }[]
}

export type CodeSite = {
  file: string
  site: string
  line: number
  text?: string
}

export type ToStringViolation = {
  className: string | undefined
  file: string
  line: number
  kind: 'assignment' | 'mutation' | 'register-call'
  detail: string
}

export type RuntimeViolation = {
  file: string
  site: string
  line: number
  category: 'node-ism' | 'fs' | 'network' | 'timer' | 'async'
  detail: string
}

export type RegistrationChannels = {
  insertOperation: number
  insertModel: number
  insertNormalizedModel: number
  defineAndRegister: number
  rawDefinitionRegisters: CodeSite[]
}

// ---------------------------------------------------------------------
// Facts — the output of the single shared AST pass (src/parse.ts).
// Check modules are pure functions over PackageFacts.
// ---------------------------------------------------------------------

export type StringBucket = 'toString' | 'naming' | 'outside'

export type ClassFacts = {
  className: string
  file: string
  extendsName: string | undefined
  extendsFactoryCall: boolean
  methods: string[]
  lines: number
  containerProps: string[]
  mutatorMethods: string[]
}

export type FileFacts = {
  file: string
  classes: ClassFacts[]
  projectionBaseConsts: string[]
  snippetImports: string[]
  peerProjectionImports: string[]
  helperFunctions: string[]
  usesDefineAndRegister: boolean
  usesFindDefinition: boolean
  stringSites: Map<string, { count: number; chars: number; bucket: StringBucket }>
  toStringViolations: ToStringViolation[]
  adHocToStringSites: CodeSite[]
  asCastSites: CodeSite[]
  insertCalls: {
    insertOperation: number
    insertModel: number
    insertNormalizedModel: number
    defineAndRegister: number
  }
  rawDefinitionRegisters: CodeSite[]
  templateImportSites: CodeSite[]
  todoSites: CodeSite[]
  runtimeViolations: RuntimeViolation[]
}

export type PackageFacts = {
  dir: string
  packageName: string | undefined
  denoJsonParseError: boolean
  fileCount: number
  files: FileFacts[]
  classes: ClassReport[]
  producers: ClassReport[]
  helperFunctions: string[]
  accumulator: AccumulatorReport
}

// ---------------------------------------------------------------------
// The assembled per-generator report (one entry per check module).
// ---------------------------------------------------------------------

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
  accumulator: AccumulatorReport
  producerSizes: { bucket: number; count: number }[]
  toStringPurity: { pass: boolean; violations: ToStringViolation[] }
  adHocToString: { pass: boolean; sites: CodeSite[] }
  asCasts: { count: number; sites: CodeSite[] }
  registrationChannels: RegistrationChannels
  templateImports: { pass: boolean; sites: CodeSite[] }
  emittedTodos: { count: number; sites: CodeSite[] }
  runtimeDiscipline: { pass: boolean; violations: RuntimeViolation[] }
  aggregate: {
    verdict: 'clean' | 'warn' | 'fail'
    failedChecks: string[]
    warningCount: number
    warnings: {
      flaggedProducers: number
      asCasts: number
      rawDefinitionRegisters: number
      emittedTodos: number
      otherClasses: number
      outsideShareHigh: boolean
    }
  }
}
