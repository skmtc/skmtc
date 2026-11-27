/**
 * `skmtc guide [topic]`: the guide the CLI carries.
 *
 * With no topic it lists the topics. With a topic it prints that topic as
 * Markdown. Always non-interactive, and it reads nothing from disk or the
 * network: the text is part of the binary.
 */

import {
  findGuideTopic,
  formatGuideIndex,
  GUIDE_USAGE,
  toGuideIndex,
  toGuideTopicResult
} from '@/lib/guide.ts'
import { failWithInvalidArg, resolveOutputFormat } from '@/lib/strict-mode.ts'
import denoJson from '@/deno.json' with { type: 'json' }

type RenderGuideArgs = {
  topicId?: string
  jsonFlag?: boolean
}

type ToGuideOutputArgs = {
  topicId: string | undefined
  format: 'text' | 'json'
  cliVersion: string
}

/** What the command prints, or `undefined` when no topic has that id. */
export const toGuideOutput = ({
  topicId,
  format,
  cliVersion
}: ToGuideOutputArgs): string | undefined => {
  if (topicId === undefined) {
    const index = toGuideIndex({ cliVersion })

    return format === 'json' ? JSON.stringify(index, null, 2) : formatGuideIndex(index)
  }

  const topic = findGuideTopic(topicId)

  if (topic === undefined) {
    return undefined
  }

  return format === 'json'
    ? JSON.stringify(toGuideTopicResult({ cliVersion, topic }), null, 2)
    : topic.body
}

export const renderGuide = ({ topicId, jsonFlag }: RenderGuideArgs): void => {
  const output = toGuideOutput({
    topicId,
    format: resolveOutputFormat({ jsonFlag }),
    cliVersion: denoJson.version
  })

  if (output === undefined) {
    failWithInvalidArg({
      message: `no guide topic is named "${topicId}"`,
      usage: GUIDE_USAGE,
      example: 'skmtc guide setup',
      discover: '`skmtc guide` lists the topics.'
    })
  }

  console.log(output)
  Deno.exit(0)
}
