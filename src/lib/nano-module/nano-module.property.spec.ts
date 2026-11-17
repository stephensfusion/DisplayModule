import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { allPortIds, allPortNames, createNode, renderModule } from '../../testing-helpers';

/*
 * Public property-based tests (fast-check). Each run renders a fresh fixture;
 * run counts are kept small because every run drives a real browser DOM.
 */

const RUNS = 15;
const SEED = 20261116;

/** Names reserved by the reference fixture (lower-cased), excluded to avoid duplicates. */
const RESERVED = new Set(allPortNames(createNode()).map((n) => n.toLowerCase()));

/** Printable names without leading/trailing whitespace, not colliding with the fixture names. */
const coreName = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{0,20}[A-Za-z0-9]$/)
  .filter((s) => !RESERVED.has(s.toLowerCase()));

const padding = fc.stringMatching(/^ {0,4}$/);

describe('NanoModuleComponent: properties', () => {
  it('[FR-10] should always store the trimmed title for any padded non-empty input', async () => {
    await fc.assert(
      fc.asyncProperty(padding, coreName, padding, async (pre, core, post) => {
        TestBed.resetTestingModule();
        const { host, harness, fixture } = await renderModule({ editMode: true });
        await harness.clickTitle();
        const input = (await harness.getTitleInput())!;
        await harness.typeInto(input, `${pre}${core}${post}`);
        await input.blur();
        expect(host.node().title).toBe(core);
        fixture.destroy();
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });

  it('[FR-16][FR-31] should always generate unique, non-empty ids for any sequence of added ports', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(coreName, { minLength: 1, maxLength: 4, selector: (s) => s.toLowerCase() }),
        async (names) => {
          TestBed.resetTestingModule();
          const { host, harness, fixture } = await renderModule({ editMode: true });
          for (const name of names) {
            await harness.clickAdd('inputs');
            const input = (await harness.getNewPortInput('inputs'))!;
            await harness.typeInto(input, name);
            await input.blur();
          }
          const ids = allPortIds(host.node());
          expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
          expect(new Set(ids).size).toBe(ids.length);
          expect(host.added).toHaveLength(names.length);
          fixture.destroy();
        },
      ),
      { numRuns: RUNS, seed: SEED },
    );
  });
});
