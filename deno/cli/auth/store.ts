import { ensureDir, exists } from '@std/fs'
import { normalize, resolve, join } from '@std/path'

export const toAuthStore = (): AuthStore => {
  // Check if Deno KV is available (Deno runtime) vs Node.js
  // Use globalThis to avoid dnt shim type checking issues
  const denoGlobal = (globalThis as unknown as { Deno?: { openKv?: () => Promise<KvLike> } }).Deno
  if (typeof denoGlobal?.openKv === 'function') {
    try {
      const kv = denoGlobal.openKv()
      return new KvStore(kv)
    } catch (_error) {
      return new FileStore()
    }
  }
  
  // Fallback to FileStore for Node.js or when KV is not available
  return new FileStore()
}
export type AuthStore = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export class FileStore {
  async getItem(key: string) {
    const { filePath } = toFilePath(key)
    try {
      const value = await Deno.readTextFile(filePath)
      return value
    } catch (_error) {
      return null
    }
  }

  async setItem(key: string, value: string) {
    const { filePath } = await ensureFile(key)
    await Deno.writeTextFile(filePath, value)
  }

  async removeItem(key: string) {
    const { filePath } = toFilePath(key)
    await Deno.remove(filePath)
  }
}

// Interface to avoid Deno.Kv type issues in Node builds
interface KvLike {
  get: (key: string[]) => Promise<{ value: unknown }>
  set: (key: string[], value: string) => Promise<unknown>
  delete: (key: string[]) => Promise<void>
}

export class KvStore {
  kv: Promise<KvLike>

  constructor(kv: Promise<KvLike>) {
    this.kv = kv
  }

  async getItem(key: string) {
    const kv = await this.kv
    const { value } = await kv.get(['auth', key])
    return value as string | null
  }

  async setItem(key: string, value: string) {
    const kv = await this.kv
    await kv.set(['auth', key], value)
  }

  async removeItem(key: string) {
    const kv = await this.kv
    await kv.delete(['auth', key])
  }
}

const toFilePath = (key: string) => {
  const home = Deno.env.get('HOME')

  if (!home) {
    throw new Error('HOME env var is not set')
  }

  const dirPath = join(home, '.skmtc')
  const filePath = join(dirPath, `auth-${key}.txt`)

  const normalizedPath = resolve(normalize(filePath))

  if (normalizedPath !== filePath) {
    throw new Error(`Unexpected path: "${filePath}"`)
  }

  return {
    filePath,
    dirPath
  }
}

const ensureFile = async (key: string) => {
  const { dirPath, filePath } = toFilePath(key)

  const hasUserSkmtc = await exists(dirPath, { isDirectory: true })

  if (hasUserSkmtc) {
    await ensureDir(dirPath)
  }

  const hasFile = await exists(filePath, { isFile: true })

  if (!hasFile) {
    await Deno.writeTextFile(filePath, '')
    await Deno.chmod(filePath, 0o600)
  }

  return { filePath }
}
