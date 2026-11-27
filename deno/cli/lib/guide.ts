/**
 * The guide the CLI carries: what `skmtc guide` prints.
 *
 * The text is in the binary, so it describes the CLI that is installed and
 * needs no network. `guide/topics.json` is built from `guide/*.md` by
 * `deno task build-guide`; edit the Markdown, never the JSON.
 */

import topics from '@/guide/topics.json' with { type: 'json' }
import type { GuideTopic } from '@/guide/topic.ts'

export type { GuideTopic }

/** A topic as the list shows it: all but the text. */
export type GuideTopicSummary = Omit<GuideTopic, 'body'>

export type GuideIndex = {
  type: 'guide-index'
  cliVersion: string
  topics: GuideTopicSummary[]
}

export type GuideTopicResult = GuideTopic & {
  type: 'guide-topic'
  cliVersion: string
}

type GuideIndexArgs = {
  cliVersion: string
}

type GuideTopicResultArgs = {
  cliVersion: string
  topic: GuideTopic
}

export const GUIDE_TOPICS: GuideTopic[] = topics

export const GUIDE_USAGE = 'skmtc guide [topic]'

export const toGuideTopicSummaries = (): GuideTopicSummary[] =>
  GUIDE_TOPICS.map(({ id, group, title, summary }) => ({ id, group, title, summary }))

export const findGuideTopic = (id: string): GuideTopic | undefined =>
  GUIDE_TOPICS.find(topic => topic.id === id)

export const toGuideIndex = ({ cliVersion }: GuideIndexArgs): GuideIndex => ({
  type: 'guide-index',
  cliVersion,
  topics: toGuideTopicSummaries()
})

export const toGuideTopicResult = ({ cliVersion, topic }: GuideTopicResultArgs): GuideTopicResult => ({
  type: 'guide-topic',
  cliVersion,
  ...topic
})

/** The list of topics as text: one block for each group, in the order of the guide. */
export const formatGuideIndex = ({ cliVersion, topics }: GuideIndex): string => {
  const width = Math.max(...topics.map(topic => topic.id.length))
  const groups = topics
    .map(topic => topic.group)
    .filter((group, index, all) => all.indexOf(group) === index)

  const blocks = groups.map(group =>
    [
      group,
      ...topics
        .filter(topic => topic.group === group)
        .map(topic => `  ${topic.id.padEnd(width)}  ${topic.summary}`)
    ].join('\n')
  )

  return [
    `Skmtc guide (CLI ${cliVersion}). Read a topic with: skmtc guide <topic>`,
    ...blocks
  ].join('\n\n')
}
