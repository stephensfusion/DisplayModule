import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import { NANO_MODULE_PARTS } from '../../testing/public-api';
import {
  SECTIONS,
  SectionKey,
  advance,
  allPortIds,
  allPortNames,
  createNode,
  createPort,
  q,
  realHover,
  renderModule,
  useDebounceFakeTimers,
  useRealTimersAfter,
  visibleTooltip,
} from '../testing-helpers';
import { adversarialAdd, caseInsensitiveDuplicates, renamePort } from './adversarial-helpers';

/*
 * HIDDEN ADVERSARIAL SUITE: not part of the implementation handover.
 * Run with: ng test display-module --configuration adversarial --watch=false
 * Scenario catalogue: ADVERSARIAL_SCENARIOS.md (confidential).
 */

afterEach(() => useRealTimersAfter());

// ----------------------------------------------------------- SC-1..SC-3
describe('[ADV] real-time model updates', () => {
  it('[ADV][SC-1] should update the bound node immediately on add, before the parent calls onCompleted', async () => {
    const r = await renderModule({ editMode: true });
    await adversarialAdd(r, 'parameters', 'Live Param');
    expect(r.host.node().parameters.map((p) => p.name)).toContain('Live Param');
    expect(r.host.added).toHaveLength(1);
  });

  it('[ADV][SC-2] should update the bound node immediately on delete, before the parent calls onCompleted', async () => {
    const r = await renderModule({ editMode: true });
    await r.harness.deletePort('outputs', 'User Input Request');
    expect(r.host.node().outputs.map((p) => p.id)).not.toContain('out-3');
  });

  it('[ADV][SC-3] should carry the edited port value in the debounced onModuleUpdate payload', async () => {
    useDebounceFakeTimers();
    const r = await renderModule({ editMode: true });
    await r.harness.clickPortName('inputs', 'Answered User Input');
    await r.harness.typeInto((await r.harness.getPortInput())!, 'User Answer');
    await advance(1000);
    const last = r.host.updates.at(-1)!;
    expect(last.updateWorkSpaceNode.inputs.find((p) => p.id === 'in-2')!.name).toBe('User Answer');
  });
});

// ----------------------------------------------------------- SC-4 / SC-5
describe('[ADV] runtime theme switching', () => {
  it('[ADV][SC-4] should restyle the module when the class flips dark → light after first render', async () => {
    const r = await renderModule({ theme: 'dark' });
    const darkBg = getComputedStyle(r.moduleEl).backgroundColor;
    const darkTitle = getComputedStyle(q(r.moduleEl, NANO_MODULE_PARTS.title)).color;
    r.host.theme.set('light');
    await r.settle();
    expect(getComputedStyle(r.moduleEl).backgroundColor).not.toBe(darkBg);
    expect(getComputedStyle(q(r.moduleEl, NANO_MODULE_PARTS.title)).color).not.toBe(darkTitle);
  });

  it('[ADV][SC-5] should restyle the tooltip to match the active theme', async () => {
    const dark = await renderModule({ theme: 'dark' });
    await realHover(dark.moduleEl);
    await dark.settle();
    const darkTip = visibleTooltip();
    expect(darkTip).not.toBeNull();
    const darkBg = getComputedStyle(darkTip!).backgroundColor;
    dark.fixture.destroy();
    TestBed.resetTestingModule();

    const light = await renderModule({ theme: 'light' });
    await realHover(light.moduleEl);
    await light.settle();
    const lightTip = visibleTooltip();
    expect(lightTip).not.toBeNull();
    expect(getComputedStyle(lightTip!).backgroundColor).not.toBe(darkBg);
  });
});

