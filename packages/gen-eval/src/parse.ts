import ts from 'typescript'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type {
  ClassFacts,
  ClassReport,
  CodeSite,
  FileFacts,
  PackageFacts,
  ProducerKind,
  StringBucket
} from './types.ts'

const PROJECTION_BASE_FACTORY = /^to[A-Z]\w*ProjectionBase$/
const SNIPPET_BASE_NAME = /(^|[a-z0-9])(Snippet|SnippetBase)$/i
const PEER_PROJECTION_NAME = /Projection$/
const NAMING_STATICS = new Set(['toExportPath', 'toIdentifierName', 'toPackageName'])
const CONTAINER_CONSTRUCTORS = /^(Map|Set|WeakMap|WeakSet|Array)$/
const MUTATOR_VERBS = new Set(['push', 'add', 'set', 'unshift', 'splice', 'delete'])
const REGISTER_FAMILY = new Set([
  'register',
  'registerInto',
  'insertOperation',
  'insertModel',
  'insertNormalizedModel',
  'defineAndRegister'
])
// A mutation like `this.list.values.push(route)` marks `list` as a
// container regardless of how it was initialized (literal, new Map(),
// or a builder call like List.toArray([])).
const MUTATION_PATH = /this\.(\w+)(?:\.\w+|\[[^\]]*\])*\.(?:push|add|set|unshift|splice|delete)\(/g

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

const isContainerInit = (expression: ts.Expression): boolean =>
  ts.isArrayLiteralExpression(expression) ||
  ts.isObjectLiteralExpression(expression) ||
  (ts.isNewExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    CONTAINER_CONSTRUCTORS.test(expression.expression.text))

const collectContainerProps = (node: ts.ClassDeclaration): string[] => {
  const props: string[] = []
  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member) && member.initializer && isContainerInit(member.initializer)) {
      props.push(member.name.getText())
    }
    if (ts.isConstructorDeclaration(member) && member.body) {
      for (const statement of member.body.statements) {
        if (
          ts.isExpressionStatement(statement) &&
          ts.isBinaryExpression(statement.expression) &&
          statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(statement.expression.left) &&
          statement.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
          isContainerInit(statement.expression.right)
        ) {
          props.push(statement.expression.left.name.text)
        }
      }
    }
  }
  return [...new Set(props)]
}

const findMutations = (
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
): { mutatorMethods: string[]; mutatedProps: string[] } => {
  const mutatorMethods: string[] = []
  const mutatedProps: string[] = []
  for (const member of node.members) {
    if (!ts.isMethodDeclaration(member) || !member.body) continue
    const name = member.name.getText(sourceFile)
    if (name === 'toString') continue
    const matches = [...member.body.getText(sourceFile).matchAll(MUTATION_PATH)]
    if (matches.length > 0) {
      mutatorMethods.push(name)
      for (const match of matches) {
        const prop = match[1]
        if (prop !== undefined) mutatedProps.push(prop)
      }
    }
  }
  return { mutatorMethods, mutatedProps: [...new Set(mutatedProps)] }
}

