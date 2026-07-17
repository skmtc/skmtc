import ts from 'typescript'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type {
  ClassReport,
  GeneratorReport,
  ProducerKind,
  StringSite,
  StringsReport,
  StructureReport
} from './types.ts'

const PROJECTION_BASE_FACTORY = /^to[A-Z]\w*ProjectionBase$/
const SNIPPET_BASE_NAME = /(^|[a-z0-9])(Snippet|SnippetBase)$/i
const PEER_PROJECTION_NAME = /Projection$/
const NAMING_STATICS = new Set(['toExportPath', 'toIdentifierName', 'toPackageName'])
const EXPECTED_FILES = ['deno.json', 'mod.ts', 'src/mod.ts', 'src/base.ts', 'src/enrichments.ts']

type ParsedClass = {
  className: string
  file: string
  extendsName: string | undefined
  extendsFactoryCall: boolean
  methods: string[]
}

type ParsedFile = {
  file: string
  classes: ParsedClass[]
  projectionBaseConsts: string[]
  snippetImports: string[]
  peerProjectionImports: string[]
  helperFunctions: string[]
  usesDefineAndRegister: boolean
  stringSites: Map<string, { count: number; chars: number; bucket: StringBucket }>
}

type StringBucket = 'toString' | 'naming' | 'outside'

type Frame = { label: string; isToString: boolean; isNamingStatic: boolean }

const listSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { recursive: true, encoding: 'utf8' })
  return entries
    .filter(entry => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
    .filter(entry => !entry.split('/').some(part => part === 'node_modules' || part.startsWith('.')))
    .map(entry => join(dir, entry))
    .filter(path => statSync(path).isFile())
}

const nameOfFunctionLike = (node: ts.Node, sourceFile: ts.SourceFile): string | undefined => {
  if (ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
    return node.name.getText(sourceFile)
  }
  if (ts.isConstructorDeclaration(node)) {
    return 'constructor'
  }
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.text
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text
    }
    if (ts.isPropertyAssignment(parent)) {
      return parent.name.getText(sourceFile)
    }
    return undefined
  }
  return undefined
}

const isFunctionLike = (node: ts.Node): boolean =>
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessor(node) ||
  ts.isSetAccessor(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node)

const enclosingClassName = (node: ts.Node): string | undefined => {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isClassDeclaration(current) && current.name) {
      return current.name.text
    }
    current = current.parent
  }
  return undefined
}

const isStringish = (node: ts.Expression): boolean =>
  ts.isStringLiteral(node) ||
  ts.isTemplateExpression(node) ||
  ts.isNoSubstitutionTemplateLiteral(node)

const parseFile = (path: string, genDir: string): ParsedFile => {
  const text = readFileSync(path, 'utf8')
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const file = relative(genDir, path)

  const parsed: ParsedFile = {
    file,
    classes: [],
    projectionBaseConsts: [],
    snippetImports: [],
    peerProjectionImports: [],
    helperFunctions: [],
    usesDefineAndRegister: /\bdefineAndRegister\b/.test(text),
    stringSites: new Map()
  }

  const recordString = (stack: Frame[], node: ts.Node): void => {
    const inToString = stack.some(frame => frame.isToString)
    const inNaming = stack.some(frame => frame.isNamingStatic)
    const bucket: StringBucket = inToString ? 'toString' : inNaming ? 'naming' : 'outside'
    const owner = enclosingClassName(node)
    const nearest = [...stack].reverse().find(frame => frame.label !== '<anonymous>')
    const label = `${owner ? `${owner}.` : ''}${nearest?.label ?? '<module>'}`
    const key = `${bucket}|${file}|${label}`
    const existing = parsed.stringSites.get(key) ?? { count: 0, chars: 0, bucket }
    existing.count += 1
    existing.chars += node.getText(sourceFile).length
    parsed.stringSites.set(key, existing)
  }

  const visit = (node: ts.Node, stack: Frame[]): void => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      const bindings = node.importClause.namedBindings
      if (ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const name = element.name.text
          if (SNIPPET_BASE_NAME.test(name)) parsed.snippetImports.push(name)
          if (PEER_PROJECTION_NAME.test(name)) parsed.peerProjectionImports.push(name)
        }
      }
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        const initializer = declaration.initializer
        if (
          ts.isCallExpression(initializer) &&
          ts.isIdentifier(initializer.expression) &&
          PROJECTION_BASE_FACTORY.test(initializer.expression.text)
        ) {
          parsed.projectionBaseConsts.push(declaration.name.text)
        }
        if (
          stack.length === 0 &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          parsed.helperFunctions.push(declaration.name.text)
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name && stack.length === 0) {
      parsed.helperFunctions.push(node.name.text)
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const heritage = node.heritageClauses?.find(
        clause => clause.token === ts.SyntaxKind.ExtendsKeyword
      )
      const heritageExpression = heritage?.types[0]?.expression
      const extendsName =
        heritageExpression && ts.isIdentifier(heritageExpression)
          ? heritageExpression.text
          : undefined
      const extendsFactoryCall =
        heritageExpression !== undefined &&
        ts.isCallExpression(heritageExpression) &&
        ts.isIdentifier(heritageExpression.expression) &&
        PROJECTION_BASE_FACTORY.test(heritageExpression.expression.text)

      const methods: string[] = []
      for (const member of node.members) {
        if (
          ts.isMethodDeclaration(member) ||
          ts.isGetAccessor(member) ||
          ts.isSetAccessor(member)
        ) {
          methods.push(member.name.getText(sourceFile))
        }
      }
      parsed.classes.push({ className: node.name.text, file, extendsName, extendsFactoryCall, methods })
    }

    const isTemplate = ts.isTemplateExpression(node)
    const isConcat =
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.PlusToken ||
        node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) &&
      (isStringish(node.left) || isStringish(node.right))
    const isJoin =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'join'

    if (isTemplate || isConcat || isJoin) {
      recordString(stack, node)
    }

    if (isFunctionLike(node)) {
      const label = nameOfFunctionLike(node, sourceFile) ?? '<anonymous>'
      const frame: Frame = {
        label,
        isToString: label === 'toString',
        isNamingStatic: NAMING_STATICS.has(label)
      }
      node.forEachChild(child => visit(child, [...stack, frame]))
      return
    }

    node.forEachChild(child => visit(child, stack))
  }

  sourceFile.forEachChild(node => visit(node, []))
  return parsed
}

