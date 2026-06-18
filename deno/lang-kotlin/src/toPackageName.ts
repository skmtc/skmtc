import { dirname } from '@std/path/dirname'
import type { ModulePackage } from '@skmtc/core'
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
 * Multi-package output (`client.json#settings.packages`): export paths
 * are forward paths under a package's `rootPath`
 * (`my-sdk-core/src/main/kotlin/com/example/User.kt`), and the package
 * directories are the segments after the OWNING package's `rootPath` —
 * pass `packages` and the longest matching `rootPath` prefix is
 * stripped before derivation. Each `rootPath` is that module's Gradle
 * source root, exactly as `basePath` is in single-package mode.
 *
 * Throws when any directory segment is not a plain Kotlin identifier or
 * is a hard keyword — a generator authored a path that cannot be a
 * package (`@/my-models/User.kt`). Loud beats backticked package names.
 * This is Kotlin's `validateDestinationPath`.
 */
export const toPackageName = (path: string, packages?: ModulePackage[]): string => {
  const withoutAlias = path.replace(/^(@\/|\.\/)/, '')

  const withoutRoot = stripRootPath(withoutAlias, packages)

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

/**
 * Strips the longest matching package `rootPath` prefix from a forward
 * path. No `packages`, or no matching `rootPath` → the path is returned
 * unchanged (single-package behavior).
 */
const stripRootPath = (path: string, packages?: ModulePackage[]): string => {
  if (!packages?.length) {
    return path
  }

  const rootPaths = packages
    .map(modulePackage => modulePackage.rootPath.replace(/^(\.\/)/, '').replace(/\/$/, ''))
    .filter(rootPath => rootPath.length && path.startsWith(`${rootPath}/`))
    .sort((a, b) => b.length - a.length)

  const [longest] = rootPaths

  return longest ? path.slice(longest.length + 1) : path
}
