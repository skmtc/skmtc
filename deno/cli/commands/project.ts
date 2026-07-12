import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { failWithRecipe, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'
import {
  createHeadless,
  type CreateResult,
  rmHeadless,
  type RmResult
} from '@/lib/project-headless.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'
import { collectProjectBaseFiles } from '@/commands/push.ts'

export const description =
  'Manage a hub project built from the local setup: `create` a new project, `rm` it.'

/** Resolve the local source project: `--from`, else the single project in .skmtc/. */
function resolveFrom(skmtcRoot: SkmtcRoot, fromFlag: string | undefined): string | undefined {
  const explicit = fromFlag?.trim()
  if (explicit) return explicit
  return skmtcRoot.projects.length === 1 ? skmtcRoot.projects[0].name : undefined
}

// --- create -----------------------------------------------------------------

type RenderCreateArgs = {
  skmtcRoot?: SkmtcRoot
  name: string | undefined
  from: string | undefined
  token: string | undefined
  origin: string | undefined
  stackVersion?: string
  visibility?: string
  baseFiles?: boolean
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const CREATE_USAGE = 'skmtc project create <name> [--from <project>] [--base-files]'
const CREATE_EXAMPLE = 'skmtc project create my-api-sandbox'

export const renderProjectCreate = async ({
  skmtcRoot: providedSkmtcRoot,
  name,
  from,
  token,
  origin,
  stackVersion,
  visibility,
  baseFiles: baseFilesFlag,
  jsonFlag,
  noInputFlag
}: RenderCreateArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag })

  if (name === undefined) {
    return failWithRecipe({
      command: 'project create',
      arg: '<name>',
      usage: CREATE_USAGE,
      example: CREATE_EXAMPLE,
      discover: 'Pick a slug for the new hub project, e.g. my-api-sandbox.'
    })
  }

  const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({
    tokenFlag: token,
    originFlag: origin
  })
  if (!resolvedToken) {
    return failWithRecipe({
      command: 'project create',
      arg: '--token',
      usage: CREATE_USAGE,
      example: CREATE_EXAMPLE,
      discover: 'Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token.'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
  const projectName = resolveFrom(skmtcRoot, from)
  if (projectName === undefined) {
    return failWithRecipe({
      command: 'project create',
      arg: '--from',
      usage: CREATE_USAGE,
      example: CREATE_EXAMPLE,
      discover: 'ls .skmtc/  (more than one project — pass --from <project>)'
    })
  }

  const baseFiles = baseFilesFlag
    ? await collectProjectBaseFiles(skmtcRoot, projectName)
    : undefined

  const result = await createHeadless({
    skmtcRoot,
    projectName,
    name,
    token: resolvedToken,
    origin: resolvedOrigin,
    stackVersion,
    visibility: visibility === 'public' ? 'public' : 'private',
    baseFiles
  })

  printCreateResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

export const printCreateResult = (
  result: CreateResult,
  { format }: { format: 'text' | 'json' }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'created': {
      console.log(`Created ${result.project.account}/${result.project.slug}`)
      console.log(`  origin: ${result.origin}`)
      console.log(`  stack: ${result.stack}`)
      console.log(
        `  api: ${result.api.account}/${result.api.slug}${
          result.apiRegistered ? ' (registered now)' : ''
        }`
      )
      console.log(`  enrichments: ${result.enrichmentCount}`)
      if (result.baseFilesPushed !== undefined) {
        console.log(`  base files: ${result.baseFilesPushed}`)
      }
      if (result.remoteWritten) {
        console.log('  note: recorded project + api in client.json')
      }
      if (result.url) console.log(`  project: ${result.url}`)
      return
    }
    case 'failed': {
      console.error(`Create failed for "${result.projectName}" at ${result.stage}:`)
      console.error(`  ${result.reason}`)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled create result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

// --- rm ---------------------------------------------------------------------

type RenderRmArgs = {
  skmtcRoot?: SkmtcRoot
  name: string | undefined
  from: string | undefined
  token: string | undefined
  origin: string | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const RM_USAGE = 'skmtc project rm <name> [--from <project>]'
const RM_EXAMPLE = 'skmtc project rm my-api-sandbox'

export const renderProjectRm = async ({
  skmtcRoot: providedSkmtcRoot,
  name,
  from,
  token,
  origin,
  jsonFlag,
  noInputFlag
}: RenderRmArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag })

  if (name === undefined) {
    return failWithRecipe({
      command: 'project rm',
      arg: '<name>',
      usage: RM_USAGE,
      example: RM_EXAMPLE,
      discover: 'The project slug to delete.'
    })
  }

  const { token: resolvedToken, origin: resolvedOrigin } = resolveHubAuth({
    tokenFlag: token,
    originFlag: origin
  })
  if (!resolvedToken) {
    return failWithRecipe({
      command: 'project rm',
      arg: '--token',
      usage: RM_USAGE,
      example: RM_EXAMPLE,
      discover:
        'Run `skmtc login`, set $SKMTC_HUB_TOKEN, or pass --token. Deleting needs the admin:resource scope.'
    })
  }

  const skmtcRoot = providedSkmtcRoot ?? (await SkmtcRoot.open(new Manager()))
  const projectName = resolveFrom(skmtcRoot, from) ?? skmtcRoot.projects[0]?.name ?? ''

  const result = await rmHeadless({
    skmtcRoot,
    projectName,
    name,
    token: resolvedToken,
    origin: resolvedOrigin
  })

  printRmResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

export const printRmResult = (result: RmResult, { format }: { format: 'text' | 'json' }): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'removed': {
      console.log(
        result.existed
          ? `Removed ${result.project.account}/${result.project.slug}`
          : `${result.project.account}/${result.project.slug} already gone — nothing to do.`
      )
      return
    }
    case 'failed': {
      console.error(`Remove failed for "${result.projectName}" at ${result.stage}:`)
      console.error(`  ${result.reason}`)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled rm result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
