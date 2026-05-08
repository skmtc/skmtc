import { join } from '@std/path/join'
import { readTextFile } from '@/lib/file.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import * as v from 'valibot'

export const toPackageJson = async () => {
  const packageJsonPath = join(Deno.cwd(), 'package.json')

  const packageJson = await readTextFile(packageJsonPath)

  if (!packageJson) {
    return undefined
  }

  const parsed = JSON.parse(packageJson)

  return parseOrExplain(packageJsonSchema, parsed, `package.json at ${packageJsonPath}`)
}

export const packageJsonSchema = v.object({
  name: v.string(),
  version: v.string()
})
