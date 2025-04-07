import type { LogSkippedValuesArgs, ProvisionalParseArgs } from '../context/ParseContext.ts'

export const mockParseContext = {
  trace<T>(token: string | string[], fn: () => T): T {
    return fn()
  },

  provisionalParse<T>(args: ProvisionalParseArgs<T>): T {
    return args.value as T
  },

  logSkippedFields({ skipped, parent, parentType }: LogSkippedValuesArgs): void {
    Object.entries(skipped).forEach(([_key, _value]) => {
      // console.log(`Skipped field: ${key}, value: ${value}`)
    })
  }
}
