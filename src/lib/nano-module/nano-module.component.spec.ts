import { afterEach, describe, expect, it } from 'vitest';
import { By } from '@angular/platform-browser';


import { NANO_MODULE_PARTS } from '../../../testing/public-api';
import { NanoModuleComponent } from './nano-module.component';
import {
  SECTIONS,
  advance,
  allPortIds,
  allPortNames,
  cloneNode,
  createNode,
  fireMouse,
  frameSignature,
  hasDashedUnderline,
  isGreen,
  isOrange,
  luminance,
  effectiveBackground,
  normalise,
  paintColorsDeep,
  portHandleById,
  portNameEl,
  q,
  realClick,
  realHover,
  renderModule,
  useDebounceFakeTimers,
  useRealTimersAfter,
  visibleTooltipTexts,
  zIndexOf,
} from '../../testing-helpers';

const VIEW_TOOLTIP_LINE_1 = 'Single click to open action menu';
const VIEW_TOOLTIP_LINE_2 = 'Double click to open logic layer';
const EDIT_TOOLTIP = 'Click to edit text';
const SAVING = /saving changes/i;
const SAVED = /changes saved/i;

afterEach(() => useRealTimersAfter());

// =========================================================================
// FR-1 Initial state / rendering
// =========================================================================
describe('NanoModuleComponent: initial state (FR-1, TR-1)', () => {
  it('[FR-1] should display the title when a node is bound', async () => {
    const { harness } = await renderModule();
    expect(await harness.getTitleText()).toBe('AI Dataset Analyser');
  });

  it.each(SECTIONS)(
    '[FR-1] should display every $section name in order when a node is bound',
    async ({ section }) => {
      const node = createNode();
      const { harness } = await renderModule({ node });
      expect(await harness.getPortNames(section)).toEqual(node[section].map((p) => p.name));
    },
  );

  it('[FR-1] should render empty sections without errors when the node has no ports', async () => {
    const { harness } = await renderModule({
      node: createNode({ parameters: [], inputs: [], outputs: [] }),
    });
    expect(await harness.getTitleText()).toBe('AI Dataset Analyser');
    for (const { section } of SECTIONS) expect(await harness.getPortNames(section)).toEqual([]);
  });

  it('[FR-1][FR-4e] should be in view mode (no badge, inputs, delete or add buttons) when isEditMode is not set', async () => {
    const { harness } = await renderModule();
    expect(await harness.hasEditingBadge()).toBe(false);
    expect(await harness.getAnyEditInput()).toBeNull();
    expect(await harness.getDeleteButtons()).toHaveLength(0);
    for (const { section } of SECTIONS) expect(await harness.getAddButton(section)).toBeNull();
  });

  it('[FR-1] should not show a saving status when nothing has been edited', async () => {
    const { harness } = await renderModule();
    expect(await harness.getStatusText()).toBeNull();
  });
});

// =========================================================================
// FR-2 Two-way data model
// =========================================================================
describe('NanoModuleComponent: two-way binding (FR-2, TR-22)', () => {
  it('[FR-2] should re-render the title when the parent replaces the node', async () => {
    const { host, harness, settle } = await renderModule();
    host.node.set({ ...host.node(), title: 'Combine question and data object' });
    await settle();
    expect(await harness.getTitleText()).toBe('Combine question and data object');
  });

  it('[FR-2] should re-render ports when the parent changes a port array', async () => {
    const { host, harness, settle } = await renderModule();
    const node = host.node();
    host.node.set({ ...node, inputs: [...node.inputs, { ...node.inputs[0], id: 'in-x', name: 'Extra Input' }] });
    await settle();
    expect(await harness.getPortNames('inputs')).toContain('Extra Input');
  });

  it('[FR-2] should update the parent node signal when the title is edited inside the module', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Renamed Module');
    await input.blur();
    expect(host.node().title).toBe('Renamed Module');
  });
});

