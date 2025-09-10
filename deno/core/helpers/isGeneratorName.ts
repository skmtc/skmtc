import { parseModuleName } from './parseModuleName.ts'
export const isGeneratorName = (name: string): boolean => {
  const { packageName } = parseModuleName(name)

  return packageName.startsWith('gen-')
}
