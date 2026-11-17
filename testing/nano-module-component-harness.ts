import { ComponentHarness, TestElement, TestKey } from '@angular/cdk/testing';

/** Port groups rendered by `<nano-module>`. */
export type NanoModulePortSection = 'parameters' | 'inputs' | 'outputs';

/**
 * DOM contract hooks (API_CONTRACT.md §6). Every selector the public tests
 * depend on is defined here, so a contract change touches one file.
 */
export const NANO_MODULE_PARTS = {
  title: '[data-part="title"]',
  section: (s: NanoModulePortSection) => `[data-section="${s}"]`,
  portRow: '[data-part="port-row"]',
  portName: '[data-part="port-name"]',
  portHandle: '.port',
  deleteButton: 'button[data-part="delete-port"]',
  addButton: 'button[data-part="add-port"]',
  editWrapper: '.edit-input-wrapper',
  titleInput: '.edit-input-wrapper input[data-part="title-input"]',
  portInput: '.edit-input-wrapper input[data-part="port-input"]',
  newPortInput: '.edit-input-wrapper input[data-part="new-port-input"]',
  anyInput: '.edit-input-wrapper input',
  editingBadge: '[data-part="editing-badge"]',
  status: '[data-part="status"]',
} as const;

/**
 * Component harness for `<nano-module>`.
 * Exported from `display-module/testing`.
 */
export class NanoModuleComponentHarness extends ComponentHarness {
  static hostSelector = 'nano-module';

  // ------------------------------------------------------------- reading

  /** Visible title text (trimmed). */
  async getTitleText(): Promise<string> {
    return (await (await this.locatorFor(NANO_MODULE_PARTS.title)()).text()).trim();
  }

  /** Port names rendered in a section, in DOM order. */
  async getPortNames(section: NanoModulePortSection): Promise<string[]> {
    const els = await this.locatorForAll(
      `${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.portName}`,
    )();
    return Promise.all(els.map(async (e) => (await e.text()).trim()));
  }

  /** Port drag handles (`.port`) in a section, in DOM order. */
  async getPortHandles(section: NanoModulePortSection): Promise<TestElement[]> {
    return this.locatorForAll(
      `${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.portHandle}`,
    )();
  }

  /** DOM ids of the port handles in a section, in DOM order. */
  async getPortHandleIds(section: NanoModulePortSection): Promise<string[]> {
    const handles = await this.getPortHandles(section);
    return Promise.all(handles.map((h) => h.getProperty<string>('id')));
  }

  /** Port handle for the named port (names and handles share DOM order). */
  async getPortHandle(section: NanoModulePortSection, name: string): Promise<TestElement> {
    const names = await this.getPortNames(section);
    const index = names.indexOf(name);
    if (index < 0) throw new Error(`Port "${name}" not found in ${section}`);
    return (await this.getPortHandles(section))[index];
  }

  /** Whether the "Editing" badge is rendered. */
  async hasEditingBadge(): Promise<boolean> {
    return (await this.locatorForOptional(NANO_MODULE_PARTS.editingBadge)()) !== null;
  }

  /** Text of the "Editing" badge, or null. */
  async getEditingBadgeText(): Promise<string | null> {
    const badge = await this.locatorForOptional(NANO_MODULE_PARTS.editingBadge)();
    return badge ? (await badge.text()).trim() : null;
  }

  /** Text of the save-status indicator, or null when it is absent or empty. */
  async getStatusText(): Promise<string | null> {
    const status = await this.locatorForOptional(NANO_MODULE_PARTS.status)();
    if (!status) return null;
    const text = (await status.text()).trim();
    return text.length ? text : null;
  }

  // ---------------------------------------------------------- edit mode

  /** Delete buttons, optionally limited to one section. */
  async getDeleteButtons(section?: NanoModulePortSection): Promise<TestElement[]> {
    const prefix = section ? `${NANO_MODULE_PARTS.section(section)} ` : '';
    return this.locatorForAll(`${prefix}${NANO_MODULE_PARTS.deleteButton}`)();
  }

  /** Clicks the delete button of the named port. */
  async deletePort(section: NanoModulePortSection, name: string): Promise<void> {
    const names = await this.getPortNames(section);
    const index = names.indexOf(name);
    if (index < 0) throw new Error(`Port "${name}" not found in ${section}`);
    const buttons = await this.getDeleteButtons(section);
    await buttons[index].click();
  }

  /** "Add" button of a section, or null when it is hidden. */
  async getAddButton(section: NanoModulePortSection): Promise<TestElement | null> {
    return this.locatorForOptional(
      `${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.addButton}`,
    )();
  }

  /** Clicks the "Add" button of a section. */
  async clickAdd(section: NanoModulePortSection): Promise<void> {
    const btn = await this.getAddButton(section);
    if (!btn) throw new Error(`Add button for ${section} not rendered`);
    await btn.click();
  }

  /** Clicks the title text. */
  async clickTitle(): Promise<void> {
    await (await this.locatorFor(NANO_MODULE_PARTS.title)()).click();
  }

  /** Clicks the visible name of a port. */
  async clickPortName(section: NanoModulePortSection, name: string): Promise<void> {
    const els = await this.locatorForAll(
      `${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.portName}`,
    )();
    for (const el of els) {
      if ((await el.text()).trim() === name) {
        await el.click();
        return;
      }
    }
    throw new Error(`Port "${name}" not found in ${section}`);
  }

  /** Title inline input, or null. */
  async getTitleInput(): Promise<TestElement | null> {
    return this.locatorForOptional(NANO_MODULE_PARTS.titleInput)();
  }

  /** Existing-port inline input, or null. */
  async getPortInput(): Promise<TestElement | null> {
    return this.locatorForOptional(NANO_MODULE_PARTS.portInput)();
  }

  /** New-port input of a section, or null. */
  async getNewPortInput(section: NanoModulePortSection): Promise<TestElement | null> {
    return this.locatorForOptional(
      `${NANO_MODULE_PARTS.section(section)} ${NANO_MODULE_PARTS.newPortInput}`,
    )();
  }

  /** Any open inline input, or null. */
  async getAnyEditInput(): Promise<TestElement | null> {
    return this.locatorForOptional(NANO_MODULE_PARTS.anyInput)();
  }

  /** Replaces the value of an inline input by typing (dispatches key and input events). */
  async typeInto(inputEl: TestElement, text: string): Promise<void> {
    await inputEl.clear();
    if (text.length) await inputEl.sendKeys(text);
  }

  /** Presses Enter in an inline input. */
  async pressEnter(inputEl: TestElement): Promise<void> {
    await inputEl.sendKeys(TestKey.ENTER);
  }

  /** Presses Escape in an inline input. */
  async pressEscape(inputEl: TestElement): Promise<void> {
    await inputEl.sendKeys(TestKey.ESCAPE);
  }

  // ------------------------------------------------------------ clicking

  /** Single click on the module (on its title text, outside edit mode). */
  async clickModule(): Promise<void> {
    await (await this.locatorFor(NANO_MODULE_PARTS.title)()).click();
  }

  /** Double click on the module (on its title text, outside edit mode). */
  async doubleClickModule(): Promise<void> {
    await (await this.locatorFor(NANO_MODULE_PARTS.title)()).dispatchEvent('dblclick');
  }
}