// =========================================================================
// FR-3 / FR-5 Select mode and z-index
// =========================================================================
describe('NanoModuleComponent: select mode and stacking (FR-3, FR-5, TR-2)', () => {
  it('[FR-5] should use base z-index 4 when neither selected nor editing', async () => {
    const { moduleEl } = await renderModule();
    expect(zIndexOf(moduleEl)).toBe(4);
  });

  it('[FR-3a] should change the border/frame colour when isSelectMode becomes true', async () => {
    const { host, moduleEl, settle } = await renderModule();
    const before = frameSignature(moduleEl);
    host.setSelectMode(true);
    await settle();
    expect(frameSignature(moduleEl)).not.toBe(before);
  });

  it('[FR-3a] should restore the unselected frame when isSelectMode becomes false', async () => {
    const { host, moduleEl, settle } = await renderModule();
    const unselected = frameSignature(moduleEl);
    host.setSelectMode(true);
    await settle();
    host.setSelectMode(false);
    await settle();
    expect(frameSignature(moduleEl)).toBe(unselected);
  });

  it('[FR-3b][FR-5] should raise z-index above 4 when selected', async () => {
    const { moduleEl } = await renderModule({ selectMode: true });
    expect(zIndexOf(moduleEl)).toBeGreaterThan(4);
  });

  it.each(['dark', 'light'] as const)(
    '[FR-3a] should show a visible selection frame in the %s theme',
    async (theme) => {
      const plain = await renderModule({ theme });
      const plainSig = frameSignature(plain.moduleEl);
      plain.fixture.destroy();
      const selected = await renderModule({ theme, selectMode: true });
      expect(frameSignature(selected.moduleEl)).not.toBe(plainSig);
    },
  );
});

// =========================================================================
// FR-4 Edit mode
// =========================================================================
describe('NanoModuleComponent: edit mode (FR-4, TR-3)', () => {
  it('[FR-4a] should show an "Editing" badge when isEditMode is true', async () => {
    const { harness } = await renderModule({ editMode: true });
    expect(await harness.getEditingBadgeText()).toBe('Editing');
  });

  it('[FR-4a] should remove the badge when isEditMode turns false', async () => {
    const { host, harness, settle } = await renderModule({ editMode: true });
    host.setEditMode(false);
    await settle();
    expect(await harness.hasEditingBadge()).toBe(false);
  });

  it('[FR-4b] should change the border/frame when isEditMode becomes true', async () => {
    const { host, moduleEl, settle } = await renderModule();
    const before = frameSignature(moduleEl);
    host.setEditMode(true);
    await settle();
    expect(frameSignature(moduleEl)).not.toBe(before);
  });

  it('[FR-4][FR-5] should raise z-index above 4 when editing', async () => {
    const { moduleEl } = await renderModule({ editMode: true });
    expect(zIndexOf(moduleEl)).toBeGreaterThan(4);
  });

  it.each(SECTIONS)(
    '[FR-4c] should render one delete button per $section port when editing',
    async ({ section }) => {
      const node = createNode();
      const { harness } = await renderModule({ node, editMode: true });
      expect(await harness.getDeleteButtons(section)).toHaveLength(node[section].length);
    },
  );

  it('[FR-4c] should not render a delete button for the title when editing', async () => {
    const node = createNode();
    const { harness, moduleEl } = await renderModule({ node, editMode: true });
    expect(await harness.getDeleteButtons()).toHaveLength(allPortIds(node).length);
    const title = q(moduleEl, NANO_MODULE_PARTS.title);
    const titleContainer = title.parentElement!;
    expect(titleContainer.querySelector(NANO_MODULE_PARTS.deleteButton)).toBeNull();
  });

  it.each(SECTIONS)('[FR-4d] should show an add button for $section when editing', async ({ section }) => {
    const { harness } = await renderModule({ editMode: true });
    expect(await harness.getAddButton(section)).not.toBeNull();
  });
});

// =========================================================================
// FR-6 View-mode hover
// =========================================================================
describe('NanoModuleComponent: view-mode hover (FR-6, TR-5)', () => {
  it('[FR-6a] should show the action/logic-layer tooltip when hovering in view mode', async () => {
    const { moduleEl, settle } = await renderModule();
    await realHover(moduleEl);
    await settle();
    const texts = visibleTooltipTexts().join(' ');
    expect(texts).toContain(VIEW_TOOLTIP_LINE_1);
    expect(texts).toContain(VIEW_TOOLTIP_LINE_2);
  });

  it('[FR-6a] should not show the tooltip before hovering', async () => {
    await renderModule();
    expect(visibleTooltipTexts().join(' ')).not.toContain(VIEW_TOOLTIP_LINE_1);
  });

  it('[FR-6b] should use a pointer cursor in view mode', async () => {
    const { moduleEl } = await renderModule();
    expect(getComputedStyle(moduleEl).cursor).toBe('pointer');
  });

  it.each([
    { mode: 'selected', selectMode: true, editMode: false },
    { mode: 'editing', selectMode: false, editMode: true },
  ])('[FR-6c] should not show the view tooltip when $mode', async ({ selectMode, editMode }) => {
    const { moduleEl, settle } = await renderModule({ selectMode, editMode });
    await realHover(moduleEl);
    await settle();
    expect(visibleTooltipTexts().join(' ')).not.toContain(VIEW_TOOLTIP_LINE_1);
  });
});

