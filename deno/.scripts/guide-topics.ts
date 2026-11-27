/**
 * The topics of `skmtc guide`, read from `cli/guide/*.md`.
 *
 * The Markdown files are the one place the guide is written. A topic starts
 * at a marker line and runs to the next marker or the end of the file:
 *
 *   <!-- topic setup: Create a project, install generators and generate -->
 *   ### Setting up Skmtc in a project
 *
 * The CLI cannot read a Markdown file at run time: an install from JSR holds
 * only the modules the entry point imports. So `deno task build-guide` writes
 * the topics to `cli/guide/topics.json`, which the CLI imports, and
 * verify-docs fails when that file is not what the Markdown gives.
 */

import { join } from '@std/path'
import type { GuideTopic } from '../cli/guide/topic.ts'

export type GuideSource = {
  /** The file name, such as `tasks.md`. */
  name: string
  text: string
}

type Marker = {
  line: number
  id: string
  summary: string
}

type FenceState = {
  open: boolean
  flags: boolean[]
}

type CodeUsesArgs = {
  text: string
  /** The words before the one to find, such as `skmtc` or `skmtc guide`. */
  prefix: string
}

type UnknownCommandsArgs = {
  topics: GuideTopic[]
  /** The top-level commands the CLI registers. */
  commands: string[]
}

export type UnknownCommand = {
  topicId: string
  command: string
}

const TOPIC_MARKER = /^<!-- topic ([a-z][a-z0-9-]*): (.+) -->$/

const MARKER_START = '<!-- topic'

const HEADING = /^#{1,6} (.+)$/

const FENCE = /^\s*(```|~~~)/

const WORD = '([a-z][a-z0-9-]*)'

/** For each line, whether it is in a fenced code block. A fence line is in its block. */
const toInFence = (lines: string[]): boolean[] =>
  lines.reduce<FenceState>(
    ({ open, flags }, line) => {
      const isFence = FENCE.test(line)

      return { open: isFence ? !open : open, flags: flags.concat(open || isFence) }
    },
    { open: false, flags: [] }
  ).flags

const toMarker = (name: string, text: string, line: number): Marker[] => {
  if (!text.trimStart().startsWith(MARKER_START)) {
    return []
  }

  const match = text.match(TOPIC_MARKER)

  // An indented marker would stay as text of the topic before it, and the
  // topic it was meant to start would be in no output.
  if (!match) {
    throw new Error(
      `${name}:${line + 1}: a topic marker is \`<!-- topic <id>: <summary> -->\` ` +
        'at the start of a line, with an id in lower case'
    )
  }

  return [{ line, id: match[1], summary: match[2] }]
}

/** The topics of one file, in the order they are written. */
export const parseGuideSource = ({ name, text }: GuideSource): GuideTopic[] => {
  const lines = text.split('\n')
  const inFence = toInFence(lines)

  // A marker in a code block is an example of a marker, and text of its topic.
  const markers = lines.flatMap((line, index) =>
    inFence[index] ? [] : toMarker(name, line, index)
  )

  const firstMarkerLine = markers[0]?.line ?? lines.length
  const strayLine = lines.slice(0, firstMarkerLine).findIndex(line => line.trim() !== '')

  // Text outside a topic would be in the source and in no output.
  if (strayLine !== -1) {
    throw new Error(`${name}:${strayLine + 1}: text before the first topic marker is in no topic`)
  }

  return markers.map((marker, position) => {
    const end = markers[position + 1]?.line ?? lines.length
    const body = lines.slice(marker.line + 1, end).join('\n').trim()
    const heading = body.split('\n')[0].match(HEADING)

    if (!heading) {
      throw new Error(`${name}:${marker.line + 2}: topic \`${marker.id}\` must start with a heading`)
    }

    return {
      id: marker.id,
      group: name.replace(/\.md$/, ''),
      title: heading[1],
      summary: marker.summary,
      body
    }
  })
}

/** Every topic, file by file in the order given. An id used twice is an error. */
export const buildGuideTopics = (sources: GuideSource[]): GuideTopic[] => {
  const topics = sources.flatMap(parseGuideSource)
  const repeated = topics.find((topic, index) =>
    topics.some((other, otherIndex) => otherIndex < index && other.id === topic.id)
  )

  if (repeated) {
    throw new Error(`guide topic \`${repeated.id}\` is defined twice`)
  }

  return topics
}

/** The text of `topics.json` for these topics. */
export const renderGuideTopics = (topics: GuideTopic[]): string =>
  `${JSON.stringify(topics, null, 2)}\n`

/**
 * Each word that follows `prefix` in code, once: in an inline code span, which
 * can wrap to the next line, or at the start of a line of a fenced code block.
 * A line of a sentence that starts with the prefix is not code.
 */
export const findCodeUses = ({ text, prefix }: CodeUsesArgs): string[] => {
  const lines = text.split('\n')
  const inFence = toInFence(lines)
  const inSpan = new RegExp(`\`${prefix.replaceAll(' ', '\\s+')}\\s+${WORD}`, 'g')
  const atLineStart = new RegExp(`^\\s*(?:\\$ )?${prefix} ${WORD}`)

  const fromSpans = [...text.matchAll(inSpan)].map(match => match[1])
  const fromBlocks = lines.flatMap((line, index) => {
    const match = inFence[index] ? line.match(atLineStart) : null

    return match ? [match[1]] : []
  })

  return [...fromSpans, ...fromBlocks].filter((word, index, all) => all.indexOf(word) === index)
}

/**
 * Each `skmtc <command>` in a topic that names no registered command. The
 * guide ships inside the CLI, so a command it names must be one that CLI has.
 */
export const findUnknownCommands = ({ topics, commands }: UnknownCommandsArgs): UnknownCommand[] =>
  topics.flatMap(topic =>
    findCodeUses({ text: topic.body, prefix: 'skmtc' })
      .filter(command => !commands.includes(command))
      .map(command => ({ topicId: topic.id, command }))
  )

/** The Markdown files of the guide folder, sorted by name. */
export const readGuideSources = async (guideDir: string): Promise<GuideSource[]> => {
  const names: string[] = []

  for await (const entry of Deno.readDir(guideDir)) {
    if (entry.isFile && entry.name.endsWith('.md')) {
      names.push(entry.name)
    }
  }

  return await Promise.all(
    names.sort().map(async name => ({ name, text: await Deno.readTextFile(join(guideDir, name)) }))
  )
}
