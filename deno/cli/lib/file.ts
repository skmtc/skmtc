import { exists } from '@std/fs'
import { join } from '@std/path'

export const readTextFile = async (path: string): Promise<string | undefined> => {
  try {
    return await Deno.readTextFile(path)
  } catch (_error) {
    return undefined
  }
}

type WriteFileArgs = {
  content: string
  resolvedPath: string
}

export const writeFile = async ({ content, resolvedPath }: WriteFileArgs) => {
  try {
    const dir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'))

    const dirExists = await exists(dir)

    if (!dirExists) {
      Deno.mkdir(dir, { recursive: true })
    }

    const encoder = new TextEncoder()
    const encoded = encoder.encode(content)

    Deno.writeFileSync(resolvedPath, encoded)
  } catch (error) {
    console.error(error)
  }
}

export const hasSchema = async (): Promise<boolean> => {
  try {
    const jsonFileInfo = await Deno.stat(join('.apifoundry', 'schema.json'))

    if (jsonFileInfo.isFile) {
      return true
    }
  } catch (_error) {
    // ignore
  }

  try {
    const yamlFileInfo = await Deno.stat(join('.apifoundry', 'schema.yaml'))

    if (yamlFileInfo.isFile) {
      return true
    }
  } catch (_error) {
    // ignore
  }

  try {
    const ymlFileInfo = await Deno.stat(join('.apifoundry', 'schema.yml'))

    if (ymlFileInfo.isFile) {
      return true
    }
  } catch (_error) {
    // ignore
  }

  return false
}