// ------------------------------------------------------- SC-6..SC-10 uniqueness
describe('[ADV] case-insensitive unique port names', () => {
  it.each([
    { section: 'parameters' as SectionKey, dup: 'Parameter 1' },
    { section: 'parameters' as SectionKey, dup: 'PARAMETER 1' },
    { section: 'inputs' as SectionKey, dup: 'dataset object' },
    { section: 'outputs' as SectionKey, dup: 'iS fInIsHeD' },
  ])('[ADV][SC-6][SC-7] should reject adding "$dup" to $section', async ({ section, dup }) => {
    const r = await renderModule({ editMode: true });
    const before = r.host.node();
    await adversarialAdd(r, section, dup);
    expect(r.host.node()[section]).toHaveLength(before[section].length);
    expect(r.host.added).toHaveLength(0);
    expect(caseInsensitiveDuplicates(r.host.node())).toEqual([]);
  });

  it('[ADV][SC-8] should reject renaming a port to an existing name with different case', async () => {
    const r = await renderModule({ editMode: true });
    await renamePort(r, 'parameters', 'Parameter 2', 'parameter 1');
    expect(r.host.node().parameters.find((p) => p.id === 'param-2')!.name).toBe('Parameter 2');
    expect(caseInsensitiveDuplicates(r.host.node())).toEqual([]);
  });

  it('[ADV][SC-9] should reject a name that duplicates a port in another section (node-wide rule, A-07)', async () => {
    const r = await renderModule({ editMode: true });
    await adversarialAdd(r, 'outputs', 'DATASET OBJECT');
    expect(r.host.node().outputs.map((p) => p.name.toLowerCase())).not.toContain('dataset object');
    expect(caseInsensitiveDuplicates(r.host.node())).toEqual([]);
  });

  it('[ADV][SC-10] should reject a whitespace-padded duplicate', async () => {
    const r = await renderModule({ editMode: true });
    await adversarialAdd(r, 'inputs', '   answered user input   ');
    expect(r.host.added).toHaveLength(0);
    expect(caseInsensitiveDuplicates(r.host.node())).toEqual([]);
  });

  it('[ADV][SC-8] should still allow re-saving a port with only a case change of its own name', async () => {
    const r = await renderModule({ editMode: true });
    await renamePort(r, 'inputs', 'Dataset Object', 'DATASET OBJECT');
    expect(r.host.node().inputs.find((p) => p.id === 'in-1')!.name).toBe('DATASET OBJECT');
  });

  it('[ADV][SC-15] should never contain case-insensitive duplicates after any random sequence of adds', async () => {
    const nameArb = fc.constantFrom('alpha', 'Alpha', 'ALPHA', 'beta', 'Beta', 'parameter 1', 'Dataset Object', 'gamma');
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.constantFrom<SectionKey>('parameters', 'inputs', 'outputs'), nameArb), {
          minLength: 1,
          maxLength: 5,
        }),
        async (ops) => {
          TestBed.resetTestingModule();
          const r = await renderModule({ editMode: true });
          for (const [section, name] of ops) await adversarialAdd(r, section, name);
          expect(caseInsensitiveDuplicates(r.host.node())).toEqual([]);
          r.fixture.destroy();
        },
      ),
      { numRuns: 12, seed: 4242 },
    );
  });
});

// ------------------------------------------------------- SC-11 two-way stress
describe('[ADV] two-way binding robustness', () => {
  it('[ADV][SC-11] should reflect a parent replacement made while an edit field is open', async () => {
    const r = await renderModule({ editMode: true });
    await r.harness.clickPortName('outputs', 'Is Finished');
    r.host.node.set(createNode({ title: 'Replaced Upstream' }));
    await r.settle();
    const input = (await r.harness.getPortInput())!;
    await input.blur();
    expect(await r.harness.getTitleText()).toBe('Replaced Upstream');
  });

  it('[ADV][SC-12] should keep the previous node object untouched after add and delete', async () => {
    const r = await renderModule({ editMode: true });
    const original = r.host.node();
    const frozen = JSON.stringify(original);
    await adversarialAdd(r, 'inputs', 'Frozen Check');
    await r.harness.deletePort('parameters', 'Parameter 1');
    expect(JSON.stringify(original)).toBe(frozen);
  });
});