const parseFile = (path: string, genDir: string): FileFacts => {
  const text = readFileSync(path, 'utf8')
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const file = relative(genDir, path)

  const facts: FileFacts = {
    file,
    classes: [],
    projectionBaseConsts: [],
    snippetImports: [],
    peerProjectionImports: [],
    helperFunctions: [],
    usesDefineAndRegister: false,
    usesFindDefinition: false,
    stringSites: new Map(),
    toStringViolations: [],
    adHocToStringSites: [],
    asCastSites: [],
    insertCalls: { insertOperation: 0, insertModel: 0, insertNormalizedModel: 0, defineAndRegister: 0 },
    rawDefinitionRegisters: []
  }

  const lineOf = (node: ts.Node): number =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const siteOf = (node: ts.Node, stack: Frame[]): CodeSite => {
    const owner = enclosingClassName(node)
    const nearest = [...stack].reverse().find(frame => frame.label !== '<anonymous>')
    return {
      file,
      site: `${owner ? `${owner}.` : ''}${nearest?.label ?? '<module>'}`,
      line: lineOf(node)
    }
  }

  const isThisRooted = (expression: ts.Expression): boolean => {
    let current: ts.Expression = expression
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      current = current.expression
    }
    return current.kind === ts.SyntaxKind.ThisKeyword
  }

  const recordString = (stack: Frame[], node: ts.Node): void => {
    const inToString = stack.some(frame => frame.isToString)
    const inNaming = stack.some(frame => frame.isNamingStatic)
    const bucket: StringBucket = inToString ? 'toString' : inNaming ? 'naming' : 'outside'
    const owner = enclosingClassName(node)
    const nearest = [...stack].reverse().find(frame => frame.label !== '<anonymous>')
    const label = `${owner ? `${owner}.` : ''}${nearest?.label ?? '<module>'}`
    const key = `${bucket}|${file}|${label}`
    const existing = facts.stringSites.get(key) ?? { count: 0, chars: 0, bucket }
    existing.count += 1
    existing.chars += node.getText(sourceFile).length
    facts.stringSites.set(key, existing)
  }

  const visit = (node: ts.Node, stack: Frame[]): void => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      const bindings = node.importClause.namedBindings
      if (ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const name = element.name.text
          if (SNIPPET_BASE_NAME.test(name)) facts.snippetImports.push(name)
          if (PEER_PROJECTION_NAME.test(name)) facts.peerProjectionImports.push(name)
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
          facts.projectionBaseConsts.push(declaration.name.text)
        }
        if (
          stack.length === 0 &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          facts.helperFunctions.push(declaration.name.text)
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name && stack.length === 0) {
      facts.helperFunctions.push(node.name.text)
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
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line
      const mutations = findMutations(node, sourceFile)
      facts.classes.push({
        className: node.name.text,
        file,
        extendsName,
        extendsFactoryCall,
        methods,
        lines: endLine - startLine + 1,
        containerProps: [...new Set([...collectContainerProps(node), ...mutations.mutatedProps])],
        mutatorMethods: mutations.mutatorMethods
      })
    }

    const inToString = stack.some(frame => frame.isToString)

    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined
      if (calleeName === 'defineAndRegister') {
        facts.usesDefineAndRegister = true
        facts.insertCalls.defineAndRegister += 1
      }
      if (calleeName === 'findDefinition') facts.usesFindDefinition = true
      if (calleeName === 'insertOperation') facts.insertCalls.insertOperation += 1
      if (calleeName === 'insertModel') facts.insertCalls.insertModel += 1
      if (calleeName === 'insertNormalizedModel') facts.insertCalls.insertNormalizedModel += 1

      if (
        (calleeName === 'register' || calleeName === 'registerInto') &&
        node.arguments.some(
          argument =>
            ts.isObjectLiteralExpression(argument) &&
            argument.properties.some(
              property => property.name?.getText(sourceFile) === 'definitions'
            )
        )
      ) {
        facts.rawDefinitionRegisters.push(siteOf(node, stack))
      }

      if (inToString && calleeName !== undefined && REGISTER_FAMILY.has(calleeName)) {
        const site = siteOf(node, stack)
        facts.toStringViolations.push({
          className: enclosingClassName(node),
          file,
          line: site.line,
          kind: 'register-call',
          detail: `${calleeName}(…) inside toString`
        })
      }

      if (
        inToString &&
        ts.isPropertyAccessExpression(callee) &&
        MUTATOR_VERBS.has(callee.name.text) &&
        isThisRooted(callee.expression)
      ) {
        const site = siteOf(node, stack)
        facts.toStringViolations.push({
          className: enclosingClassName(node),
          file,
          line: site.line,
          kind: 'mutation',
          detail: `${callee.getText(sourceFile)}(…) inside toString`
        })
      }
    }

    if (
      inToString &&
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) &&
      isThisRooted(node.left)
    ) {
      const site = siteOf(node, stack)
      facts.toStringViolations.push({
        className: enclosingClassName(node),
        file,
        line: site.line,
        kind: 'assignment',
        detail: `${node.left.getText(sourceFile)} ${node.operatorToken.getText(sourceFile)} … inside toString`
      })
    }

    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        property =>
          (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) &&
          property.name?.getText(sourceFile) === 'toString'
      )
    ) {
      facts.adHocToStringSites.push(siteOf(node, stack))
    }

    if (ts.isAsExpression(node) && !ts.isConstTypeReference(node.type)) {
      const site = siteOf(node, stack)
      facts.asCastSites.push({
        ...site,
        text: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 80)
      })
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
  return facts
}

