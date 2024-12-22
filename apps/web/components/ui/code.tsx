import { Pre, RawCode, highlight } from 'codehike/code'
import { IdeWindow } from '@/components/ui/Ide'
import { CopyButton } from '@/components/ui/copy-button'

type CodeProps = {
  tree: RawCode | undefined
  codeblock: RawCode
}

export async function Code({ codeblock, tree }: CodeProps) {
  const highlighted = await highlight(codeblock, 'github-from-css')

  return (
    <div className="rounded-sm border border-black/10 overflow-hidden shadow-md">
      <IdeWindow copyButton={<CopyButton text={highlighted.code} />}>
        <Pre
          code={highlighted}
          handlers={[]}
          className="flex bg-white my-0 w-full rounded-none max-h-[500px] overflow-auto"
        />
      </IdeWindow>
    </div>
  )
}
