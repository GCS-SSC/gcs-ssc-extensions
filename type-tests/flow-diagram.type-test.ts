import type { FlowDiagramDefinition, FlowDiagramProps, FlowDiagramRoute } from '../src/ui'

const definition: FlowDiagramDefinition = {
  title: 'Application flow',
  nodes: [
    { id: 'start', kind: 'start', title: 'Start', routes: [{ targetId: 'review', kind: 'direct' }] },
    { id: 'review', kind: 'decision', title: 'Review', lines: ['Manager approval'], selectLabel: 'Open review', routes: [
      { targetId: 'end', kind: 'conditional', label: 'Approved', detail: 'All approvers agree', targetLabel: 'Complete' },
      { targetId: 'end', kind: 'failure', label: 'Denied' }
    ] },
    { id: 'end', kind: 'end', title: 'Complete' }
  ]
}
const props: FlowDiagramProps = { definition, selectedNodeId: 'review', filename: 'application', direction: 'vertical' }
// @ts-expect-error Routes require a concrete destination node.
const missingTarget: FlowDiagramRoute = { kind: 'direct' }
// @ts-expect-error HTML is not a node kind; diagram labels are plain text.
const arbitraryNode: FlowDiagramDefinition = { title: 'Invalid', nodes: [{ id: '1', kind: 'html', title: '<script />' }] }
// @ts-expect-error Edge styles are supplied by the host renderer.
const arbitraryStyle: FlowDiagramRoute = { targetId: 'end', kind: 'custom' }
void [props, missingTarget, arbitraryNode, arbitraryStyle]
