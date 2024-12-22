import { type NodeProps } from '@xyflow/react'

import { type ViewNodeType } from './types'

export const ViewNode = ({ data }: NodeProps<ViewNodeType>) => {
  const { title, content } = data
  return (
    <div className="flex flex-col bg-white rounded-md border border-gray-300 w-[550px] h-[450px] overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">{title}</div>

      <div className="p-4 flex-1">{content}</div>
    </div>
  )
}
