import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Signal,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { DISPLAY_MODULE_CONFIG } from '../config/display-module.config';
import {
  AddPortCompleteEvent,
  DeletePortCompleteEvent,
  Port,
  SavingStatus,
  UpdateWorkSpaceEvent,
  WorkSpaceNode,
} from '../models/workspace-node.model';
import { NanoAutofocusDirective } from './nano-autofocus.directive';
import {
  ADD_ICON_DATA_URI,
  CHECK_ICON_DATA_URI,
  DELETE_ICON_DATA_URI,
  ICON_FILES,
} from './nano-module.icons';
import { createPortId } from './port-id';

/** Port groups of a node. */
type PortSection = 'parameters' | 'inputs' | 'outputs';

/** Visual mode of the module. Edit mode takes precedence over select mode. */
type ModuleState = 'view' | 'selected' | 'editing';

/** One rendered port group. */
interface SectionView {
  readonly key: PortSection;
  readonly label: string;
  readonly ports: readonly Port[];
}

interface SectionDefinition {
  readonly key: PortSection;
  readonly label: string;
  readonly portType: Port['type'];
}

const SECTION_DEFINITIONS: readonly SectionDefinition[] = [
  { key: 'parameters', label: 'Parameter', portType: 'parameter' },
  { key: 'inputs', label: 'Input', portType: 'input' },
  { key: 'outputs', label: 'Output', portType: 'output' },
];

/** Active-field identifier of the title. Chosen so that it cannot clash with a realistic port id. */
const TITLE_FIELD_ID = '__nano-module-title__';

/** `changeType` passed to `onFieldChange` while the title is typed. */
const TITLE_CHANGE = 'title';

/** `changeType` passed to `onFieldChange` while a new port name is typed. */
const NEW_PORT_CHANGE = 'new-port';

/** Idle time after the last keystroke before the edit is saved and emitted (FR-13). */
const SAVE_DEBOUNCE_MS = 1000;

/** Controls that must never start a canvas drag (FR-23b). */
const FORM_CONTROL_SELECTOR = 'input, textarea, select, button';

/** Wrapper of every inline input (API_CONTRACT.md §2.5). */
const EDIT_WRAPPER_SELECTOR = '.edit-input-wrapper';

/** Per-instance suffix for element ids referenced by `aria-describedby`. */
let nextInstanceId = 0;

