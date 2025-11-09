import { toGenerateLocalArgs } from '@/lib/to-generate-local-args.ts'
import { toGenerateMessageString } from '@/lib/to-generate-message-string.ts'

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
    const stats = await generateLocal(generateLocalArgs)

    const message = toGenerateMessageString(stats)

    console.log(message)
    Deno.exit(0)
  } else {
    const { renderGenerate } = await import('@/commands/generate.tsx')

    return await renderGenerate({ projectName, schemaSourceString, watch })
  }
}
