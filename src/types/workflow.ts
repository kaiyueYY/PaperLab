// src/types/workflow.ts

export type NodeType = 'input' | 'analysis' | 'outline'

export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

export interface LiteratureItem {
  id: string
  title: string
  abstract: string
}

export interface InputNodeData {
  literature: LiteratureItem[]
}

export interface AnalysisNodeData {
  model: string
  language: string
}

export interface OutlineNodeData {
  format: 'markdown' | 'plaintext'
}

export type NodeData = InputNodeData | AnalysisNodeData | OutlineNodeData

export interface WorkflowNode {
  id: string
  type: NodeType
  status: NodeStatus
  position: { x: number; y: number }
  data: NodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
}

export interface WorkflowResult {
  summary: string
  keywords: string[]
  outline: string
}