function isPortSection(value: string | null | undefined): value is PortSection {
  return value === 'parameters' || value === 'inputs' || value === 'outputs';
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * `<nano-module>`: renders one visual-programming module (title, parameters,
 * inputs, outputs). It supports view, select and edit modes, inline text
 * editing, and adding and removing ports.
 *
 * The host element is the module surface. Add the class `dark` or `light` to
 * `<nano-module>` to pick the theme.
 *
 * @example
 * <nano-module
 *   class="dark"
 *   [(workSpaceNode)]="workSpaceNode"
 *   [ignoreClasses]="['port', 'edit-input-wrapper']"
 *   [isEditMode]="editIndices.has(id)"
 *   [isSelectMode]="selectedIndices.has(id)"
 *   (addPort)="handlePortGeneration($event)"
 *   (deletePort)="handlePortRemoval($event)"
 *   (onModuleUpdate)="onModuleUpdate($event)"
 * />
 *
 * Source: requirement §Overview, §Usage Documentation, §Functional Requirement,
 * §Methods. Contract: API_CONTRACT.md §2.
 */
@Component({
  selector: 'nano-module',
  imports: [NanoAutofocusDirective],
  templateUrl: './nano-module.component.html',
  styleUrl: './nano-module.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '(click)': 'onClick()',
    '(dblclick)': 'onDoubleClick()',
    '(mousedown)': 'onHostMouseDown($event)',
    '(mouseenter)': 'hovered.set(true)',
    '(mouseleave)': 'hovered.set(false)',
  },
})
export class NanoModuleComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly config = inject(DISPLAY_MODULE_CONFIG, { optional: true });

  // ---------------------------------------------------------------- inputs

  /**
   * Two-way bound module node (writable signal / `model()`).
   * Usage: `[(workSpaceNode)]="node"`. Inside edits write a new node object;
   * the bound object is never mutated. FR-1, FR-2.
   */
  readonly workSpaceNode = model.required<WorkSpaceNode>();

  /** Edit-mode master switch, driven by the parent (`editIndices.has(id)`). FR-4. Default `false`. */
  readonly isEditMode = input<boolean>(false);

  /** Selection flag, driven by the parent (`selectedIndices.has(id)`). FR-3. */
  readonly isSelectMode = input.required<boolean>();

  /** CSS classes whose elements must not start a canvas drag. FR-23. */
  readonly ignoreClasses = input.required<string[]>();

  // --------------------------------------------------------------- outputs

  /** Emits when the user presses on a port drag handle (`.port`). FR-18. */
  readonly portMouseDown = output<{ event: MouseEvent; workSpaceNode: WorkSpaceNode; target: Port }>();

  /** Emits when the user releases the mouse over a port drag handle (`.port`). FR-18. */
  readonly portMouseUp = output<{ event: MouseEvent; workSpaceNode: WorkSpaceNode; port: Port }>();

  /**
   * Emits after a new port has been named and its input has lost focus.
   * Not emitted for empty or duplicate names. FR-16, FR-27.
   */
  readonly addPort = output<AddPortCompleteEvent>();

  /** Emits immediately after a port is removed. FR-17. */
  readonly deletePort = output<DeletePortCompleteEvent>();

  /**
   * Emits the updated node when an inline edit commits on blur, and after
   * 1000 ms without typing. The parent reports a failed save by setting
   * `event.success = false` inside its handler (A-05). FR-10, FR-13.
   */
  readonly onModuleUpdate = output<UpdateWorkSpaceEvent>();

  /** Emits the node id on double click. FR-22. */
  readonly nodeDoubleClicked = output<string>();

  /** Emits the node id on single click. FR-21. */
  readonly nodeClicked = output<string>();

  /**
   * Editing-session flag. The requirement types it as `EventEmitter<false>`
   * and only specifies the `false` emission (A-10): it emits `false` when an
   * inline edit session ends. FR-28.
   */
  readonly isEditing = output<boolean>();

  // ----------------------------------------------------------- public state

  private readonly status = signal<SavingStatus>('idle');

  /**
   * Save indicator status: `'idle' | 'saving' | 'saved'`. It is `'saving'`
   * while the user types and `'saved'` once a save completed successfully.
   * FR-12, FR-14.
   */
  readonly savingStatus: Signal<SavingStatus> = this.status.asReadonly();

  // --------------------------------------------------------- template state

  /** Id of the field in inline edit mode: the title, a port id, or `null`. */
  protected readonly selectedEditId = signal<string | null>(null);

  /** Section whose "Add" button is currently replaced by a text input. */
  protected readonly addingSection = signal<PortSection | null>(null);

  /** Text the active inline input starts with. */
  protected readonly draft = signal('');

  /** Whether the pointer is over the module. */
  protected readonly hovered = signal(false);

  /** Editable text the pointer is over (edit mode only). */
  protected readonly hoveredField = signal<string | null>(null);

  protected readonly state = computed<ModuleState>(() => {
    if (this.isEditMode()) return 'editing';
    return this.isSelectMode() ? 'selected' : 'view';
  });

  protected readonly showViewTooltip = computed(() => this.hovered() && this.state() === 'view');

  protected readonly sections = computed<readonly SectionView[]>(() => {
    const node = this.workSpaceNode();
    return SECTION_DEFINITIONS.map(({ key, label }) => ({ key, label, ports: node[key] ?? [] }));
  });

  protected readonly titleFieldId = TITLE_FIELD_ID;
  protected readonly titleChange = TITLE_CHANGE;
  protected readonly newPortChange = NEW_PORT_CHANGE;
  protected readonly checkIcon = CHECK_ICON_DATA_URI;
  protected readonly addIcon = this.iconUrl(ICON_FILES.add, ADD_ICON_DATA_URI);
  protected readonly deleteIcon = this.iconUrl(ICON_FILES.remove, DELETE_ICON_DATA_URI);

  private readonly instanceId = nextInstanceId++;
  protected readonly viewTooltipId = `nano-module-view-tooltip-${this.instanceId}`;
  protected readonly editTooltipId = `nano-module-edit-tooltip-${this.instanceId}`;

  // ---------------------------------------------------------- save tracking

  /** Last status that was not `'saving'`; restored when typing ends without a save. */
  private settledStatus: Exclude<SavingStatus, 'saving'> = 'idle';

  /** Incremented by every save-related action, so a late `onCompleted` call cannot override a newer one. */
  private saveSequence = 0;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Leaving edit mode closes every inline input without saving it.
    effect(() => {
      if (!this.isEditMode()) {
        untracked(() => this.cancelEditing());
      }
    });
    inject(DestroyRef).onDestroy(() => this.clearSaveTimer());
  }

  // --------------------------------------------------------------- methods

  /**
   * Stops propagation and sets the active inline-edit field (the title or a
   * port id). The field only opens in edit mode. FR-8.
   */
  openEditField(fieldIdentifier: string, event: Event): void {
    event.stopPropagation();
    if (!this.isEditMode()) return;
    this.blurOpenInput();
    this.hoveredField.set(null);
    this.addingSection.set(null);
    this.draft.set(this.textOf(fieldIdentifier));
    this.selectedEditId.set(fieldIdentifier);
  }

  /** Hides the active input and restores the text view. FR-10. */
  closeEditField(): void {
    this.selectedEditId.set(null);
  }

  /**
   * Starts adding a new port in the section that contains the clicked "Add"
   * button; halts propagation and the default action. `addPort` is emitted
   * later, when the new name is committed. FR-16.
   */
  onAddClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.isEditMode()) return;
    const section = this.sectionOf(event.currentTarget ?? event.target);
    if (!section) return;
    this.blurOpenInput();
    this.closeEditField();
    this.hoveredField.set(null);
    this.addingSection.set(section);
  }

  /** Removes a port, stops propagation, writes the model and emits `deletePort`. FR-17. */
  onDeleteClick(node: Port, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const current = this.workSpaceNode();
    const without = (ports: Port[]): Port[] => {
      const remaining = ports.filter((port) => port.id !== node.id);
      return remaining.length === ports.length ? ports : remaining;
    };
    const next: WorkSpaceNode = {
      ...current,
      parameters: without(current.parameters),
      inputs: without(current.inputs),
      outputs: without(current.outputs),
    };
    if (
      next.parameters === current.parameters &&
      next.inputs === current.inputs &&
      next.outputs === current.outputs
    ) {
      return;
    }
    if (this.selectedEditId() === node.id) {
      this.clearSaveTimer();
      this.closeEditField();
    }
    this.workSpaceNode.set(next);
    const onCompleted = this.trackCompletion();
    this.settle('saved');
    this.deletePort.emit({ updateWorkSpaceNode: next, onCompleted });
  }

  /** Emits the node id through `nodeDoubleClicked`. FR-22. */
  onDoubleClick(): void {
    this.nodeDoubleClicked.emit(this.workSpaceNode().id);
  }

  /**
   * Emits the node id through `nodeClicked`. The parent owns the selection and
   * changes the border through `isSelectMode` (A-12). FR-21.
   */
  onClick(): void {
    this.nodeClicked.emit(this.workSpaceNode().id);
  }

  /**
   * Commits or cancels an inline port edit when focus is lost. The value is
   * trimmed and the field closes. A non-empty, changed and unique name
   * (FR-27) replaces the port immutably and emits `onModuleUpdate`. Finally
   * `isEditing` emits `false`. FR-10.
   */
  onInputBlur(port: Port, inputElement: HTMLInputElement): void {
    const value = inputElement.value.trim();
    this.closeEditField();
    this.clearSaveTimer();
    const committed = this.isEditMode() && this.commitPortName(port.id, port.name, value);
    if (!committed) this.settleWithoutSave();
    this.isEditing.emit(false);
  }

  /** Enter key: calls `inputElement.blur()` so that `onInputBlur` handles the commit. FR-11. */
  onInputEnter(node: Port, inputElement: HTMLInputElement): void {
    void node;
    inputElement.blur();
  }

  /**
   * Typing handler: shows "Saving changes…". When a `payload` is given, the
   * typed value is saved and `onModuleUpdate` is emitted after 1000 ms without
   * typing. FR-12, FR-13.
   *
   * @param changeType `'title'`, or the section of the edited port
   * (`'parameters' | 'inputs' | 'outputs'`). Other values only show the status.
   * @param payload Index of the port in its section (ignored for the title)
   * and the current input value.
   */
  onFieldChange(changeType: string, payload?: { index: number; value: string }): void {
    this.saveSequence += 1;
    this.status.set('saving');
    this.clearSaveTimer();
    if (!payload) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.autosave(changeType, payload);
    }, SAVE_DEBOUNCE_MS);
  }

  // ----------------------------------------------------- template handlers

  /** Click on title or port text: opens the inline input in edit mode, otherwise lets the click bubble. */
  protected onTextClick(fieldIdentifier: string, event: Event): void {
    if (this.isEditMode()) {
      this.openEditField(fieldIdentifier, event);
    }
  }

  protected onTextEnter(fieldIdentifier: string): void {
    if (this.isEditMode()) {
      this.hoveredField.set(fieldIdentifier);
    }
  }

  protected onTextLeave(fieldIdentifier: string): void {
    if (this.hoveredField() === fieldIdentifier) {
      this.hoveredField.set(null);
    }
  }

  /** Enter or Escape: leaves the input through its blur handler. FR-11. */
  protected blurInput(inputElement: HTMLInputElement): void {
    inputElement.blur();
  }

  /** Title counterpart of `onInputBlur`. FR-10. */
  protected onTitleBlur(inputElement: HTMLInputElement): void {
    const value = inputElement.value.trim();
    this.closeEditField();
    this.clearSaveTimer();
    const committed = this.isEditMode() && this.commitTitle(value);
    if (!committed) this.settleWithoutSave();
    this.isEditing.emit(false);
  }

  /** Adds the named port, or cancels when the name is empty or already used. FR-16, FR-27. */
  protected onNewPortBlur(section: PortSection, inputElement: HTMLInputElement): void {
    if (this.addingSection() !== section) return;
    const value = inputElement.value.trim();
    this.addingSection.set(null);
    this.clearSaveTimer();
    const node = this.workSpaceNode();
    if (this.isEditMode() && value && !this.isNameTaken(node, value)) {
      const port: Port = {
        id: createPortId(new Set(this.allPorts(node).map((existing) => existing.id))),
        name: value,
        type: this.portTypeOf(section),
        nodeType: 'module',
        color: '',
      };
      const next: WorkSpaceNode = { ...node };
      next[section] = [...node[section], port];
      this.workSpaceNode.set(next);
      const onCompleted = this.trackCompletion();
      this.settle('saved');
      this.addPort.emit({ updateWorkSpaceNode: next, onCompleted });
    } else {
      this.settleWithoutSave();
    }
    this.isEditing.emit(false);
  }

  protected onPortMouseDown(event: MouseEvent, port: Port): void {
    this.portMouseDown.emit({ event, workSpaceNode: this.workSpaceNode(), target: port });
  }

  protected onPortMouseUp(event: MouseEvent, port: Port): void {
    this.portMouseUp.emit({ event, workSpaceNode: this.workSpaceNode(), port });
  }

  /**
   * Drag isolation (FR-23). A press on a form control, a port handle, editable
   * text or an `ignoreClasses` element does not reach the canvas. A press
   * outside the open inline input blurs it, which commits the edit.
   */
  protected onHostMouseDown(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(EDIT_WRAPPER_SELECTOR)) {
      this.blurOpenInput();
    }
    if (this.blocksCanvasDrag(target)) {
      event.stopPropagation();
    }
  }

  // --------------------------------------------------------------- internals

  private iconUrl(fileName: string, inlineIcon: string): string {
    const assetPath = this.config?.assetPath;
    if (!assetPath) return inlineIcon;
    return assetPath.endsWith('/') ? assetPath + fileName : `${assetPath}/${fileName}`;
  }

  private allPorts(node: WorkSpaceNode): Port[] {
    return [...(node.parameters ?? []), ...(node.inputs ?? []), ...(node.outputs ?? [])];
  }

  private portTypeOf(section: PortSection): Port['type'] {
    if (section === 'parameters') return 'parameter';
    return section === 'inputs' ? 'input' : 'output';
  }

  private textOf(fieldIdentifier: string): string {
    const node = this.workSpaceNode();
    if (fieldIdentifier === TITLE_FIELD_ID) return node.title;
    return this.allPorts(node).find((port) => port.id === fieldIdentifier)?.name ?? '';
  }

  private sectionOf(target: EventTarget | null): PortSection | null {
    if (!(target instanceof Element)) return null;
    const section = target.closest('[data-section]')?.getAttribute('data-section');
    return isPortSection(section) ? section : null;
  }

  /** Case-insensitive, node-wide name check (FR-27). `exceptId` is the port being renamed (A-32). */
  private isNameTaken(node: WorkSpaceNode, name: string, exceptId?: string): boolean {
    const wanted = normaliseName(name);
    return this.allPorts(node).some(
      (port) => port.id !== exceptId && normaliseName(port.name) === wanted,
    );
  }

  private commitTitle(value: string): boolean {
    const node = this.workSpaceNode();
    if (!value || value === node.title) return false;
    const next: WorkSpaceNode = { ...node, title: value };
    this.workSpaceNode.set(next);
    this.emitUpdate(next);
    return true;
  }

  private commitPortName(portId: string, originalName: string, value: string): boolean {
    if (!value || value === originalName) return false;
    const node = this.workSpaceNode();
    if (this.isNameTaken(node, value, portId)) return false;
    let found = false;
    const rename = (ports: Port[]): Port[] => {
      if (!ports.some((port) => port.id === portId)) return ports;
      found = true;
      return ports.map((port) => (port.id === portId ? { ...port, name: value } : port));
    };
    const next: WorkSpaceNode = {
      ...node,
      parameters: rename(node.parameters),
      inputs: rename(node.inputs),
      outputs: rename(node.outputs),
    };
    if (!found) return false;
    this.workSpaceNode.set(next);
    this.emitUpdate(next);
    return true;
  }

  /** Runs once typing has stopped for {@link SAVE_DEBOUNCE_MS}. */
  private autosave(changeType: string, payload: { index: number; value: string }): void {
    const value = payload.value.trim();
    let committed = false;
    if (this.isEditMode()) {
      if (changeType === TITLE_CHANGE) {
        committed = this.commitTitle(value);
      } else if (isPortSection(changeType)) {
        const ports = this.workSpaceNode()[changeType];
        const activeId = this.selectedEditId();
        const port = ports.find((candidate) => candidate.id === activeId) ?? ports[payload.index];
        if (port) {
          committed = this.commitPortName(port.id, port.name, value);
        }
      }
    }
    if (!committed) this.settleWithoutSave();
  }

  /** Emits `onModuleUpdate` and reads the save result the parent wrote to the event (A-05). */
  private emitUpdate(next: WorkSpaceNode): void {
    this.saveSequence += 1;
    const event: UpdateWorkSpaceEvent = { updateWorkSpaceNode: next, success: true };
    this.onModuleUpdate.emit(event);
    this.settle(event.success ? 'saved' : 'idle');
  }

  /** Builds the `onCompleted` callback of an add or delete event. */
  private trackCompletion(): (success: boolean) => void {
    this.saveSequence += 1;
    const sequence = this.saveSequence;
    return (success: boolean): void => {
      if (sequence === this.saveSequence) {
        this.settle(success ? 'saved' : 'idle');
      }
    };
  }

  private settle(next: Exclude<SavingStatus, 'saving'>): void {
    this.settledStatus = next;
    this.status.set(next);
  }

  /** Typing ended without a save: restore the status shown before typing started. */
  private settleWithoutSave(): void {
    if (this.status() === 'saving') {
      this.status.set(this.settledStatus);
    }
  }

  private clearSaveTimer(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private cancelEditing(): void {
    this.clearSaveTimer();
    this.selectedEditId.set(null);
    this.addingSection.set(null);
    this.hoveredField.set(null);
    this.settleWithoutSave();
  }

  /** Blurs the open inline input, so its blur handler commits or cancels it. */
  private blurOpenInput(): void {
    this.host.nativeElement
      .querySelector<HTMLInputElement>(`${EDIT_WRAPPER_SELECTOR} input`)
      ?.blur();
  }

  private blocksCanvasDrag(target: Element): boolean {
    const hostElement = this.host.nativeElement;
    const ignored = this.ignoreClasses() ?? [];
    let current: Element | null = target;
    while (current && hostElement.contains(current)) {
      const element: Element = current;
      if (element !== hostElement) {
        if (element.matches(FORM_CONTROL_SELECTOR)) return true;
        if (element.classList.contains('port')) return true;
        if (element.classList.contains('nm-text--editable')) return true;
      }
      if (ignored.some((name) => name.length > 0 && element.classList.contains(name))) return true;
      current = element.parentElement;
    }
    return false;
  }
}
