import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '../components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import {
  failWithInvalidArg,
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import { INSTALL_EXAMPLE, INSTALL_STRICT_USAGE } from '@/lib/install-arguments.ts'
import { installHeadless, type InstallHeadlessResult } from '@/lib/install-headless.ts'

type RenderInstallArgs = {
  skmtcRoot?: SkmtcRoot
  generators: string[] | undefined
  projectName: string | undefined
  /** Positionals that are not generator specifiers, when more than one was given. */
  unrecognized?: string[]
  jsonFlag?: boolean
  noInputFlag?: boolean
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

const DISCOVER_PROJECTS = 'ls .skmtc/  (list existing projects)'

export const renderInstall = async ({
  skmtcRoot: providedSkmtcRoot,
  generators,
  projectName,
  unrecognized = [],
  jsonFlag,
  noInputFlag,
  renderFn = render,
  AppComponent = App
}: RenderInstallArgs) => {
  if (unrecognized.length > 0) {
    return failWithInvalidArg({
      message:
        `expected one project, got ${unrecognized.map(value => `"${value}"`).join(', ')}. ` +
        'Generators are JSR specifiers (@scope/name); the one other argument is the project.',
      usage: INSTALL_STRICT_USAGE,
      example: INSTALL_EXAMPLE,
      discover: DISCOVER_PROJECTS
    })
  }

  const mode = resolveInputMode({ noInputFlag, jsonFlag })

  if (mode === 'strict') {
    if (projectName === undefined) {
      return failWithRecipe({
        command: 'install',
        arg: '<project>',
        usage: INSTALL_STRICT_USAGE,
        example: INSTALL_EXAMPLE,
        discover: DISCOVER_PROJECTS
      })
    }

    if (generators === undefined || generators.length === 0) {
      return failWithRecipe({
        command: 'install',
        arg: '<generators...>',
        usage: INSTALL_STRICT_USAGE,
        example: INSTALL_EXAMPLE
      })
    }

    const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

    if (!skmtcRoot.projects.some(({ name }) => name === projectName)) {
      return failWithInvalidArg({
        message: `project "${projectName}" not found`,
        usage: INSTALL_STRICT_USAGE,
        example: INSTALL_EXAMPLE,
        discover: DISCOVER_PROJECTS
      })
    }

    const result = await installHeadless({
      skmtcRoot,
      projectName,
      generators
    })

    printInstallResult(result, { format: resolveOutputFormat({ jsonFlag }) })
    Deno.exit(0)
  }

  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const initialState: SkmtcState = {
    view: { page: 'install-generator', projectName, generators },
    skmtcRoot,
    message: null,
    interactive: false,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

type PrintInstallResultOptions = {
  format: 'text' | 'json'
}

/**
 * Formats an {@link InstallHeadlessResult} to stdout. Text matches the
 * prior install summary; JSON is the same shape the headless layer
 * returns. Both modes report installed generators plus a `verifyWith`
 * hint so the operator (or agent) can confirm `deno.json` was actually
 * updated — friction #2 made silent install failures invisible, so the
 * hint is now part of every successful run too.
 */
export const printInstallResult = (
  result: InstallHeadlessResult,
  { format }: PrintInstallResultOptions
): void => {
  switch (format) {
    case 'json': {
      const payload = {
        projectName: result.projectName,
        installed: result.installed,
        bundle: result.bundle,
        verifyWith: `cat .skmtc/${result.projectName}/deno.json`
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }
    case 'text': {
      console.log(`Installed ${result.installed.length} generator(s) in "${result.projectName}":`)
      for (const id of result.installed) {
        console.log(`  - ${id}`)
      }
      // The post-install rebundle confirms the new generator builds —
      // remote-only and hybrid alike.
      console.log(`\nRebundled: ${result.bundle.bundlePath}`)
      console.log(`Verify with: cat .skmtc/${result.projectName}/deno.json`)
      return
    }
    default: {
      const _exhaustive: never = format
      throw new Error(`Unhandled output format: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
