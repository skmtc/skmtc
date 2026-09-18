import figures from 'npm:figures@6.1.0'

/**
 * The selection marker Ink's select input renders in front of the active
 * item. `figures` picks `❯` where the terminal supports Unicode and `>`
 * where it does not (a plain Windows console), so a rendered-frame
 * expectation must use the same source rather than a literal.
 */
export const pointer: string = figures.pointer

/** The done marker (`✔`, or `√` where Unicode is unsupported). */
export const tick: string = figures.tick
