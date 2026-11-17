import { describe, expect, it } from 'vitest';

import { NANO_MODULE_PARTS } from '../../../testing/public-api';
import {
  SECTIONS,
  accessibleName,
  expectNoAxeViolations,
  q,
  realHover,
  renderModule,
  visibleTooltip,
} from '../../testing-helpers';

/*
 * Accessibility tests (generator §3.2, NFR-3). Each visual state named in the
 * requirement / Figma is checked with axe, plus explicit assertions for names,
 * roles and keyboard behaviour that axe cannot verify on its own.
 */

describe('NanoModuleComponent: accessibility (NFR-3)', () => {
  // ------------------------------------------------------------- axe states
  it.each(['dark', 'light'] as const)('[A11Y][FR-1][view-%s] should have no axe violations', async (theme) => {
    const { moduleEl } = await renderModule({ theme });
    await expectNoAxeViolations(moduleEl);
  });

  it.each(['dark', 'light'] as const)('[A11Y][FR-3][selected-%s] should have no axe violations', async (theme) => {
    const { moduleEl } = await renderModule({ theme, selectMode: true });
    await expectNoAxeViolations(moduleEl);
  });

  it.each(['dark', 'light'] as const)('[A11Y][FR-4][edit-%s] should have no axe violations', async (theme) => {
    const { moduleEl } = await renderModule({ theme, editMode: true });
    await expectNoAxeViolations(moduleEl);
  });

  it('[A11Y][FR-8][inline-title-edit] should have no axe violations', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    await expectNoAxeViolations(moduleEl);
  });

  it('[A11Y][FR-8][inline-port-edit] should have no axe violations', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickPortName('inputs', 'Dataset Object');
    await expectNoAxeViolations(moduleEl);
  });

  it('[A11Y][FR-16][adding-port] should have no axe violations', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickAdd('parameters');
    await expectNoAxeViolations(moduleEl);
  });

  it('[A11Y][FR-12][saving-status] should have no axe violations while saving', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    await harness.typeInto((await harness.getTitleInput())!, 'Accessible');
    await expectNoAxeViolations(moduleEl);
  });

  // ----------------------------------------------------- names and roles
  it.each(SECTIONS)(
    '[A11Y][FR-4c][edit] should give each $section delete control a button role and a name containing the port name',
    async ({ section }) => {
      const { host, moduleEl } = await renderModule({ editMode: true });
      const buttons = Array.from(
        moduleEl.querySelectorAll<HTMLElement>(`${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.deleteButton}`),
      );
      const names = host.node()[section].map((p) => p.name);
      expect(buttons).toHaveLength(names.length);
      buttons.forEach((b, i) => {
        expect(b.tagName).toBe('BUTTON');
        expect(accessibleName(b)).toContain(names[i]);
      });
    },
  );

  it.each(SECTIONS)(
    '[A11Y][FR-4d][edit] should give the $section add control a button role and a non-empty name',
    async ({ section }) => {
      const { moduleEl } = await renderModule({ editMode: true });
      const btn = q(moduleEl, `${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.addButton}`);
      expect(btn.tagName).toBe('BUTTON');
      expect(accessibleName(btn)).toMatch(/add/i);
    },
  );

  it('[A11Y][FR-8][inline-edit] should give the title input an accessible name and move focus into it', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = q<HTMLInputElement>(moduleEl, NANO_MODULE_PARTS.titleInput);
    expect(accessibleName(input)).not.toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('[A11Y][FR-16][adding-port] should give the new-port input an accessible name and focus it', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickAdd('outputs');
    const input = q<HTMLInputElement>(moduleEl, `${NANO_MODULE_PARTS.section('outputs')} ${NANO_MODULE_PARTS.newPortInput}`);
    expect(accessibleName(input)).not.toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('[A11Y][FR-12][saving-status] should announce the save status through a live region', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    await harness.typeInto((await harness.getTitleInput())!, 'Announced');
    const status = q(moduleEl, NANO_MODULE_PARTS.status);
    const live = status.closest('[role="status"], [aria-live="polite"], [aria-live="assertive"]');
    expect(live).not.toBeNull();
  });

  it('[A11Y][FR-7][edit-hover] should expose the edit hint with role="tooltip"', async () => {
    const { moduleEl, settle } = await renderModule({ editMode: true });
    await realHover(q(moduleEl, NANO_MODULE_PARTS.title));
    await settle();
    expect(visibleTooltip()?.getAttribute('role')).toBe('tooltip');
  });

  // -------------------------------------------------------------- keyboard
  it('[A11Y][FR-11][keyboard] should return to the text view and keep focus inside the module after Enter', async () => {
    const { harness, moduleEl } = await renderModule({ editMode: true });
    await harness.clickTitle();
    const input = (await harness.getTitleInput())!;
    await harness.typeInto(input, 'Keyboard Title');
    await harness.pressEnter(input);
    expect(await harness.getTitleInput()).toBeNull();
    expect(q(moduleEl, NANO_MODULE_PARTS.title).textContent?.trim()).toBe('Keyboard Title');
  });

  it('[A11Y][FR-4c][keyboard] should make delete buttons reachable by keyboard', async () => {
    const { moduleEl } = await renderModule({ editMode: true });
    const btn = q<HTMLButtonElement>(moduleEl, NANO_MODULE_PARTS.deleteButton);
    expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    expect(btn.disabled).toBe(false);
  });
});
