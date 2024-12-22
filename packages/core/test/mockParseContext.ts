export const mockParseContext = {
  trace<T>(token: string | string[], fn: () => T): T {
    return fn()
  },

  logSkippedFields(skipped: Record<string, unknown>): void {
    Object.entries(skipped).forEach(([_key, _value]) => {
      // console.log(`Skipped field: ${key}, value: ${value}`)
    })
  },

  registerExtension(_extensionFields: Record<string, unknown>): void {
    // noop
  }
}
