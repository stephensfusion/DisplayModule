# display-module

`<nano-module>` renders one visual-programming module node (`WorkSpaceNode`): a title, parameters, inputs and outputs. It supports a view mode, a select mode and an edit mode with inline text editing, adding and deleting ports, and a save-status indicator.

The library only displays and edits the node. Selection, edit-mode state, dragging, positioning and persistence belong to the consuming application and are wired through inputs and outputs.

## Installation

```bash
npm install display-module
```

### Peer dependencies

| Package | Version |
|---|---|
| `@angular/core` | `^22.2.6` |
| `@angular/common` | `^22.2.6` |
| `@angular/cdk` | `^22.2.7` (only used by the `display-module/testing` harness) |

## Setup

`NanoModuleComponent` is standalone. Import it where it is used.

```ts
import { Component, signal } from '@angular/core';
import { NanoModuleComponent, WorkSpaceNode } from 'display-module';

@Component({
  imports: [NanoModuleComponent],
  templateUrl: './canvas.html',
})
export class Canvas {
  workSpaceNode = signal<WorkSpaceNode>({
    id: 'node-1',
    x: 120,
    y: 80,
    title: 'AI Dataset Analyser',
    parameters: [],
    inputs: [],
    outputs: [],
  });
}
```

Styles: the component carries its own styles. The exported stylesheet publishes the theme tokens so they can be read and overridden in one place. Import it after BDS:

```css
@import 'https://cdn.syncfusion.com/ej2/32.1.19/bds.css';
@import 'display-module/styles/display-module.css';
```

### Optional configuration: icon location

The add and delete icons are inlined as Base64 by default. To serve them from your own location, provide an asset path. The component then loads `plus-circle.svg` and `trash-03.svg` from it. Both files ship in the package under `display-module/assets/`.

```ts
import { provideDisplayModule } from 'display-module';

bootstrapApplication(App, {
  providers: [provideDisplayModule({ assetPath: '/assets/nano/' })],
});
```

## Usage

The approved requirement gives this example:

```html
<nano-module
  class = "dark"
  [nodeModule] = "workSpaceNode"
  [ignoreClasses]="['port', 'edit-input-wrapper']"
  [IsEditMode]="editIndices.has(id)"
  [IsSelectedMode] = "selectedIndices.has(id)"
  (addPort)="handlePortGeneration($event)"
  (removePort)="handlePortRemoval($event)"
  (editNode) = "onModuleUpdate($event)"
>
</nano-module>
```

The approved API contract names the bindings differently (ambiguity A-01 and A-04, still open). **The implemented names are the contract's**, so the example above is written like this:

```html
<nano-module
  class="dark"
  [(workSpaceNode)]="workSpaceNode"
  [ignoreClasses]="['port', 'edit-input-wrapper']"
  [isEditMode]="editIndices.has(id)"
  [isSelectMode]="selectedIndices.has(id)"
  (addPort)="handlePortGeneration($event)"
  (deletePort)="handlePortRemoval($event)"
  (onModuleUpdate)="onModuleUpdate($event)"
  (nodeClicked)="openActionMenu($event)"
  (nodeDoubleClicked)="openLogicLayer($event)"
  (portMouseDown)="startConnection($event)"
  (portMouseUp)="endConnection($event)"
/>
```

Reporting a save result:

```ts
onModuleUpdate(event: UpdateWorkSpaceEvent): void {
  // Set success synchronously. `false` hides "Changes saved".
  event.success = this.store.trySave(event.updateWorkSpaceNode);
}

handlePortGeneration(event: AddPortCompleteEvent): void {
  this.api.save(event.updateWorkSpaceNode).subscribe({
    next: () => event.onCompleted(true),
    error: () => event.onCompleted(false),
  });
}
```

## API reference

### Inputs

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `workSpaceNode` | `WorkSpaceNode` (two-way, `model.required`) | yes | n/a | The node to render. Inside edits write a new object; the bound object is never mutated. |
| `isEditMode` | `boolean` | no | `false` | Edit-mode switch: "Editing" badge, edit border, add and delete buttons, inline editing. |
| `isSelectMode` | `boolean` | yes | n/a | Applies the selection border and raises the module above unselected ones. |
| `ignoreClasses` | `string[]` | yes | n/a | A mousedown inside an element with one of these classes does not reach the canvas. |

