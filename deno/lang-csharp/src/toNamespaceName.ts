import { dirname } from '@std/path/dirname'
import { csHardKeywords, isCsIdentifierName } from './hardKeywords.ts'

/**
 * Derives the file-scoped `namespace` directive from a C# file's export
 * path — the segments after the `@/` root ARE the namespace parts
 * (the folder-=-namespace convention .NET analyzers expect;
 * `client.json#settings.basePath` points at the consumer's project
 * source root).
 *
 * - `@/Acme/Api/Models/User.generated.cs` → `'Acme.Api.Models'`
 * - `@/User.cs` → `''` (the global namespace — legal, discouraged;
 *   {@link import('./CsFile.ts').CsFile} renders no `namespace` line)
 *
 * Throws when any directory segment is not a plain C# identifier or is
 * a reserved keyword — a generator authored a path that cannot be a
 * namespace (`@/my-models/User.cs`). C# could escape such segments
 * (`namespace @class.Foo` is legal), but loud beats `@`-escaped
 * namespace names — the Kotlin precedent (D7). This is C#'s
 * `validateDestinationPath`.
 */
export const toNamespaceName = (path: string): string => {
  const withoutRoot = path.replace(/^(@\/|\.\/)/, '')

  const directory = dirname(withoutRoot)

  if (directory === '.' || directory === '') {
    return ''
  }

  const segments = directory.split('/')

  for (const segment of segments) {
    if (!isCsIdentifierName(segment) || csHardKeywords.has(segment)) {
      throw new Error(
        `Export path '${path}' cannot map to a C# namespace: ` +
          `segment '${segment}' is not a valid namespace name part`
      )
    }
  }

  return segments.join('.')
}
