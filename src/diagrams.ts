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
