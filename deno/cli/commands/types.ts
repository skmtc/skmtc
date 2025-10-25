import type { Instance, RenderOptions } from 'ink'
export type InkRenderFn = (
  node: React.ReactNode,
  options?: NodeJS.WriteStream | RenderOptions
) => Instance
