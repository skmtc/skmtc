/**
 * One topic of `skmtc guide`.
 *
 * The topics are written in the Markdown files of this folder and built into
 * `topics.json` by `deno task build-guide`. This file has no imports, so the
 * build script and the CLI both read the type from here.
 */
export type GuideTopic = {
  /** What a reader types: `skmtc guide <id>`. */
  id: string
  /** The source file without `.md`: `concepts`, `reference` or `tasks`. */
  group: string
  /** The text of the topic's first heading. */
  title: string
  /** One line for the list of topics. */
  summary: string
  /** The topic as Markdown, from its heading on. */
  body: string
}
