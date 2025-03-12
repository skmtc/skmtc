import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface FileSystemTree {
  [name: string]: DirectoryNode | FileNode
}

export interface DirectoryNode {
  directory: FileSystemTree
}

export interface FileNode {
  file: {
    contents: string | Uint8Array
  }
}

export const toFileTree = (path: string): FileSystemTree => {
  const tree: FileSystemTree = {}

  try {
    const entries = readdirSync(path, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(path, entry.name)

      if (entry.isDirectory()) {
        if (['node_modules', 'build', '.yarn'].includes(entry.name)) {
          continue
        }

        tree[entry.name] = {
          directory: toFileTree(fullPath)
        }
      } else if (entry.isFile()) {
        if (['.DS_Store', 'base-files.json'].includes(entry.name)) {
          continue
        }

        const contents = readFileSync(fullPath, 'utf8')
        tree[entry.name] = {
          file: {
            contents
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading path ${path}:`, error)
    throw error
  }

  return tree
}

const runtimeFiles = toFileTree('./')

writeFileSync('./base-files.json', JSON.stringify(runtimeFiles, null, 2))