// =========================================================================
// FR-7 Edit-mode text hover tooltip
// =========================================================================
describe('NanoModuleComponent: edit-mode text tooltip (FR-7, TR-6)', () => {
  it('[FR-7] should show "Click to edit text" when hovering the title in edit mode', async () => {
    const { moduleEl, settle } = await renderModule({ editMode: true });
    await realHover(q(moduleEl, NANO_MODULE_PARTS.title));
    await settle();
    expect(visibleTooltipTexts()).toContain(EDIT_TOOLTIP);
  });

  it.each(SECTIONS)(
    '[FR-7] should show "Click to edit text" when hovering a $section name in edit mode',
    async ({ section, sample }) => {
      const { moduleEl, settle } = await renderModule({ editMode: true });
      await realHover(portNameEl(moduleEl, section, sample));
      await settle();
      expect(visibleTooltipTexts()).toContain(EDIT_TOOLTIP);
    },
  );

  it('[FR-7] should not show "Click to edit text" when hovering the title in view mode', async () => {
    const { moduleEl, settle } = await renderModule();
    await realHover(q(moduleEl, NANO_MODULE_PARTS.title));
    await settle();
    expect(visibleTooltipTexts()).not.toContain(EDIT_TOOLTIP);
  });
});

// =========================================================================
// FR-8 / FR-9 Inline edit fields
// =========================================================================
describe('NanoModuleComponent: inline edit fields (FR-8, FR-9, TR-7, TR-8)', () => {
  it('[FR-8a] should swap the title for an input prefilled with the title when clicked in edit mode', async () => {
    const { harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = await harness.getTitleInput();
    expect(input).not.toBeNull();
    expect(await input!.getProperty<string>('value')).toBe('AI Dataset Analyser');
  });

  it.each(SECTIONS)(
    '[FR-8a] should swap a $section name for an input prefilled with the name when clicked in edit mode',
    async ({ section, sample }) => {
      const { harness } = await renderModule({ editMode: true });
      await harness.clickPortName(section, sample);
      const input = await harness.getPortInput();
      expect(input).not.toBeNull();
      expect(await input!.getProperty<string>('value')).toBe(sample);
    },
  );

  it('[FR-8a] should not open an input when the title is clicked in view mode', async () => {
    const { harness } = await renderModule();
    await harness.clickTitle();
    expect(await harness.getAnyEditInput()).toBeNull();
  });

  it('[FR-8b] should stop the text click from reaching the canvas when opening an edit field', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    expect(host.canvasClick).toHaveLength(0);
  });

  it('[FR-8b] should not emit nodeClicked when clicking text to edit it', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickPortName('inputs', 'Dataset Object');
    expect(host.clicked).toHaveLength(0);
  });

  it('[FR-9] should show a dashed underline on the title input', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    expect(hasDashedUnderline(q(moduleEl, NANO_MODULE_PARTS.titleInput))).toBe(true);
  });

  it.each(SECTIONS)('[FR-9] should not show a dashed underline on a $section input', async ({ section, sample }) => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickPortName(section, sample);
    expect(hasDashedUnderline(q(moduleEl, NANO_MODULE_PARTS.portInput))).toBe(false);
  });
});

