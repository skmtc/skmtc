import { toGenerateLocalArgs } from '@/lib/to-generate-local-args.ts'

type GenerateSwitchArgs = {
  projectName: string
  schemaSourceString: string | undefined
  watch: boolean | undefined
}

export const generateSwitch = async ({
  projectName,
  schemaSourceString,
  watch
}: GenerateSwitchArgs) => {
  const generateLocalArgs = await toGenerateLocalArgs({ projectName, schemaSourceString, watch })

  if (generateLocalArgs) {
    const { generateLocal } = await import('@/lib/generate-local.ts')
    return await generateLocal(generateLocalArgs)
  } else {
    const { renderGenerate } = await import('@/commands/generate.tsx')

    return await renderGenerate({ projectName, schemaSourceString, watch })
  }
}
