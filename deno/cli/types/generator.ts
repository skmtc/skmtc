/** A generator package listed in the JSR registry catalog. */
export type Generator = {
  /** Package scope without the leading `@`, e.g. `skmtc`. */
  scope: string
  /** Package name, e.g. `gen-zod`. */
  packageName: string
  /** Module ids this generator depends on, e.g. `@skmtc/gen-typescript`. */
  dependencies: string[]
}