// =========================================================================
// FR-10 Commit / cancel on blur
// =========================================================================
describe('NanoModuleComponent: committing edits on blur (FR-10, TR-9, TR-10)', () => {
  it.each([
    { raw: '  Combine question and data object  ', expected: 'Combine question and data object' },
    { raw: 'Renamed', expected: 'Renamed' },
    { raw: '\tTabbed Title\t', expected: 'Tabbed Title' },
  ])('[FR-10] should trim and save the title "$raw" when blurred', async ({ raw, expected }) => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, raw);
    await input.blur();
    expect(host.node().title).toBe(expected);
    expect(await harness.getTitleInput()).toBeNull();
    expect(await harness.getTitleText()).toBe(expected);
  });

  it('[FR-10] should notify the parent through onModuleUpdate with the new title when blurred', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'New Title');
    await input.blur();
    expect(host.updates.length).toBeGreaterThanOrEqual(1);
    expect(host.updates.at(-1)!.updateWorkSpaceNode.title).toBe('New Title');
    expect(host.updates.at(-1)!.updateWorkSpaceNode.id).toBe('node-1');
  });

  it.each(SECTIONS)(
    '[FR-10] should trim, save and emit a renamed $section port when blurred',
    async ({ section, sample }) => {
      const { host, harness } = await renderModule({ editMode: true });
      const original = host.node()[section].find((p) => p.name === sample)!;
      await harness.clickPortName(section, sample);
      const input = (await harness.getPortInput())!;
      await harness.typeInto(input, '  Renamed Port  ');
      await input.blur();
      const updated = host.node()[section].find((p) => p.id === original.id)!;
      expect(updated.name).toBe('Renamed Port');
      expect(updated.type).toBe(original.type);
      expect(await harness.getPortInput()).toBeNull();
      expect(await harness.getPortNames(section)).toContain('Renamed Port');
      const last = host.updates.at(-1)!;
      expect(last.updateWorkSpaceNode[section].find((p) => p.id === original.id)!.name).toBe('Renamed Port');
    },
  );

  it('[FR-10] should replace the node immutably (the previous node object is not mutated)', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    const before = host.node();
    const snapshot = cloneNode(before);
    await harness.clickPortName('outputs', 'Is Finished');
    const input = (await harness.getPortInput())!;
    await harness.typeInto(input, 'Done Flag');
    await input.blur();
    expect(before).toEqual(snapshot);
    expect(host.node()).not.toBe(before);
  });

  it.each([
    { label: 'empty', value: '' },
    { label: 'whitespace-only', value: '    ' },
  ])('[FR-10] should keep the old title and not emit when the input is $label on blur', async ({ value }) => {
    useDebounceFakeTimers();
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, value);
    await input.blur();
    await advance(2000);
    expect(host.node().title).toBe('AI Dataset Analyser');
    expect(await harness.getTitleInput()).toBeNull();
    expect(await harness.getTitleText()).toBe('AI Dataset Analyser');
    expect(host.updates).toHaveLength(0);
  });

  it('[FR-10] should close without emitting when the port text is unchanged on blur', async () => {
    useDebounceFakeTimers();
    const { host, harness } = await renderModule({ editMode: true });
    const before = host.node();
    await harness.clickPortName('parameters', 'Parameter 1');
    const input = (await harness.getPortInput())!;
    await input.focus();
    await input.blur();
    await advance(2000);
    expect(await harness.getPortInput()).toBeNull();
    expect(host.node()).toEqual(before);
    expect(host.updates).toHaveLength(0);
  });

  it('[FR-10] should keep the old port name when the port input is emptied and blurred', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickPortName('inputs', 'Dataset Object');
    const input = (await harness.getPortInput())!;
    await harness.typeInto(input, '   ');
    await input.blur();
    expect(host.node().inputs.map((p) => p.name)).toContain('Dataset Object');
    expect(await harness.getPortNames('inputs')).toContain('Dataset Object');
  });
});

// =========================================================================
// FR-11 Enter / Escape
// =========================================================================
describe('NanoModuleComponent: keyboard exit (FR-11, TR-11)', () => {
  it('[FR-11a] should close the input and show "Changes saved" when Enter is pressed', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Entered Title');
    await harness.pressEnter(input);
    expect(await harness.getTitleInput()).toBeNull();
    expect(host.node().title).toBe('Entered Title');
    expect(await harness.getStatusText()).toMatch(SAVED);
  });

  it('[FR-11b] should close the input and show "Changes saved" when Escape is pressed', async () => {
    const { harness } = await renderModule({ editMode: true });
    await harness.clickPortName('outputs', 'Result Object');
    const input = (await harness.getPortInput())!;
    await harness.typeInto(input, 'Result Payload');
    await harness.pressEscape(input);
    expect(await harness.getPortInput()).toBeNull();
    expect(await harness.getStatusText()).toMatch(SAVED);
  });

  it('[FR-11a] should save a port rename when Enter is pressed', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickPortName('parameters', 'Parameter 2');
    const input = (await harness.getPortInput())!;
    await harness.typeInto(input, 'Temperature');
    await harness.pressEnter(input);
    expect(host.node().parameters.find((p) => p.id === 'param-2')!.name).toBe('Temperature');
  });
});

