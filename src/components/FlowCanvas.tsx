// src/components/FlowCanvas.tsx

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useCallback, useRef } from 'react'
import { useWorkflow } from './WorkflowContext'
import { NODE_TEMPLATES } from '../data/nodeTemplates'
import type { NodeType } from '../types/workflow'

let nodeIdCounter = 1

export default function FlowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setEdges,
    setNodes,
    setSelectedNodeId,
  } = useWorkflow()

  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // 建立连线时触发
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds: any) => addEdge(connection, eds))
    },
    [setEdges]
  )

  // 拖拽进入画布时，阻止默认行为（否则 drop 不触发）
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  // 松手放下节点时触发
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      // 读取拖拽时存入的节点类型
      const nodeType = event.dataTransfer.getData('nodeType') as NodeType
      if (!nodeType) return

      // 把鼠标位置转换为画布坐标
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      const position = {
        x: event.clientX - bounds.left - 75,
        y: event.clientY - bounds.top - 20,
      }

      // 用模板创建新节点
      const template = NODE_TEMPLATES[nodeType]
      const newNode = {
        ...template,
        id: `node-${nodeIdCounter++}`,
        position,
      }

      setNodes((nds: any) => [...nds, newNode])
    },
    [setNodes]
  )

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
