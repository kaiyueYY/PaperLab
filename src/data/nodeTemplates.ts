// src/data/nodeTemplates.ts

import type { WorkflowNode } from '../types/workflow'

export const inputTemplate: Omit<WorkflowNode, 'id' | 'position'> = {
  type: 'input',
  status: 'idle',
  data: {
    literature: [],
  },
}

export const analysisTemplate: Omit<WorkflowNode, 'id' | 'position'> = {
  type: 'analysis',
  status: 'idle',
  data: {
    model: 'gpt-4',
    language: 'zh',
  },
}

export const outlineTemplate: Omit<WorkflowNode, 'id' | 'position'> = {
  type: 'outline',
  status: 'idle',
  data: {
    format: 'markdown',
  },
}

// 根据节点类型返回对应模板，供拖拽创建节点时使用
export const NODE_TEMPLATES = {
  input: inputTemplate,
  analysis: analysisTemplate,
  outline: outlineTemplate,
} as const
