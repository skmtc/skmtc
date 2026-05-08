import type { ClientSettings } from '@skmtc/core/Settings'

export type PatchWorkspaceBody = {
  baseFiles?: Record<string, string> | undefined
  clientSettings?: ClientSettings | undefined
}
