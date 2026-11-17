import { Port, WorkSpaceNode } from '../lib/models/workspace-node.model';

/** Neutral grey (Figma `fg-senary`), so a hover colour change is attributable to the component. */
export const NEUTRAL_PORT_COLOR = '#61646c';

export function createPort(
  type: Port['type'],
  id: string,
  name: string,
  overrides: Partial<Port> = {},
): Port {
  return { id, name, type, nodeType: 'module', color: NEUTRAL_PORT_COLOR, ...overrides };
}

/**
 * Reference node modelled on the Figma "Module's default design" frame.
 * Names are unique case-insensitively across the node (see A-07).
 */
export function createNode(overrides: Partial<WorkSpaceNode> = {}): WorkSpaceNode {
  return {
    id: 'node-1',
    x: 120,
    y: 80,
    title: 'AI Dataset Analyser',
    parameters: [
      createPort('parameter', 'param-1', 'Parameter 1'),
      createPort('parameter', 'param-2', 'Parameter 2'),
    ],
    inputs: [
      createPort('input', 'in-1', 'Dataset Object'),
      createPort('input', 'in-2', 'Answered User Input'),
    ],
    outputs: [
      createPort('output', 'out-1', 'Is Finished'),
      createPort('output', 'out-2', 'Result Object'),
      createPort('output', 'out-3', 'User Input Request'),
    ],
    ...overrides,
  };
}

/** Deep clone used to verify immutable updates. */
export function cloneNode(node: WorkSpaceNode): WorkSpaceNode {
  return JSON.parse(JSON.stringify(node)) as WorkSpaceNode;
}

export type SectionKey = 'parameters' | 'inputs' | 'outputs';

export const SECTIONS: readonly { section: SectionKey; portType: Port['type']; sample: string }[] = [
  { section: 'parameters', portType: 'parameter', sample: 'Parameter 1' },
  { section: 'inputs', portType: 'input', sample: 'Dataset Object' },
  { section: 'outputs', portType: 'output', sample: 'Is Finished' },
];

/** All port names of a node, every section. */
export function allPortNames(node: WorkSpaceNode): string[] {
  return [...node.parameters, ...node.inputs, ...node.outputs].map((p) => p.name);
}

/** All port ids of a node, every section. */
export function allPortIds(node: WorkSpaceNode): string[] {
  return [...node.parameters, ...node.inputs, ...node.outputs].map((p) => p.id);
}
