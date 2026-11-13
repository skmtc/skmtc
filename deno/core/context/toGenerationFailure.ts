/** A subject whose generation threw: its trail and the error message. */
export type FailedItem = {
  trail: string
  message: string
}

/** How many trails each message lists before it counts the rest. */
const SHOWN_TRAILS = 5

/**
 * The message of a run that failed in generate. Each distinct error is
 * written once, with the subjects it failed: one wrong enrichment fails
 * every subject that reads it, and the user needs to read it only once.
 */
export const toGenerationFailure = (failedItems: readonly FailedItem[]): string => {
  const byMessage = Map.groupBy(failedItems, ({ message }) => message)

  const paragraphs = [...byMessage].map(([message, items]) => {
    const trails = items.map(({ trail }) => `  in ${trail}`)
    const hidden = trails.length - SHOWN_TRAILS

    return [
      message,
      ...trails.slice(0, SHOWN_TRAILS),
      ...(hidden > 0 ? [`  and ${hidden} more`] : [])
    ].join('\n')
  })

  return `Generation failed for ${failedItems.length} subject(s):\n${paragraphs.join('\n\n')}`
}
