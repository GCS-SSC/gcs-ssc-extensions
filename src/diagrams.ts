export type FlowDiagramEdgeKind = 'direct' | 'conditional' | 'default' | 'failure'

export interface FlowDiagramRoute {
  targetId: string
  kind: FlowDiagramEdgeKind
  label?: string
  detail?: string
  targetLabel?: string
}

export interface FlowDiagramNode {
  id: string
  kind: 'start' | 'step' | 'decision' | 'end'
  title: string
  eyebrow?: string
  lines?: string[]
  selectLabel?: string
  routes?: FlowDiagramRoute[]
}

export interface FlowDiagramDefinition {
  title: string
  description?: string
  stats?: string[]
  orderLabel?: string
  selectHint?: string
  nodes: FlowDiagramNode[]
}

export interface FlowDiagramProps {
  definition: FlowDiagramDefinition
  selectedNodeId?: string
  filename?: string
  direction?: 'auto' | 'vertical'
}

export interface WorkflowBpmnTask {
  id: string
  label: string
  groupLabel?: string
  owner: {
    key: string
    kind: 'user' | 'group' | 'initiator' | 'system' | 'unassigned'
    label: string
    unavailable: boolean
  }
  predecessors: string[]
}

export interface WorkflowBpmnDefinition {
  graph: FlowDiagramDefinition
  tasksByNode: Record<string, WorkflowBpmnTask[]>
}

export interface WorkflowBpmnViewerProps {
  definition: WorkflowBpmnDefinition
  highlightedNodeIds: readonly string[]
  filename: string
  extensionKey: string
}