// =========================================================================
// FR-12 / FR-13 / FR-14 / FR-15 Saving status
// =========================================================================
describe('NanoModuleComponent: saving status (FR-12..FR-15, TR-12..TR-14)', () => {
  it('[FR-12] should show "Saving changes" while the user is typing', async () => {
    useDebounceFakeTimers();
    const { harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Debounced Title');
    expect(await harness.getStatusText()).toMatch(SAVING);
  });

  it('[FR-12][FR-13] should switch to "Changes saved" and emit once typing stops for 1000 ms', async () => {
    useDebounceFakeTimers();
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Debounced Title');
    await advance(999);
    expect(host.updates).toHaveLength(0);
    expect(await harness.getStatusText()).toMatch(SAVING);
    await advance(1);
    expect(host.updates.length).toBeGreaterThanOrEqual(1);
    expect(host.updates.at(-1)!.updateWorkSpaceNode.title).toBe('Debounced Title');
    expect(await harness.getStatusText()).toMatch(SAVED);
  });

  it('[FR-12] should expose savingStatus transitions idle → saving → saved', async () => {
    useDebounceFakeTimers();
    const { harness, fixture } = await renderModule({ editMode: true });
    const cmp = fixture.debugElement.query(By.directive(NanoModuleComponent))
      .componentInstance as NanoModuleComponent;
    expect(cmp.savingStatus()).toBe('idle');
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Status Title');
    expect(cmp.savingStatus()).toBe('saving');
    await advance(1000);
    expect(cmp.savingStatus()).toBe('saved');
  });

  it('[FR-14] should show "Changes saved" when the parent reports success', async () => {
    useDebounceFakeTimers();
    const { host, harness } = await renderModule({ editMode: true });
    host.saveResult = true;
    await harness.clickTitle();
    await harness.typeInto((await harness.getTitleInput())!, 'Status Title');
    await advance(1000);
    expect(await harness.getStatusText()).toMatch(SAVED);
  });

  it('[FR-14] should hide "Changes saved" when the parent reports a failed save', async () => {
    useDebounceFakeTimers();
    const { host, harness } = await renderModule({ editMode: true });
    host.saveResult = false;
    await harness.clickTitle();
    await harness.typeInto((await harness.getTitleInput())!, 'Status Title');
    await advance(1000);
    expect(host.updates.length).toBeGreaterThanOrEqual(1);
    expect(await harness.getStatusText() ?? '').not.toMatch(SAVED);
  });

  it('[FR-15] should render the status indicator in the top-right corner of the module', async () => {
    useDebounceFakeTimers();
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    await harness.typeInto((await harness.getTitleInput())!, 'Status Title');
    const status = q(moduleEl, NANO_MODULE_PARTS.status).getBoundingClientRect();
    const box = moduleEl.getBoundingClientRect();
    expect(status.left).toBeGreaterThanOrEqual(box.left + box.width / 2);
    expect(status.top).toBeLessThan(box.top + box.height / 2);
  });
});

// =========================================================================
// FR-16 Adding ports
// =========================================================================
describe('NanoModuleComponent: adding ports (FR-16, FR-31, TR-15..TR-17)', () => {
  it.each(SECTIONS)(
    '[FR-16a] should hide the $section add button and show a text input in its place when clicked',
    async ({ section }) => {
      const { harness } = await renderModule({ editMode: true });
      await harness.clickAdd(section);
      expect(await harness.getAddButton(section)).toBeNull();
      expect(await harness.getNewPortInput(section)).not.toBeNull();
    },
  );

  it.each(SECTIONS)(
    '[FR-16b] should add a named $section port, emit addPort and restore the add button on blur',
    async ({ section, portType }) => {
      const { host, harness, moduleEl } = await renderModule({ editMode: true });
      const existingIds = allPortIds(host.node());
      const countBefore = host.node()[section].length;
      await harness.clickAdd(section);
      const input = (await harness.getNewPortInput(section))!;
      await harness.typeInto(input, '  Fresh Port  ');
      await input.blur();

      const ports = host.node()[section];
      expect(ports).toHaveLength(countBefore + 1);
      const created = ports.find((p) => p.name === 'Fresh Port')!;
      expect(created).toBeDefined();
      expect(created.type).toBe(portType);
      expect(created.id).toBeTruthy();
      expect(existingIds).not.toContain(created.id);
      expect(portHandleById(moduleEl, created.id)).toBeTruthy();

      expect(host.added).toHaveLength(1);
      expect(host.added[0].updateWorkSpaceNode[section].map((p) => p.id)).toContain(created.id);
      expect(typeof host.added[0].onCompleted).toBe('function');

      expect(await harness.getNewPortInput(section)).toBeNull();
      expect(await harness.getAddButton(section)).not.toBeNull();
    },
  );

  it.each(SECTIONS)(
    '[FR-16c] should cancel and restore the $section add button when blurred empty',
    async ({ section }) => {
      const { host, harness } = await renderModule({ editMode: true });
      const before = host.node()[section].length;
      await harness.clickAdd(section);
      const input = (await harness.getNewPortInput(section))!;
      await input.focus();
      await input.blur();
      expect(host.node()[section]).toHaveLength(before);
      expect(host.added).toHaveLength(0);
      expect(await harness.getNewPortInput(section)).toBeNull();
      expect(await harness.getAddButton(section)).not.toBeNull();
    },
  );

  it('[FR-16d] should show "Saving changes" while typing a new port name', async () => {
    useDebounceFakeTimers();
    const { harness } = await renderModule({ editMode: true });
    await harness.clickAdd('inputs');
    await harness.typeInto((await harness.getNewPortInput('inputs'))!, 'Que');
    expect(await harness.getStatusText()).toMatch(SAVING);
  });

  it('[FR-16e] should allow consecutive additions with distinct ids', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    for (const name of ['First Output', 'Second Output']) {
      await harness.clickAdd('outputs');
      const input = (await harness.getNewPortInput('outputs'))!;
      await harness.typeInto(input, name);
      await input.blur();
    }
    const outs = host.node().outputs;
    const a = outs.find((p) => p.name === 'First Output')!;
    const b = outs.find((p) => p.name === 'Second Output')!;
    expect(a.id).not.toBe(b.id);
    expect(host.added).toHaveLength(2);
  });

  it('[FR-16a] should stop the add click from reaching the canvas', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickAdd('parameters');
    expect(host.canvasClick).toHaveLength(0);
    expect(host.clicked).toHaveLength(0);
  });
});

