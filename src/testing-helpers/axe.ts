import axe from 'axe-core';
import { expect } from 'vitest';

/** Formats axe violations for readable assertion output. */
function format(violations: axe.Result[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
    .join('\n');
}

/** Custom Vitest axe matcher: `await expectNoAxeViolations(el)`. */
export async function expectNoAxeViolations(el: Element, options: axe.RunOptions = {}): Promise<void> {
  const result = await axe.run(el, { resultTypes: ['violations'], ...options });
  expect(result.violations, format(result.violations)).toEqual([]);
}