### Outputs

| Name | Payload | Emitted |
|---|---|---|
| `portMouseDown` | `{ event: MouseEvent; workSpaceNode: WorkSpaceNode; target: Port }` | Mousedown on a port handle (`.port`). |
| `portMouseUp` | `{ event: MouseEvent; workSpaceNode: WorkSpaceNode; port: Port }` | Mouseup on a port handle. |
| `addPort` | `AddPortCompleteEvent` | After a new port is named and its input loses focus. Not for empty or duplicate names. |
| `deletePort` | `DeletePortCompleteEvent` | Immediately after a port is removed. |
| `onModuleUpdate` | `UpdateWorkSpaceEvent` | When an inline edit commits on blur, and after 1000 ms without typing. |
| `nodeClicked` | `string` (node id) | Single click on the module. |
| `nodeDoubleClicked` | `string` (node id) | Double click on the module. |
| `isEditing` | `boolean` | `false` when an inline edit session ends. |

### Public signal

| Name | Type | Description |
|---|---|---|
| `savingStatus` | `Signal<'idle' \| 'saving' \| 'saved'>` | `'saving'` while the user types; `'saved'` after a successful save; back to `'idle'` after a failed one. |

### Methods

| Signature | Behaviour |
|---|---|
| `openEditField(fieldIdentifier: string, event: Event): void` | Stops propagation and opens the inline input of the title or of a port id (edit mode only). |
| `closeEditField(): void` | Hides the inline input and shows the text again. |
| `onAddClick(event: MouseEvent): void` | Stops propagation and the default action, then opens the new-port input of the section that contains the clicked button. |
| `onDeleteClick(node: Port, event: MouseEvent): void` | Stops propagation, removes the port, writes the model and emits `deletePort`. |
| `onClick(): void` | Emits `nodeClicked` with the node id. |
| `onDoubleClick(): void` | Emits `nodeDoubleClicked` with the node id. |
| `onInputBlur(port: Port, inputElement: HTMLInputElement): void` | Trims, closes the field, saves a non-empty, changed and unique name, then emits `isEditing(false)`. |
| `onInputEnter(node: Port, inputElement: HTMLInputElement): void` | Calls `inputElement.blur()`. |
| `onFieldChange(changeType: string, payload?: { index: number; value: string }): void` | Sets `'saving'`. With a payload, saves and emits after 1000 ms without typing. `changeType` is `'title'` or the port's section (`'parameters'`, `'inputs'`, `'outputs'`). |

### Models

```ts
interface Port {
  id: string;
  name: string;
  nodeType: 'input' | 'output' | 'module';
  type: 'input' | 'output' | 'parameter';
  color: string;
}

interface WorkSpaceNode {
  id: string; x: number; y: number;
  parameters: Port[]; inputs: Port[]; outputs: Port[];
  title: string;
  metadata?: string;
}

interface UpdateWorkSpaceEvent { updateWorkSpaceNode: WorkSpaceNode; success: boolean; }
interface DeletePortCompleteEvent { updateWorkSpaceNode: WorkSpaceNode; onCompleted: (success: boolean) => void; }
interface AddPortCompleteEvent { updateWorkSpaceNode: WorkSpaceNode; onCompleted: (success: boolean) => void; }
type SavingStatus = 'idle' | 'saving' | 'saved';
```

### Configuration

```ts
interface DisplayModuleConfig { assetPath?: string; }
const DISPLAY_MODULE_CONFIG: InjectionToken<DisplayModuleConfig>;
function provideDisplayModule(config: DisplayModuleConfig): EnvironmentProviders;
```

### Behaviour notes

- **Port names are unique** across the whole node, ignoring case and surrounding spaces. A duplicate add or rename is dropped: the input closes and the old state stays. Renaming a port to a case variant of its own name is allowed.
- **New ports** get `id = 'port_' + crypto.randomUUID()`, `type` from their section, `nodeType: 'module'` and `color: ''`.
- **Enter and Escape** both leave the input through blur, so both save a valid change.
- **Leaving edit mode** while an input is open closes it without saving.
- **`port.color`** fills the port handle when it is a valid CSS colour. Otherwise the theme colour is used.
- The component does not position itself from `x` and `y`.

### CSS hooks