// =========================================================================
// FR-17 Deleting ports
// =========================================================================
describe('NanoModuleComponent: deleting ports (FR-17, TR-18)', () => {
  it.each(SECTIONS)(
    '[FR-17] should remove the $section port, update the model and emit deletePort',
    async ({ section, sample }) => {
      const { host, harness } = await renderModule({ editMode: true });
      const target = host.node()[section].find((p) => p.name === sample)!;
      const before = host.node()[section].length;
      await harness.deletePort(section, sample);
      expect(host.node()[section]).toHaveLength(before - 1);
      expect(host.node()[section].map((p) => p.id)).not.toContain(target.id);
      expect(await harness.getPortNames(section)).not.toContain(sample);
      expect(host.deleted).toHaveLength(1);
      expect(host.deleted[0].updateWorkSpaceNode[section].map((p) => p.id)).not.toContain(target.id);
      expect(typeof host.deleted[0].onCompleted).toBe('function');
    },
  );

  it('[FR-17] should leave other sections untouched when a port is deleted', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    const before = host.node();
    await harness.deletePort('parameters', 'Parameter 1');
    expect(host.node().inputs).toEqual(before.inputs);
    expect(host.node().outputs).toEqual(before.outputs);
    expect(host.node().title).toBe(before.title);
  });

  it('[FR-17] should stop the delete click from propagating to the module or canvas', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.deletePort('inputs', 'Dataset Object');
    expect(host.clicked).toHaveLength(0);
    expect(host.canvasClick).toHaveLength(0);
  });
});

