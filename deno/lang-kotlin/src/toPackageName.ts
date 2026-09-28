import { dirname } from '@std/path/posix/dirname'
import { matchPackage, type ModulePackage, toWorkspacePath } from '@skmtc/core'
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
  const withoutAlias = toWorkspacePath(path)

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
 * Strips the owning package's `rootPath` from a canonical path: the
 * innermost root that contains it ({@link matchPackage}), so nested roots
 * (one Gradle module inside another) resolve to the nearest source root.
 * A path under no root, or no `packages` at all, comes back unchanged
 * (single-package behavior).
 */
const stripRootPath = (path: string, packages?: ModulePackage[]): string => {
  const match = matchPackage({ path, packages })

  return match ? path.slice(match.innermost.rootPath.length + 1) : path
}