| Hook | Meaning |
|---|---|
| `nano-module.dark` / `nano-module.light` | Theme. Without either class the dark values apply. |
| `.port` | Port drag handle; its `id` is `port.id`. |
| `.edit-input-wrapper` | Wraps every inline `<input>`. |

### Testing harness

`display-module/testing` exports `NanoModuleComponentHarness` and `NANO_MODULE_PARTS`.

```ts
const loader = TestbedHarnessEnvironment.loader(fixture);
const module = await loader.getHarness(NanoModuleComponentHarness);
await module.clickTitle();
await module.typeInto((await module.getTitleInput())!, 'Renamed');
```

## Theming

Set `class="dark"` or `class="light"` on `<nano-module>`. The class can change at runtime; tooltips follow it.

Each colour reads a custom property. Override them on `nano-module`, `nano-module.dark` or `nano-module.light`:

| Property | Used for | Dark | Light |
|---|---|---|---|
| `--nano-module-bg` | Module surface | `#0c111d` | `#ffffff` |
| `--nano-module-band-bg` | Header and input/output band | `#333741` | `#eaecf0` |
| `--nano-module-border` | Default border | `#333741` | `#d0d5dd` |
| `--nano-module-selected-border` | Border when selected | `#ffffff` | `#101828` |
| `--nano-module-edit-border` | Border and badge outline in edit mode | `#38bdf8` | `#065986` |
| `--nano-module-text` | Title and port names | `#f5f5f6` | `#101828` |
| `--nano-module-text-muted` | "Add" labels, "Saving changes…" | `#cecfd2` | `#344054` |
| `--nano-module-success` | "Changes saved" | `#47cd89` | `#085d3a` |
| `--nano-module-grip` | Side bars of the parameter band | `#ffffff` | `#101828` |
| `--nano-module-chip-bg` / `-chip-border` / `-chip-text` | Parameter chip | `#1f235b` / `#2d31a6` / `#a4bcfd` | `#f9f5ff` / `#d6bbfb` / `#6840c6` |
| `--nano-module-chip-port-fill` | Parameter handle fill | `#d0dcff` | `#d6bbfb` |
| `--nano-module-port-fill` / `-port-stroke` | Input and output handle | `#61646c` / `#cecfd2` | `#d0d5dd` / `#475467` |
| `--nano-module-port-hover-parameter` | Parameter handle on hover (orange) | `#f78f08` | `#db6803` |
| `--nano-module-port-hover-io` | Input and output handle on hover (green) | `#17b169` | `#069454` |
| `--nano-module-tooltip-bg` / `-tooltip-text` | Tooltips | `#f0f1f1` / `#161b26` | `#0c111d` / `#ffffff` |
| `--nano-module-badge-bg` / `-badge-text` | "Editing" badge | `#000000` / `#ffffff` | `#ffffff` / `#101828` |

```css
nano-module.dark {
  --nano-module-edit-border: #9e77ed;
}
```

These properties are not listed in the approved API contract yet; see `IMPLEMENTATION_NOTES.md` (open item O-1).

## Accessibility

- Delete controls are `<button>` elements named "Delete <port name>". Add controls are `<button>` elements named "Add Parameter", "Add Input" and "Add Output".
- Each inline `<input>` has an accessible name and receives focus when it opens.
- The save status is announced through a `role="status"` live region.
- Tooltips use `role="tooltip"` and are linked to the hovered text with `aria-describedby`.
- Colours meet a 4.5:1 text contrast in both themes.

Interaction:

| Action | Result |
|---|---|
| Click the module (view mode) | `nodeClicked` |
| Double click the module | `nodeDoubleClicked` |
| Click title or port text (edit mode) | Opens the inline input |
| Enter or Escape in an input | Leaves the input and saves a valid change |
| Click or Tab away from an input | Same as above |
| Tab, then Enter or Space on Add or Delete | Activates the button |

Known gap: title and port text open for editing with the pointer only. Keyboard activation of the text is not specified by the requirement or the contract.

## Zoneless and SSR

- The component uses signals and `OnPush`, and has no zone.js dependency. It works with `provideZonelessChangeDetection()`.
- It does not touch `window`, `document` or `localStorage` while rendering. DOM access happens only in event handlers, and focus is moved only in the browser. No SSR project exists in this workspace, so server rendering has not been built or run.