// =========================================================================
// FR-18 / FR-19 Port interface
// =========================================================================
describe('NanoModuleComponent: port handles (FR-18, FR-19, TR-19)', () => {
  it.each(SECTIONS)('[FR-19] should set each $section handle id to the port id', async ({ section }) => {
    const node = createNode();
    const { harness } = await renderModule({ node });
    expect(await harness.getPortHandleIds(section)).toEqual(node[section].map((p) => p.id));
  });

  it('[FR-18] should emit portMouseDown with event, node and target port on handle mousedown', async () => {
    const { host, moduleEl } = await renderModule();
    const event = fireMouse(portHandleById(moduleEl, 'out-1'), 'mousedown');
    expect(host.portDown).toHaveLength(1);
    expect(host.portDown[0].event).toBe(event);
    expect(host.portDown[0].workSpaceNode.id).toBe('node-1');
    expect(host.portDown[0].target.id).toBe('out-1');
  });

  it('[FR-18] should emit portMouseUp with event, node and port on handle mouseup', async () => {
    const { host, moduleEl } = await renderModule();
    const event = fireMouse(portHandleById(moduleEl, 'in-2'), 'mouseup');
    expect(host.portUp).toHaveLength(1);
    expect(host.portUp[0].event).toBe(event);
    expect(host.portUp[0].workSpaceNode.id).toBe('node-1');
    expect(host.portUp[0].port.id).toBe('in-2');
  });
});

// =========================================================================
// FR-20 Port hover colours
// =========================================================================
describe('NanoModuleComponent: port hover colours (FR-20, TR-19)', () => {
  it('[FR-20a] should paint a parameter port orange on hover', async () => {
    const { moduleEl, settle } = await renderModule();
    const handle = portHandleById(moduleEl, 'param-1');
    await realHover(handle);
    await settle();
    const colors = paintColorsDeep(handle);
    expect(colors.some(isOrange)).toBe(true);
    expect(colors.some(isGreen)).toBe(false);
  });

  it.each([
    { label: 'input', id: 'in-1' },
    { label: 'output', id: 'out-2' },
  ])('[FR-20b] should paint an $label port green on hover', async ({ id }) => {
    const { moduleEl, settle } = await renderModule();
    const handle = portHandleById(moduleEl, id);
    await realHover(handle);
    await settle();
    const colors = paintColorsDeep(handle);
    expect(colors.some(isGreen)).toBe(true);
    expect(colors.some(isOrange)).toBe(false);
  });
});

// =========================================================================
// FR-21 / FR-22 Click and double click
// =========================================================================
describe('NanoModuleComponent: clicking the module (FR-21, FR-22, TR-20, TR-21)', () => {
  it('[FR-21] should emit nodeClicked with the node id on single click', async () => {
    const { host, harness } = await renderModule();
    await harness.clickModule();
    expect(host.clicked).toEqual(['node-1']);
  });

  it('[FR-21] should change the border colour after a single click selects the module', async () => {
    const { harness, moduleEl, settle } = await renderModule();
    const before = frameSignature(moduleEl);
    await harness.clickModule();
    await settle();
    expect(frameSignature(moduleEl)).not.toBe(before);
  });

  it('[FR-22] should emit nodeDoubleClicked with the node id on double click', async () => {
    const { host, harness } = await renderModule();
    await harness.doubleClickModule();
    expect(host.doubleClicked).toEqual(['node-1']);
  });

  it('[FR-21][FR-22] should emit the bound node id for a different node', async () => {
    const { host, harness } = await renderModule({ node: createNode({ id: 'node-42' }) });
    await harness.clickModule();
    await harness.doubleClickModule();
    expect(host.clicked[0]).toBe('node-42');
    expect(host.doubleClicked).toEqual(['node-42']);
  });
});

