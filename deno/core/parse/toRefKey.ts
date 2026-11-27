import { toRefPathBucket, toRefPointer, type RefParts } from '@/helpers/refFns.ts'

/**
 * The key a `$ref`'s consumers and errors are kept under. A component ref
 * (`#/components/<bucket>/<name>`) is keyed by the name it resolves,
 * unescaped, which is the key `StackTrail.toStackRef()` gives that
 * component's own errors: `#/components/schemas/Foo%20Bar` is kept under
 * `#/components/schemas/Foo Bar`. Any other ref is keyed by its whole
 * pointer in one spelling (`toRefPointer`), which is also the key its
 * parsed target is kept under.
 */
export const toRefKey = ({ refName, refPath }: RefParts): string => {
  const bucket = toRefPathBucket(refPath)

  return bucket === undefined
    ? toRefPointer({ refName, refPath })
    : `#/components/${bucket}/${refName}`
}
