import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import type { Project } from '@/lib/project.ts'
import { formatNumber } from '@skmtc/core/formatNumber'
import type { GenerationStats } from '@/lib/generationStats.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SuccessMessage, SkmtcState } from '@/components/SkmtcContext.tsx'
import type { InkRenderFn } from '@/commands/types.ts'
import { existsSync } from '@std/fs/exists'
import { generate } from '../lib/generate.ts'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toBundleFsPath, toBundlePath } from '@/lib/to-bundle-path.ts'

type RenderGenerateArgs = {
  skmtcRoot?: SkmtcRoot
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
  // Optional dependencies for testing
  renderFn?: InkRenderFn
  AppComponent?: typeof App
}

export const renderGenerate = async ({
  skmtcRoot: providedSkmtcRoot,
  projectName,
  schemaSourceString,
  watch,
  renderFn = render,
  AppComponent = App
}: RenderGenerateArgs) => {
  // Instantiate Manager and SkmtcRoot if not provided (for testing)
  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))

  const project = skmtcRoot.findProject(projectName)

  const checks = checkGenerateParams({ project, schemaSourceString })

  if (hasRequiredParams(checks)) {
    const schemaContents = await toSchemaContents(
      schemaSourceString ?? project.clientJson.contents?.source ?? ''
    )

    await generate({
      project,
      bundlePath: toBundlePath(project.toPath()),
      skmtcRoot,
      schemaContents: schemaContents.contents,
      clientSettings: project.clientJson.contents?.settings,
      stackUrl: project.clientJson.contents?.serverUrl
    })

    Deno.exit(0)
  }

  const initialState: SkmtcState = {
    view: {
      page: 'generate',
      project,
      schemaSourceString,
      watchMode: Boolean(watch)
    },
    skmtcRoot,
    message: null,
    interactive: true,
    shortcuts: [],
    generators: []
  }

  renderFn(<AppComponent initialState={initialState} />)
}

const hasRequiredParams = (checks: GenerateChecks): boolean => {
  return checks.hasBasePath && checks.hasSchemaSource && checks.hasBundle && checks.hasWatchMode
}

export const toGenerateMessage = (stats: GenerationStats): SuccessMessage => {
  const { files, tokens, totalTime, errors } = stats

  const success = `Generated ${formatNumber(tokens)} tokens, ${formatNumber(files)} files in ${formatNumber(totalTime)}ms.`

  return errors.length
    ? {
        success,
        sub: `${formatNumber(errors.length)} errors detected - view runtime logs for details`
      }
    : { success }
}

type GenerateChecks = {
  hasBasePath: boolean
  hasSchemaSource: boolean
  hasBundle: boolean
  hasWatchMode: boolean
}

type CheckGenerateParamsArgs = {
  project: Project
  schemaSourceString: string | undefined
}

const checkGenerateParams = ({
  project,
  schemaSourceString
}: CheckGenerateParamsArgs): GenerateChecks => {
  const basePath = project.clientJson.contents?.settings.basePath
  const schemaSource = schemaSourceString ?? project.clientJson.contents?.source
  const hasBundle = existsSync(toBundleFsPath(project.toPath()))

  const hasBasePath = typeof basePath === 'string'
  const hasSchemaSource = typeof schemaSource === 'string'

  const checks = {
    hasBasePath,
    hasSchemaSource,
    hasBundle,
    hasWatchMode: true
  }

  return checks
}
