import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toInitialNodes, nodeTypes } from './nodes'
import { initialEdges, edgeTypes } from './edges'
import { set } from 'lodash'
import files from '@/components/files.json'
import { useArtifacts } from '@/components/artifacts/artifacts-context'
import { Router } from './router'
import { useWebcontainer } from '@/components/webcontainer/webcontainer-context'
import { FileSystemTree } from '@webcontainer/api'

const mungeFileTree = (fileTree: Record<string, string>): FileSystemTree => {
  const fileNodesAcc: FileSystemTree = {}

  Object.entries(fileTree).forEach(([key, value]) => {
    const path = key.split('/').flatMap((chunk, index, array) => {
      if (index !== array.length - 1) {
        return [chunk, 'directory']
      } else {
        return [chunk, 'file', 'contents']
      }
    })

    set(fileNodesAcc, path, value)
  })

  return fileNodesAcc
}

const Viewer = () => {
  const { state } = useArtifacts()
  const { remount, status } = useWebcontainer()
  const { artifacts, manifest } = state

  const [nodes, , onNodesChange] = useNodesState(toInitialNodes(manifest?.previews ?? {}) ?? [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? [])

  const onConnect: OnConnect = useCallback(
    connection => setEdges(edges => addEdge(connection, edges)),
    [setEdges]
  )

  console.log('STATUS', status)

  useEffect(() => {
    if (!Object.keys(artifacts).length || status !== 'ready') return

    const routerApp = `${new Router(manifest?.previews ?? {})}`

    const fileTree = mungeFileTree({
      ...artifacts,
      ...files,
      'src/App.tsx': routerApp
    })

    remount(fileTree)
  }, [artifacts, status])

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      minZoom={0.1}
      fitView
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  )
}

export default Viewer
