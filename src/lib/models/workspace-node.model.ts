/**
 * Public data models for the `display-module` library.
 *
 * Shapes are copied from the approved requirement ("Models" section).
 * Source: requirement.pdf §Models. See API_CONTRACT.md §3.
 */

/**
 * A single connection point (parameter, input or output) on a module.
 * Source: requirement §Models `Port`.
 */
export interface Port {
  /** Unique identifier. Rendered as the DOM `id` of the port handle (FR-19). */
  id: string;
  /** Display name. Must be unique (case-insensitive) within the node (FR-27). */
  name: string;
  nodeType: 'input' | 'output' | 'module';
  type: 'input' | 'output' | 'parameter';
  color: string;
}

/**
 * The module node rendered by `<nano-module>`.
 * Source: requirement §Models `WorkSpaceNode`.
 */
export interface WorkSpaceNode {
  id: string;
  x: number;
  y: number;
  parameters: Port[];
  inputs: Port[];
  outputs: Port[];
  title: string;
  metadata?: string;
}

/**
 * Payload of the `onModuleUpdate` output.
 * Source: requirement §Models `UpdateWorkSpaceEvent`.
 *
 * PROVISIONAL (see AMBIGUITY_LOG.md A-05): the save-result handshake is not
 * specified. The tests assume the parent reports a failed save by setting
 * `success = false` on the received event synchronously inside its handler.
 */
export interface UpdateWorkSpaceEvent {
  updateWorkSpaceNode: WorkSpaceNode;
  success: boolean;
}

/**
 * Payload of the `deletePort` output.
 * Source: requirement §Models `DeletePortCompleteEvent`.
 * The requirement text `onCompleted(success:boolean)=>void` is not valid
 * TypeScript; it is expressed here as a function-typed property (A-11).
 */
export interface DeletePortCompleteEvent {
  updateWorkSpaceNode: WorkSpaceNode;
  onCompleted: (success: boolean) => void;
}

/**
 * Payload of the `addPort` output.
 * Source: requirement §Models `AddPortCompleteEvent` (see A-11).
 */
export interface AddPortCompleteEvent {
  updateWorkSpaceNode: WorkSpaceNode;
  onCompleted: (success: boolean) => void;
}

/**
 * Values of the public `savingStatus` signal.
 * Source: requirement §Functional "Introduce a savingStatus signal that changes
 * between 'idle', 'saving' and 'saved'".
 */
export type SavingStatus = 'idle' | 'saving' | 'saved';
