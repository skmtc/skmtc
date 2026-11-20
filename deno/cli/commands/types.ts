import type { render } from 'ink'

// Taken from ink so the type follows ink's own signature across majors.
// Ink 8 changed the stream argument from `NodeJS.WriteStream` to `Writable`.
export type InkRenderFn = typeof render
