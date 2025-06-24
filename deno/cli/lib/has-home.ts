import { RootDenoJson } from './root-deno-json.ts'
import { StackJson } from './stack-json.ts'

export const hasHome = () => {
  if (RootDenoJson.exists() && StackJson.exists()) {
    return true
  }

  return false
}
