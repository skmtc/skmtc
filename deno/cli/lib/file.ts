import { ensureDir } from '@std/fs/ensure-dir'
import { parse } from '@std/path/parse'

export const readTextFile = async (path: string): Promise<string | undefined> => {
  try {
    return await Deno.readTextFile(path)
  } catch (_error) {
    return undefined
  }
}

export const writeFileSafeDir = async (path: string, content: string) => {
  try {
    const { dir } = parse(path)

    await ensureDir(dir)

    await Deno.writeTextFile(path, content, { create: true })
  } catch (error) {
    console.error(error)
  }
}
