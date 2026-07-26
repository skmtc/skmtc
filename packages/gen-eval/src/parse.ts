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
  RuntimeViolation,
  StringBucket
} from './types.ts'

const PROJECTION_BASE_FACTORY = /^to[A-Z]\w*ProjectionBase$/
const SNIPPET_BASE_NAME = /(^|[a-z0-9])(Snippet|SnippetBase)$/i
const PEER_PROJECTION_NAME = /Projection$/
const NAMING_STATICS = new Set(['toExportPath', 'toIdentifierName', 'toPackageName'])
// Axiom 1 (single dispatch): schema.type decisions belong in the
// generator's SchemaToValueFn router. Router functions are recognised
// by name (toZodValue / toTsValue / toKtValue / schemaToValueFn) or by
// an explicit SchemaToValueFn type annotation; the mapping's metadata
// policies (toIdentifierType, isSupported) may also inspect schema.type
// — they decide what a node is called or whether it is handled, never
// what renders it. Everything else is a third door.
const ROUTER_LABEL = /^to[A-Z]\w*Value$|^schemaToValueFn$/
const DISPATCH_METADATA_LABELS = new Set(['toIdentifierType', 'isSupported'])
const SCHEMA_TYPE_LITERALS = new Set([
  'string', 'integer', 'number', 'boolean', 'array', 'object',
  'union', 'unknown', 'ref', 'custom', 'void', 'null'
])
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