// ------------------------------------------------------- SC-13 debounce
describe('[ADV] debounce integrity', () => {
  it('[ADV][SC-13] should emit exactly once for a burst of keystrokes separated by < 1000 ms', async () => {
    useDebounceFakeTimers();
    const r = await renderModule({ editMode: true });
    await r.harness.clickTitle();
    const input = (await r.harness.getTitleInput())!;
    await input.clear();
    for (const ch of 'Burst') {
      await input.sendKeys(ch);
      await advance(300);
    }
    expect(r.host.updates).toHaveLength(0);
    await advance(700);
    expect(r.host.updates).toHaveLength(1);
    expect(r.host.updates[0].updateWorkSpaceNode.title).toBe('Burst');
  });

  it('[ADV][SC-14] should not emit a stale debounced update after the module is destroyed', async () => {
    useDebounceFakeTimers();
    const r = await renderModule({ editMode: true });
    await r.harness.clickTitle();
    await r.harness.typeInto((await r.harness.getTitleInput())!, 'Destroyed');
    const count = r.host.updates.length;
    r.fixture.destroy();
    await advance(2000);
    expect(r.host.updates).toHaveLength(count);
  });
});

// ------------------------------------------------------- SC-16 injection
describe('[ADV] untrusted text', () => {
  it('[ADV][SC-16] should render HTML-like names as text, never as markup', async () => {
    const payload = '<img src=x onerror="window.__dmPwned=1">';
    const node = createNode({
      title: payload,
      inputs: [createPort('input', 'in-x', '<b>bold</b>')],
    });
    const r = await renderModule({ node });
    expect(await r.harness.getTitleText()).toBe(payload);
    expect(r.moduleEl.querySelector('img, b')).toBeNull();
    expect((window as unknown as { __dmPwned?: number }).__dmPwned).toBeUndefined();
  });
});

// ------------------------------------------------------- SC-17 ids
describe('[ADV] id generation', () => {
  it('[ADV][SC-17] should never reuse an existing id even when existing ids look generated', async () => {
    const node = createNode({
      parameters: [createPort('parameter', 'port_1', 'P One'), createPort('parameter', 'port_2', 'P Two')],
    });
    const r = await renderModule({ node, editMode: true });
    for (let i = 0; i < 5; i++) await adversarialAdd(r, 'parameters', `Generated ${i}`);
    const ids = allPortIds(r.host.node());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SECTIONS)('[ADV][SC-18] should keep DOM ids in sync after adding then deleting in $section', async ({ section }) => {
    const r = await renderModule({ editMode: true });
    await adversarialAdd(r, section, 'Transient');
    await r.harness.deletePort(section, 'Transient');
    expect(await r.harness.getPortHandleIds(section)).toEqual(r.host.node()[section].map((p) => p.id));
  });
});

// ------------------------------------------------------- SC-19 parent rejects
describe('[ADV] parent callbacks', () => {
  it('[ADV][SC-19] should not throw when the parent reports onCompleted(false) for add and delete', async () => {
    const r = await renderModule({ editMode: true });
    r.host.addResult = false;
    r.host.deleteResult = false;
    await adversarialAdd(r, 'outputs', 'Rejected Output');
    await r.harness.deletePort('inputs', 'Dataset Object');
    expect(r.host.added).toHaveLength(1);
    expect(r.host.deleted).toHaveLength(1);
    expect(await r.harness.getAddButton('outputs')).not.toBeNull();
  });

  it('[ADV][SC-20] should not leave the module in edit state after the parent leaves edit mode mid-edit', async () => {
    const r = await renderModule({ editMode: true });
    await r.harness.clickTitle();
    r.host.setEditMode(false);
    await r.settle();
    expect(await r.harness.getAnyEditInput()).toBeNull();
    expect(await r.harness.getDeleteButtons()).toHaveLength(0);
    expect(allPortNames(r.host.node())).toEqual(allPortNames(createNode()));
  });
});
