import { dirname } from '@std/path/dirname'
import { isKtIdentifierName, ktHardKeywords } from './hardKeywords.ts'

/**
 * Derives the `package` directive from a Kotlin file's export path —
 * the segments after the `@/` root ARE the package directories
 * (Kotlin's package-=-folder convention; `client.json#settings.basePath`
 * points at the Gradle source root, e.g. `./app/src/main/kotlin`).
 *
 * - `@/com/example/api/User.generated.kt` → `'com.example.api'`
 * - `@/User.kt` → `''` (the default package — legal, discouraged;
 *   {@link import('./KtFile.ts').KtFile} renders no `package` line)
 *
 * Throws when any directory segment is not a plain Kotlin identifier or
 * is a hard keyword — a generator authored a path that cannot be a
 * package (`@/my-models/User.kt`). Loud beats backticked package names.
 * This is Kotlin's `validateDestinationPath`.
 */
export const toPackageName = (path: string): string => {
  const withoutRoot = path.replace(/^(@\/|\.\/)/, '')

  const directory = dirname(withoutRoot)

  if (directory === '.' || directory === '') {
    return ''
  }

  const segments = directory.split('/')

  for (const segment of segments) {
    if (!isKtIdentifierName(segment) || ktHardKeywords.has(segment)) {
      throw new Error(
        `Export path '${path}' cannot map to a Kotlin package: ` +
          `segment '${segment}' is not a valid package name part`
      )
    }
  }

  return segments.join('.')
}
