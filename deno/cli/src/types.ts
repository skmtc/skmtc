import type { Command } from '@cliffy/command'

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

export type ControllerFilteArgs = {
  hasHome: boolean
  hasGenerators: boolean
}

export type Controller = {
  action: string
  description: string
  toCommand: () => Command
  toPrompt: () => Promise<void>
  filter: (args: ControllerFilteArgs) => boolean
}
