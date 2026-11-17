import {
  ChangeDetectionStrategy,
  Component,
  EnvironmentProviders,
  Provider,
  computed,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

import { NanoModuleComponentHarness } from '../../testing/public-api';
import { NanoModuleComponent } from '../lib/nano-module/nano-module.component';
import {
  AddPortCompleteEvent,
  DeletePortCompleteEvent,
  Port,
  UpdateWorkSpaceEvent,
  WorkSpaceNode,
} from '../lib/models/workspace-node.model';
import { createNode } from './fixtures';

/**
 * Parent fixture mirroring the requirement's Usage Documentation:
 * a canvas that owns `editIndices` / `selectedIndices`, binds the node
 * two-way and records every output.
 *
 * All binding NAMES used by the public tests are written in this one
 * template (see AMBIGUITY_LOG.md A-01).
 */
@Component({
  selector: 'dm-test-host',
  imports: [NanoModuleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="test-canvas"
      style="position: relative; padding: 64px; width: 600px; height: 400px;"
      (mousedown)="canvasMouseDown.push($event)"
      (click)="canvasClick.push($event)"
    >
      <nano-module
        [class]="theme()"
        [(workSpaceNode)]="node"
        [ignoreClasses]="ignoreClasses()"
        [isEditMode]="isEdit()"
        [isSelectMode]="isSelected()"
        (addPort)="onAdd($event)"
        (deletePort)="onDelete($event)"
        (onModuleUpdate)="onUpdate($event)"
        (nodeClicked)="onNodeClicked($event)"
        (nodeDoubleClicked)="doubleClicked.push($event)"
        (portMouseDown)="portDown.push($event)"
        (portMouseUp)="portUp.push($event)"
        (isEditing)="isEditingEvents.push($event)"
      />
    </div>
  `,
})
export class NanoModuleTestHost {
  readonly node = signal<WorkSpaceNode>(createNode());
  readonly theme = signal<'dark' | 'light'>('dark');
  readonly ignoreClasses = signal<string[]>(['port', 'edit-input-wrapper']);
  readonly editIndices = signal<ReadonlySet<string>>(new Set());
  readonly selectedIndices = signal<ReadonlySet<string>>(new Set());
  readonly isEdit = computed(() => this.editIndices().has(this.node().id));
  readonly isSelected = computed(() => this.selectedIndices().has(this.node().id));

  /** When true, `nodeClicked` adds the id to `selectedIndices` (as a canvas would). */
  selectOnClick = true;
  /**
   * PROVISIONAL save handshake (A-05). When set, the parent writes this value to
   * `event.success` synchronously inside its `onModuleUpdate` handler.
   */
  saveResult: boolean | undefined = undefined;
  /** When set, the parent calls `onCompleted(addResult)` on `addPort` events. */
  addResult: boolean | undefined = undefined;
  /** When set, the parent calls `onCompleted(deleteResult)` on `deletePort` events. */
  deleteResult: boolean | undefined = undefined;

  readonly added: AddPortCompleteEvent[] = [];
  readonly deleted: DeletePortCompleteEvent[] = [];
  readonly updates: UpdateWorkSpaceEvent[] = [];
  readonly clicked: string[] = [];
  readonly doubleClicked: string[] = [];
  readonly portDown: { event: MouseEvent; workSpaceNode: WorkSpaceNode; target: Port }[] = [];
  readonly portUp: { event: MouseEvent; workSpaceNode: WorkSpaceNode; port: Port }[] = [];
  readonly isEditingEvents: boolean[] = [];
  readonly canvasMouseDown: MouseEvent[] = [];
  readonly canvasClick: MouseEvent[] = [];

  onAdd(e: AddPortCompleteEvent): void {
    this.added.push(e);
    if (this.addResult !== undefined) e.onCompleted(this.addResult);
  }

  onDelete(e: DeletePortCompleteEvent): void {
    this.deleted.push(e);
    if (this.deleteResult !== undefined) e.onCompleted(this.deleteResult);
  }

  onUpdate(e: UpdateWorkSpaceEvent): void {
    this.updates.push(e);
    if (this.saveResult !== undefined) e.success = this.saveResult;
  }

  onNodeClicked(id: string): void {
    this.clicked.push(id);
    if (this.selectOnClick) this.selectedIndices.update((s) => new Set([...s, id]));
  }

  setEditMode(on: boolean): void {
    const id = this.node().id;
    this.editIndices.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  setSelectMode(on: boolean): void {
    const id = this.node().id;
    this.selectedIndices.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

export interface RenderOptions {
  node?: WorkSpaceNode;
  theme?: 'dark' | 'light';
  editMode?: boolean;
  selectMode?: boolean;
  ignoreClasses?: string[];
  providers?: (Provider | EnvironmentProviders)[];
}

export interface Rendered {
  fixture: ComponentFixture<NanoModuleTestHost>;
  host: NanoModuleTestHost;
  harness: NanoModuleComponentHarness;
  /** The `<nano-module>` host element. */
  moduleEl: HTMLElement;
  /** The parent canvas element. */
  canvasEl: HTMLElement;
  /** Runs change detection and waits for the app to be stable. */
  settle: () => Promise<void>;
}

/** Renders `<nano-module>` inside {@link NanoModuleTestHost}. */
export async function renderModule(options: RenderOptions = {}): Promise<Rendered> {
  // Allows several renders in one test (e.g. theme comparisons, property runs).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [NanoModuleTestHost],
    providers: options.providers ?? [],
  });
  const fixture = TestBed.createComponent(NanoModuleTestHost);
  const host = fixture.componentInstance;
  if (options.node) host.node.set(options.node);
  if (options.theme) host.theme.set(options.theme);
  if (options.ignoreClasses) host.ignoreClasses.set(options.ignoreClasses);
  if (options.editMode) host.setEditMode(true);
  if (options.selectMode) host.setSelectMode(true);

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await settle();

  const harness = await TestbedHarnessEnvironment.loader(fixture).getHarness(
    NanoModuleComponentHarness,
  );
  const root = fixture.nativeElement as HTMLElement;
  const moduleEl = root.querySelector('nano-module') as HTMLElement;
  const canvasEl = root.querySelector('.test-canvas') as HTMLElement;
  return { fixture, host, harness, moduleEl, canvasEl, settle };
}