// Template-literal hygiene: import statements belong in register calls,
// never in emitted text.
const TEMPLATE_IMPORT = /^\s*import\b(.*\bfrom\b|\s+['"])/m
const TODO_MARKER = /\b(TODO|FIXME|XXX)\b/
// Deno file-op namespace methods (Deno.env is allowed — the sanctioned
// env read; logs via console/logger are allowed side effects).
const DENO_FS_METHOD = /^(write|read|remove|mkdir|open|create|copy|rename|truncate|link|symlink|stat|lstat)/
const FS_MODULES = new Set(['fs', 'node:fs', 'node:fs/promises', 'fs/promises'])
const TIMER_CALLS = new Set(['setTimeout', 'setInterval'])
const PROMISE_METHODS = new Set(['then', 'catch', 'finally'])

type Frame = {
  label: string
  isToString: boolean
  isNamingStatic: boolean
  isRouter: boolean
  isDispatchMetadata: boolean
}

// Only the code the worker bundle executes: root-level entry files
// (mod.ts) plus src/**. Demo scripts, examples/, scripts/ etc. are out
// of scope — they legitimately do async and fs work.
const listSourceFiles = (dir: string): string[] => {
  const isSource = (entry: string): boolean =>
    /\.tsx?$/.test(entry) &&
    !/\.test\.tsx?$/.test(entry) &&
    !entry.split('/').some(part => part === 'node_modules' || part.startsWith('.'))

  const rootFiles = readdirSync(dir, { encoding: 'utf8' })
    .filter(entry => isSource(entry) && !entry.includes('/'))
    .map(entry => join(dir, entry))
    .filter(path => statSync(path).isFile())

  const srcDir = join(dir, 'src')
  const srcFiles = existsSync(srcDir)
    ? readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
        .filter(isSource)
        .map(entry => join(srcDir, entry))
        .filter(path => statSync(path).isFile())
    : []

  return [...rootFiles, ...srcFiles]
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
    redundantRefGuardSites: [],
    schemaDispatchSites: [],
    insertCalls: { insertOperation: 0, insertModel: 0, insertNormalizedModel: 0, defineAndRegister: 0 },
    rawDefinitionRegisters: [],
    templateImportSites: [],
    todoSites: [],
    runtimeViolations: []
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

    // Construction inside toString: the render tree is built at
    // construction time; toString only reads and interpolates settled
    // state. Any `new` in a toString body — a KtParameterList wrap, an
    // Error for a render-time refusal — is work that belongs in the
    // constructor (refusals fail at generate, not render).
    if (inToString && ts.isNewExpression(node)) {
      const site = siteOf(node, stack)
      facts.toStringViolations.push({
        className: enclosingClassName(node),
        file,
        line: site.line,
        kind: 'construction',
        detail: `new ${node.expression.getText(sourceFile)}(…) inside toString — build the render tree in the constructor`
      })
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

    // --- redundant ref guard: `x.isRef() ? x.resolve() : x` ---
    // `.resolve()` / `.resolveOnce()` are identity (`return this`) on every
    // concrete schema variant, so guarding them with `.isRef()` is noise.
    // Only the exact identity shape is flagged (either branch order);
    // genuine branching on `.isRef()` (e.g. `toRefName()`) never matches.
    if (ts.isConditionalExpression(node)) {
      const { condition, whenTrue, whenFalse } = node
      if (
        ts.isCallExpression(condition) &&
        ts.isPropertyAccessExpression(condition.expression) &&
        condition.expression.name.text === 'isRef'
      ) {
        const subject = condition.expression.expression.getText(sourceFile)
        const isResolveOfSubject = (expression: ts.Expression): boolean =>
          ts.isCallExpression(expression) &&
          ts.isPropertyAccessExpression(expression.expression) &&
          (expression.expression.name.text === 'resolve' ||
            expression.expression.name.text === 'resolveOnce') &&
          expression.expression.expression.getText(sourceFile) === subject
        const isSubject = (expression: ts.Expression): boolean =>
          expression.getText(sourceFile) === subject
        if (
          (isResolveOfSubject(whenTrue) && isSubject(whenFalse)) ||
          (isResolveOfSubject(whenFalse) && isSubject(whenTrue))
        ) {
          const site = siteOf(node, stack)
          facts.redundantRefGuardSites.push({
            ...site,
            text: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 80)
          })
        }
      }
    }

    // --- template hygiene: imports and TODO markers in emitted text ---
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // Strip the opening backtick: TEMPLATE_IMPORT is line-anchored, and
      // the backtick otherwise hides an import on the template's first line.
      const templateText = node.getText(sourceFile).replace(/^`/, '')
      if (TEMPLATE_IMPORT.test(templateText)) {
        facts.templateImportSites.push(siteOf(node, stack))
      }
      const todoMatch = templateText.match(TODO_MARKER)
      if (todoMatch) {
        facts.todoSites.push({ ...siteOf(node, stack), text: todoMatch[0] })
      }
    }

    // --- runtime discipline: valid synchronous Deno; side effects are
    //     logs and register/insert calls only. AST-level detection, so
    //     `await`/`fetch` appearing as TEXT inside emitted template
    //     literals is never flagged. ---
    const pushRuntime = (category: RuntimeViolation['category'], detail: string): void => {
      const site = siteOf(node, stack)
      facts.runtimeViolations.push({ file, site: site.site, line: site.line, category, detail })
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process'
    ) {
      pushRuntime('node-ism', `process.${node.name.text}`)
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      if (name === 'require') pushRuntime('node-ism', 'require(…)')
      if (name === 'fetch') pushRuntime('network', 'fetch(…)')
      if (TIMER_CALLS.has(name)) pushRuntime('timer', `${name}(…)`)
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Deno' &&
      DENO_FS_METHOD.test(node.name.text)
    ) {
      pushRuntime('fs', `Deno.${node.name.text}`)
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      FS_MODULES.has(node.moduleSpecifier.text)
    ) {
      pushRuntime('fs', `import from '${node.moduleSpecifier.text}'`)
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'WebSocket' || node.expression.text === 'XMLHttpRequest')
    ) {
      pushRuntime('network', `new ${node.expression.text}(…)`)
    }
    if (ts.isAwaitExpression(node)) {
      pushRuntime('async', 'await expression')
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Promise'
    ) {
      pushRuntime('async', 'new Promise(…)')
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      PROMISE_METHODS.has(node.expression.name.text) &&
      node.arguments.length > 0 &&
      node.arguments.some(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
    ) {
      pushRuntime('async', `.${node.expression.name.text}(callback)`)
    }
    if (
      isFunctionLike(node) &&
      ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    ) {
      pushRuntime('async', `async ${nameOfFunctionLike(node, sourceFile) ?? '<anonymous>'}`)
    }

    // --- axiom 1: schema-type dispatch sites (switches on `.type`,
    //     comparisons of `.type` against a schema-type literal),
    //     classified by where they sit ---
    const dispatchContext = (): 'router' | 'metadata' | 'outside' =>
      stack.some(frame => frame.isRouter)
        ? 'router'
        : stack.some(frame => frame.isDispatchMetadata)
          ? 'metadata'
          : 'outside'

    if (
      ts.isSwitchStatement(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'type' &&
      // At least one case must test a schema-type literal — a switch over
      // some other `.type` vocabulary (AST kinds, security schemes) is not
      // schema dispatch. Mirrors the guard the comparison form carries.
      node.caseBlock.clauses.some(
        clause =>
          ts.isCaseClause(clause) &&
          ts.isStringLiteralLike(clause.expression) &&
          SCHEMA_TYPE_LITERALS.has(clause.expression.text)
      )
    ) {
      facts.schemaDispatchSites.push({
        ...siteOf(node, stack),
        context: dispatchContext(),
        text: `switch (${node.expression.getText(sourceFile)})`
      })
    }

    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
      const sides = [
        [node.left, node.right],
        [node.right, node.left]
      ] as const
      for (const [accessSide, literalSide] of sides) {
        if (
          ts.isPropertyAccessExpression(accessSide) &&
          accessSide.name.text === 'type' &&
          ts.isStringLiteralLike(literalSide) &&
          SCHEMA_TYPE_LITERALS.has(literalSide.text)
        ) {
          facts.schemaDispatchSites.push({
            ...siteOf(node, stack),
            context: dispatchContext(),
            text: node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 80)
          })
          break
        }
      }
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
      const routerAnnotation =
        ts.isVariableDeclaration(node.parent) &&
        node.parent.type !== undefined &&
        node.parent.type.getText(sourceFile).includes('SchemaToValueFn')
      const frame: Frame = {
        label,
        isToString: label === 'toString',
        isNamingStatic: NAMING_STATICS.has(label),
        isRouter: ROUTER_LABEL.test(label) || routerAnnotation,
        isDispatchMetadata: DISPATCH_METADATA_LABELS.has(label)
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
