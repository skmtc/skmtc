import type { LogSkippedValuesArgs } from '../context/ParseContext.ts'

export const mockParseContext = {
  trace<T>(token: string | string[], fn: () => T): T {
    return fn()
  },

  logSkippedFields({ skipped, parent, parentType }: LogSkippedValuesArgs): void {
    Object.entries(skipped).forEach(([_key, _value]) => {
      // console.log(`Skipped field: ${key}, value: ${value}`)
    })
  }
}
