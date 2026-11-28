import { useTask } from '@/components/TaskContext.tsx'
import { StringTask } from '@/components/StringTask.tsx'
import type { AliasRoot } from '@/lib/alias-root.ts'

type BasePathTaskProps = {
  /**
   * The folder the app's `@/` alias points to. Generated files import each
   * other through `@/`, so it is the default, and the prompt says why.
   */
  aliasRoot?: AliasRoot
}

const PROMPT = 'Output directory for generated files'

export const BasePathTask = ({ aliasRoot }: BasePathTaskProps) => {
  const { dispatch } = useTask()

  return (
    <StringTask
      prompt={
        aliasRoot === undefined
          ? PROMPT
          : `${PROMPT} ("@/" points to "${aliasRoot.path}" in ${aliasRoot.from})`
      }
      defaultValue={aliasRoot?.path ?? 'src'}
      setValue={value => {
        dispatch({ type: 'set-task-state', payload: { taskKey: 'base-path', state: value } })
      }}
    />
  )
}
