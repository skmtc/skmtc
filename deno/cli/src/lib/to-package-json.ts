import { join } from '@std/path'
import { readTextFile } from './file.ts'
import * as v from 'valibot'

export const toPackageJson = async () => {
  const packageJsonPath = join(Deno.cwd(), 'package.json')

  const packageJson = await readTextFile(packageJsonPath)

  if (!packageJson) {
    return undefined
  }

  const parsed = JSON.parse(packageJson)

  return v.parse(packageJsonSchema, parsed)
}

export const packageJsonSchema = v.object({
  name: v.string(),
  version: v.string()
})
