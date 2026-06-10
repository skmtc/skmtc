import type { Project } from '@/lib/project.ts'
import { useTask } from '@/components/TaskContext.tsx'
import { toAbsoluteRootPath } from '@/lib/to-root-path.ts'
import { StringTask } from '@/components/StringTask.tsx'
import { relative } from '@std/path/relative'
type SchemaLocationTaskProps = {
  project: Project
}

export const SchemaLocationTask = ({ project }: SchemaLocationTaskProps) => {
  const { dispatch: taskDispatch } = useTask()
  const schemaSource = project.schemaFile?.schemaSource
  const absoluteRootPath = toAbsoluteRootPath()

  return (
    <StringTask
      prompt="Input schema path or URL (.json / .yaml / .graphql)"
      defaultValue={
        schemaSource?.type === 'local' ? relative(absoluteRootPath, schemaSource.path) : undefined
      }
      setValue={value => {
        taskDispatch({
          type: 'set-task-state',
          payload: { taskKey: 'schema-location-task', state: value }
        })
      }}
    />
  )
}
