import { StackJson } from './stack-json.ts'
export const hasGenerators = async () => {
  const stackJson = await StackJson.open()

  return stackJson.contents.generators.length > 0
}