// =========================================================================
// FR-23 Drag isolation
// =========================================================================
describe('NanoModuleComponent: drag isolation (FR-23, TR-7)', () => {
  it('[FR-23a] should block canvas mousedown when pressing a port handle', async () => {
    const { host, moduleEl } = await renderModule();
    fireMouse(portHandleById(moduleEl, 'param-2'), 'mousedown');
    expect(host.canvasMouseDown).toHaveLength(0);
  });

  it('[FR-23a] should block canvas mousedown on .port even when ignoreClasses is empty', async () => {
    const { host, moduleEl } = await renderModule({ ignoreClasses: [] });
    fireMouse(portHandleById(moduleEl, 'in-1'), 'mousedown');
    expect(host.canvasMouseDown).toHaveLength(0);
  });

  it('[FR-23b] should block canvas mousedown when pressing an inline input', async () => {
    const { host, harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    host.canvasMouseDown.length = 0;
    fireMouse(q(moduleEl, NANO_MODULE_PARTS.titleInput), 'mousedown');
    expect(host.canvasMouseDown).toHaveLength(0);
  });

  it('[FR-23d] should block canvas mousedown on an element carrying an ignoreClasses class', async () => {
    const { host, harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickPortName('outputs', 'Is Finished');
    host.canvasMouseDown.length = 0;
    fireMouse(q(moduleEl, NANO_MODULE_PARTS.editWrapper), 'mousedown');
    expect(host.canvasMouseDown).toHaveLength(0);
  });

  it('[FR-23c] should block canvas mousedown on editable text in edit mode', async () => {
    const { host, moduleEl } = await renderModule({ editMode: true });
    fireMouse(q(moduleEl, NANO_MODULE_PARTS.title), 'mousedown');
    expect(host.canvasMouseDown).toHaveLength(0);
  });

  it('[FR-23e] should let a mousedown on the module body reach the canvas (drag allowed)', async () => {
    const { host, moduleEl } = await renderModule();
    fireMouse(moduleEl, 'mousedown');
    expect(host.canvasMouseDown).toHaveLength(1);
  });

  it('[FR-23f] should commit an active edit when the user presses elsewhere on the canvas', async () => {
    const { host, harness, canvasEl, settle } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Committed By Canvas');
    await realClick(canvasEl);
    await settle();
    expect(await harness.getTitleInput()).toBeNull();
    expect(host.node().title).toBe('Committed By Canvas');
    expect(host.updates.at(-1)?.updateWorkSpaceNode.title).toBe('Committed By Canvas');
  });
});

// =========================================================================
// FR-24 Themes
// =========================================================================
describe('NanoModuleComponent: themes (FR-24, TR-4)', () => {
  it('[FR-24] should render a dark surface with the "dark" class', async () => {
    const { moduleEl } = await renderModule({ theme: 'dark' });
    expect(luminance(effectiveBackground(moduleEl))).toBeLessThan(0.2);
  });

  it('[FR-24] should render a light surface with the "light" class', async () => {
    const { moduleEl } = await renderModule({ theme: 'light' });
    expect(luminance(effectiveBackground(moduleEl))).toBeGreaterThan(0.6);
  });

  it('[FR-24] should render title text with contrasting colour in each theme', async () => {
    const dark = await renderModule({ theme: 'dark' });
    const darkTitle = getComputedStyle(q(dark.moduleEl, NANO_MODULE_PARTS.title)).color;
    dark.fixture.destroy();
    const light = await renderModule({ theme: 'light' });
    const lightTitle = getComputedStyle(q(light.moduleEl, NANO_MODULE_PARTS.title)).color;
    expect(darkTitle).not.toBe(lightTitle);
  });
});

// =========================================================================
// FR-27 Unique names / FR-28 isEditing
// =========================================================================
describe('NanoModuleComponent: name uniqueness and editing flag (FR-27, FR-28)', () => {
  it('[FR-27] should not add a port whose name duplicates an existing one ignoring case', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    const before = host.node().parameters.length;
    await harness.clickAdd('parameters');
    const input = (await harness.getNewPortInput('parameters'))!;
    await harness.typeInto(input, 'parameter 1');
    await input.blur();
    expect(host.node().parameters).toHaveLength(before);
    expect(host.added).toHaveLength(0);
  });

  it('[FR-28] should emit isEditing=false when an inline edit is finished', async () => {
    const { host, harness } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Finished Editing');
    await input.blur();
    expect(host.isEditingEvents.at(-1)).toBe(false);
  });
});

// Ensures the reference fixture itself honours the uniqueness invariant the tests rely on.
describe('test fixture sanity', () => {
  it('[FR-27] reference node has case-insensitively unique port names', () => {
    const names = allPortNames(createNode()).map((n) => normalise(n).toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
