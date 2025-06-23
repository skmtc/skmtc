import { SEPARATOR } from '@std/path'
import { toPackageJson } from './to-package-json.ts'

export const toNameSuggest = async () => {
  const packageJson = await toPackageJson()

  const name = packageJson?.name
    ? packageJson.name.split('/').pop()
    : Deno.cwd().split(SEPARATOR).pop()

  return name ?? 'untitled'
}