const classifyClasses = (files: FileFacts[]): Map<string, ProducerKind> => {
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
    for (const classFacts of allClasses) {
      if (kinds.has(classFacts.className)) continue
      const inherited = classFacts.extendsFactoryCall
        ? 'projection'
        : classFacts.extendsName
          ? kinds.get(classFacts.extendsName)
          : undefined
      if (inherited) {
        kinds.set(classFacts.className, inherited)
        changed = true
      }
    }
  }
  return kinds
}

const toSizeBucket = (lines: number): number => Math.max(50, Math.round(lines / 50) * 50)

const readPackageName = (dir: string): { packageName: string | undefined; parseError: boolean } => {
  const denoJsonPath = join(dir, 'deno.json')
  if (!existsSync(denoJsonPath)) return { packageName: undefined, parseError: false }
  try {
    const config: unknown = JSON.parse(readFileSync(denoJsonPath, 'utf8'))
    if (config && typeof config === 'object' && 'name' in config && typeof config.name === 'string') {
      return { packageName: config.name, parseError: false }
    }
    return { packageName: undefined, parseError: false }
  } catch {
    return { packageName: undefined, parseError: true }
  }
}

export const buildFacts = (dir: string): PackageFacts => {
  const sourceFiles = listSourceFiles(dir)
  const files = sourceFiles.map(path => parseFile(path, dir))
  const kinds = classifyClasses(files)
  const { packageName, parseError } = readPackageName(dir)

  const factsByName = new Map(
    files.flatMap(file => file.classes.map(classFacts => [classFacts.className, classFacts] as const))
  )

  const classes: ClassReport[] = files.flatMap(file =>
    file.classes.map(classFacts => ({
      className: classFacts.className,
      file: classFacts.file,
      extendsName: classFacts.extendsName,
      kind: kinds.get(classFacts.className) ?? 'other',
      extraMethods: classFacts.methods.filter(method => method !== 'toString'),
      lines: classFacts.lines,
      sizeBucket: toSizeBucket(classFacts.lines)
    }))
  )

  const producers = classes.filter(item => item.kind !== 'other')

  // Accumulator detection: a producer holding a mutable container with
  // mutator methods, combined with the defineAndRegister (+findDefinition)
  // shared-aggregate machinery. defineAndRegister alone is NOT enough —
  // it is also the legitimate private-sibling primitive.
  const usesDefineAndRegister = files.some(file => file.usesDefineAndRegister)
  const usesFindDefinition = files.some(file => file.usesFindDefinition)
  const containerProducers = producers
    .map(item => factsByName.get(item.className))
    .filter(classFacts => classFacts !== undefined)
    .filter(classFacts => classFacts.mutatorMethods.length > 0)
    .map(classFacts => ({
      className: classFacts.className,
      containerProps: classFacts.containerProps,
      mutatorMethods: classFacts.mutatorMethods
    }))

  const signals: string[] = []
  if (usesDefineAndRegister) signals.push('defineAndRegister call')
  if (usesFindDefinition) signals.push('findDefinition call')
  for (const container of containerProducers) {
    signals.push(
      `container producer ${container.className} (${container.containerProps.join(', ')}) mutated by ${container.mutatorMethods.join(', ')}`
    )
  }

  return {
    dir,
    packageName,
    denoJsonParseError: parseError,
    fileCount: sourceFiles.length,
    files,
    classes,
    producers,
    helperFunctions: files.flatMap(file => file.helperFunctions.map(name => `${file.file}:${name}`)),
    accumulator: {
      verdict: usesDefineAndRegister && (usesFindDefinition || containerProducers.length > 0),
      signals,
      containerProducers
    }
  }
}
