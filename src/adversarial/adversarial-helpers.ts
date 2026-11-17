import { NanoModulePortSection } from '../../testing/public-api';
import { WorkSpaceNode } from '../lib/models/workspace-node.model';
import { Rendered, allPortNames } from '../testing-helpers';

/** Adds a port through the UI (click add → type → blur). */
export async function adversarialAdd(r: Rendered, section: NanoModulePortSection, name: string): Promise<void> {
  const btn = await r.harness.getAddButton(section);
  if (!btn) throw new Error(`Add button for ${section} not available`);
  await btn.click();
  const input = await r.harness.getNewPortInput(section);
  if (!input) throw new Error(`New-port input for ${section} not opened`);
  await r.harness.typeInto(input, name);
  await input.blur();
  await r.settle();
}

/** Renames a port through the UI (click name → type → blur). */
export async function renamePort(
  r: Rendered,
  section: NanoModulePortSection,
  from: string,
  to: string,
): Promise<void> {
  await r.harness.clickPortName(section, from);
  const input = await r.harness.getPortInput();
  if (!input) throw new Error('Port input not opened');
  await r.harness.typeInto(input, to);
  await input.blur();
  await r.settle();
}

/** Lower-cased, trimmed names that occur more than once across the node. */
export function caseInsensitiveDuplicates(node: WorkSpaceNode): string[] {
  const seen = new Map<string, number>();
  for (const n of allPortNames(node)) {
    const key = n.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen].filter(([, c]) => c > 1).map(([k]) => k);
}
