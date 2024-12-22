import type { NodeTypes } from '@xyflow/react'
import { ViewNode } from './ViewNode'
import { AppNode } from './types'
import { FormProvider, useForm } from 'react-hook-form'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'

type FakeFormProps = {
  children: React.ReactNode
}

const FakeForm = ({ children }: FakeFormProps) => {
  const form = useForm({
    defaultValues: {
      temo: ''
    }
  })
  return <FormProvider {...form}>{children}</FormProvider>
}

export const toInitialNodes = (
  previewNodes: Record<string, Record<string, string>> | undefined
): AppNode[] | undefined => {
  if (!previewNodes) return []

  return Object.entries(previewNodes).flatMap(([group, imports], groupIndex) => {
    return Object.keys(imports).map((importName, importIndex) => {
      return {
        id: `${group}-${importName}`,
        type: 'view-node',
        position: { x: importIndex * 600, y: groupIndex * 500 },
        draggable: false,
        connectable: false,
        data: {
          title: importName,
          content: <NodeContent group={group} importName={importName} />
        }
      }
    })
  })
}

const NodeContent = ({ group, importName }: { group: string; importName: string }) => {
  const { webContainerUrl } = useWebcontainer()

  if (!webContainerUrl) return null
  return <iframe className="w-full h-full" src={`${webContainerUrl}/${group}/${importName}`} />
}

export const nodeTypes = {
  'view-node': ViewNode
  // Add any of your custom nodes here!
} satisfies NodeTypes
