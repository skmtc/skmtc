import { ClientSettings } from '@/types/clientSettings.generated.ts'

export type PatchWorkspaceBody = {
  baseFiles?: Record<string, string> | undefined
  clientSettings?: ClientSettings | undefined
}
