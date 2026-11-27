import { printJsonResult } from '@/lib/project-config.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'
import { failWithRecipe, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'
import { initHeadless, InvalidBasePathError, type InitHeadlessResult } from '@/lib/init-headless.ts'
import { ALIAS_FILE_NAMES, type AliasRoot, findAliasRoot, isAliasRoot } from '@/lib/alias-root.ts'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { renderApp } from '@/commands/render-app.tsx'

type RenderInitArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string | undefined
  basePath: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: typeof render
  AppComponent?: typeof App
  findAliasRootFn?: typeof findAliasRoot
}

/** What `init` found about the app's `@/` alias, for its result. */
export type AliasReport = AliasRoot & {
  /** Whether `basePath` is the folder the alias points to. */
  matches: boolean
}

type PrintInitResultOptions = {
  format: 'text' | 'json'
  /** `undefined` when no file of the app states an `@/` alias. */
  alias?: AliasReport
  /** Where `basePath` came from. `alias` when no `basePath` argument was given. */
  basePathFrom?: 'argument' | 'alias'
}

export const renderInit = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  basePath,
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App,
  findAliasRootFn = findAliasRoot
}: RenderInitArgs) => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (mode === 'strict') {
    if (projectName === undefined) {
      return failWithRecipe({
        command: 'init',
        arg: '<projectName>',
        usage: 'skmtc init <projectName> <basePath>',
        example: 'skmtc init my-api ./web/app/src'
      })
    }

    // Generated files import each other through `@/`, so the right basePath
    // is the folder that alias points to. With no argument, that folder is
    // the basePath; with one, the result says whether the two match.
    const aliasRoot = findAliasRootFn({ appRootPath: toAbsoluteRootPath() })
    const resolvedBasePath = basePath ?? aliasRoot?.path

    if (resolvedBasePath === undefined) {
      return failWithRecipe({
        command: 'init',
        arg: '<basePath>',
        usage: 'skmtc init <projectName> <basePath>',
        example: 'skmtc init my-api ./web/app/src',
        discover:
          "basePath is relative to the SKMTC root (the directory containing .skmtc/). It must also equal what the `@` alias resolves to in your consumer app's bundler, since generators emit `@/<subdir>/...` paths. " +
          `skmtc found no \`@/\` alias in ${ALIAS_FILE_NAMES.join(', ')}, so it cannot propose the folder.`
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

    let result: InitHeadlessResult
    try {
      result = await initHeadless({ skmtcRoot, projectName, basePath: resolvedBasePath })
    } catch (error) {
      if (error instanceof InvalidBasePathError) {
        return failWithRecipe({
          command: 'init',
          arg: '<basePath>',
          usage: 'skmtc init <projectName> <basePath>',
          example: 'skmtc init my-api ./web/app/src',
          discover: error.message
        })
      }
      throw error
    }

    printInitResult(result, {
      format: resolveOutputFormat({ jsonFlag }),
      alias:
        aliasRoot === undefined
          ? undefined
          : { ...aliasRoot, matches: isAliasRoot(resolvedBasePath, aliasRoot) },
      basePathFrom: basePath === undefined ? 'alias' : 'argument'
    })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  // A named folder that exists, loaded or not, is never created over: the
  // name argument skips the prompt that checks it (#374).
  if (projectName !== undefined && skmtcRoot.toProjectNames().includes(projectName)) {
    printInitResult({ type: 'existed', projectName }, { format: 'text' })
    Deno.exit(0)
  }

  const initialState: SkmtcState = {
    view: { page: 'create-project', projectName, basePath },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderApp({ renderFn, AppComponent, initialState })
}

/** The line under `basePath` that says how it relates to the `@/` alias, if any does. */
const toAliasLine = (
  result: Extract<InitHeadlessResult, { type: 'created' }>,
  { alias, basePathFrom }: PrintInitResultOptions
): string | undefined => {
  if (alias === undefined) {
    return undefined
  }

  if (basePathFrom === 'alias') {
    return `  It is the folder that "@/" points to (${alias.from}).`
  }

  return alias.matches
    ? undefined
    : `  Warning: "@/" points to "${alias.path}" (${alias.from}), not to "${result.basePath}". ` +
        'Generated files import each other through "@/", so those imports resolve only when ' +
        `the two are one folder. Set settings.basePath to "${alias.path}" in ` +
        `.skmtc/${result.projectName}/.settings/skmtc.config.json, or point "@/" at "${result.basePath}".`
}

export const printInitResult = (
  result: InitHeadlessResult,
  options: PrintInitResultOptions
): void => {
  const { format, alias, basePathFrom } = options

  switch (format) {
    case 'json': {
      // Augment the result with a `nextStep` so an agent always knows
      // what to do next — same pattern as install's `verifyWith`.
      const payload = {
        ...result,
        ...(result.type === 'created' && basePathFrom !== undefined ? { basePathFrom } : {}),
        ...(result.type === 'created' && alias !== undefined ? { alias } : {}),
        nextStep:
          result.type === 'created' ? `skmtc install <generators...> ${result.projectName}` : null
      }
      printJsonResult(payload)
      return
    }
    case 'text': {
      switch (result.type) {
        case 'created': {
          const aliasLine = toAliasLine(result, options)

          console.log(
            `Initialized project "${result.projectName}" at .skmtc/${result.projectName}/`
          )
          console.log(`  basePath: ${result.basePath}`)
          if (aliasLine !== undefined) console.log(aliasLine)
          console.log(`\nNext: skmtc install <generators...> ${result.projectName}`)
          return
        }
        case 'existed': {
          console.log(
            `Project "${result.projectName}" already exists at .skmtc/${result.projectName}/ — nothing to do.`
          )
          return
        }
        default: {
          const _exhaustive: never = result
          throw new Error(`Unhandled init result: ${JSON.stringify(_exhaustive)}`)
        }
      }
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
