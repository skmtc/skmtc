import {
  failWithInvalidArg,
  failWithRecipe,
  resolveInputMode,
  resolveOutputFormat
} from '@/lib/strict-mode.ts'
import {
  apiPublishHeadless,
  type ApiPublishResult,
  type ApiVisibility
} from '@/lib/api-publish-headless.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'
import { type HubEnv, toMissingTokenHint } from '@/lib/hub-env.ts'
import { parseScopedName } from '@/lib/scoped-name.ts'

export const description = 'Manage hub APIs: `publish` adds an OpenAPI document as a revision.'

// --- publish ----------------------------------------------------------------

type RenderApiPublishArgs = {
  file: string | undefined
  api: string | undefined
  visibility: ApiVisibility | undefined
  originUrl: string | undefined
  token: string | undefined
  env: HubEnv | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

const PUBLISH_USAGE =
  'skmtc api publish <file> --api @<account>/<slug> [--visibility public|private] [--origin-url <url>]'
const PUBLISH_EXAMPLE = 'skmtc api publish openapi.yaml --api @acme/pets'

export const renderApiPublish = async ({
  file,
  api,
  visibility,
  originUrl,
  token,
  env,
  jsonFlag,
  noInputFlag
}: RenderApiPublishArgs) => {
  resolveInputMode({ noInputFlag, jsonFlag })

  if (file === undefined) {
    return failWithRecipe({
      command: 'api publish',
      arg: '<file>',
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE,
      discover: 'The OpenAPI document to publish, relative to the current directory.'
    })
  }

  if (api === undefined) {
    return failWithRecipe({
      command: 'api publish',
      arg: '--api',
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE,
      discover: 'The hub API as @account/slug, e.g. @acme/pets.'
    })
  }

  const scoped = parseScopedName(api)
  if (!scoped) {
    return failWithInvalidArg({
      message: `invalid --api "${api}" — expected @account/slug`,
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE
    })
  }

  const {
    token: resolvedToken,
    origin: resolvedOrigin,
    env: resolvedEnv
  } = await resolveHubAuth({
    tokenFlag: token,
    envFlag: env
  })
  if (!resolvedToken) {
    return failWithRecipe({
      command: 'api publish',
      arg: '--token',
      usage: PUBLISH_USAGE,
      example: PUBLISH_EXAMPLE,
      discover: toMissingTokenHint(resolvedEnv)
    })
  }

  const result = await apiPublishHeadless({
    file,
    api: scoped,
    visibility,
    originUrl,
    token: resolvedToken,
    origin: resolvedOrigin,
    env: resolvedEnv
  })

  printApiPublishResult(result, { format: resolveOutputFormat({ jsonFlag }) })
  Deno.exit(result.type === 'failed' ? 1 : 0)
}

export const printApiPublishResult = (
  result: ApiPublishResult,
  { format }: { format: 'text' | 'json' }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  switch (result.type) {
    case 'published': {
      const name = `@${result.api.account}/${result.api.slug}`
      console.log(
        result.deduped
          ? `Published ${name} revision ${result.revision}, unchanged (deduped)`
          : `Published ${name} revision ${result.revision}`
      )
      if (result.created) console.log('  created API')
      console.log(`  ${result.url}`)
      return
    }
    case 'failed': {
      console.error(
        `Publish failed (${result.code}${result.status ? `, ${result.status}` : ''}): ${result.message}`
      )
      for (const detail of result.details ?? []) {
        console.error(`  ${detail.field ? `${detail.field}: ` : ''}${detail.message}`)
      }
      if (result.requestId) console.error(`  request id: ${result.requestId}`)
      return
    }
    default: {
      const _exhaustive: never = result
      throw new Error(`Unhandled api publish result: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
