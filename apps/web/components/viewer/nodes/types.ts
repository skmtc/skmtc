import type { Node, BuiltInNode } from '@xyflow/react'
import { ReactNode } from 'react'

export type ViewNodeType = Node<{ content: ReactNode; title: string }, 'view-node'>
export type AppNode = BuiltInNode | ViewNodeType
