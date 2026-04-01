// src/components/WorkflowContext.tsx

import { createContext, useContext, useState, ReactNode } from 'react'
import type { WorkflowNode, WorkflowEdge, WorkflowResult } from '../types/workflow'
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from 'reactflow'

interface WorkflowContextType {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNodeId: string | null
  result: WorkflowResult | null
  error: string | null
  isRunning: boolean
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: WorkflowEdge[]) => void
  setSelectedNodeId: (id: string | null) => void
  setResult: (result: WorkflowResult | null) => void
  setError: (error: string | null) => void
  setIsRunning: (running: boolean) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
}

const WorkflowContext = createContext<WorkflowContextType | null>(null)

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [result, setResult] = useState<WorkflowResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as WorkflowNode[])
  }

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds) as WorkflowEdge[])
  }

  return (
    <WorkflowContext.Provider
      value={{
        nodes,
        edges,
        selectedNodeId,
        result,
        error,
        isRunning,
        setNodes,
        setEdges,
        setSelectedNodeId,
        setResult,
        setError,
        setIsRunning,
        onNodesChange,
        onEdgesChange,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error('useWorkflow must be used inside WorkflowProvider')
  return ctx
}