const classifyClasses = (files: ParsedFile[]): Map<string, ProducerKind> => {
  const kinds = new Map<string, ProducerKind>()
  kinds.set('SnippetBase', 'snippet')
  kinds.set('CustomValue', 'snippet')

  for (const file of files) {
    for (const name of file.snippetImports) kinds.set(name, 'snippet')
    for (const name of file.projectionBaseConsts) kinds.set(name, 'projection')
    for (const name of file.peerProjectionImports) kinds.set(name, 'projection')
  }

  const allClasses = files.flatMap(file => file.classes)
  let changed = true
  while (changed) {
    changed = false
    for (const parsedClass of allClasses) {
      if (kinds.has(parsedClass.className)) continue
      const inherited = parsedClass.extendsFactoryCall
        ? 'projection'
        : parsedClass.extendsName
          ? kinds.get(parsedClass.extendsName)
          : undefined
      if (inherited) {
        kinds.set(parsedClass.className, inherited)
        changed = true
      }
    }
  }
  return kinds
}

const checkStructure = (dir: string): StructureReport => {
  const present: string[] = []
  const missing: string[] = []
  for (const expected of EXPECTED_FILES) {
    if (existsSync(join(dir, expected))) {
      present.push(expected)
    } else {
      missing.push(expected)
    }
  }

  let packageName: string | undefined
  const denoJsonPath = join(dir, 'deno.json')
  if (existsSync(denoJsonPath)) {
    try {
      const config: unknown = JSON.parse(readFileSync(denoJsonPath, 'utf8'))
      if (config && typeof config === 'object' && 'name' in config && typeof config.name === 'string') {
        packageName = config.name
      }
    } catch {
      missing.push('deno.json (unparseable)')
    }
  }

  const namePass = packageName !== undefined && /^@[\w-]+\/gen-[\w-]+$/.test(packageName)
  if (!namePass) missing.push('deno.json#name (@scope/gen-*)')

  return { present, missing, pass: missing.length === 0, packageName }
}

const summarizeStrings = (files: ParsedFile[]): StringsReport => {
  let insideToStringCount = 0
  let insideToStringChars = 0
  let namingStaticsCount = 0
  let namingStaticsChars = 0
  let outsideCount = 0
  let outsideChars = 0
  const outsideSites = new Map<string, StringSite>()

  for (const file of files) {
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

export const analyzeGenerator = (dir: string): GeneratorReport => {
  const sourceFiles = listSourceFiles(dir)
  const parsedFiles = sourceFiles.map(path => parseFile(path, dir))
  const kinds = classifyClasses(parsedFiles)

  const classes: ClassReport[] = parsedFiles.flatMap(file =>
    file.classes.map(parsedClass => {
      const kind = kinds.get(parsedClass.className) ?? 'other'
      const extraMethods = parsedClass.methods.filter(method => method !== 'toString')
      return {
        className: parsedClass.className,
        file: parsedClass.file,
        extendsName: parsedClass.extendsName,
        kind,
        extraMethods
      }
    })
  )

  const projections = classes.filter(item => item.kind === 'projection')
  const snippets = classes.filter(item => item.kind === 'snippet')
  const other = classes.filter(item => item.kind === 'other')
  const producers = [...projections, ...snippets]
  const flagged = producers
    .filter(item => item.extraMethods.length > 0)
    .map(item => {
      const kind: ProducerKind = item.kind === 'projection' ? 'projection' : 'snippet'
      return { className: item.className, kind, extraMethods: item.extraMethods }
    })

  const accumulatorPattern = parsedFiles.some(file => file.usesDefineAndRegister)
  const hasProjection = projections.length > 0

  const structure = checkStructure(dir)

  return {
    generator: structure.packageName ?? dir.split('/').at(-1) ?? dir,
    dir,
    fileCount: sourceFiles.length,
    structure,
    classes,
    classTotals: { projections: projections.length, snippets: snippets.length, other: other.length },
    producerShare: classes.length === 0 ? 0 : producers.length / classes.length,
    helperFunctions: parsedFiles.flatMap(file =>
      file.helperFunctions.map(name => `${file.file}:${name}`)
    ),
    methodDiscipline: {
      producers: producers.length,
      clean: producers.length - flagged.length,
      flagged
    },
    strings: summarizeStrings(parsedFiles),
    topLevelProjection: { pass: hasProjection, exempt: !hasProjection && accumulatorPattern },
    accumulatorPattern
  }
}
