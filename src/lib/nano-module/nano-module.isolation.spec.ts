import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { describe, expect, it } from 'vitest';

import { NanoModuleComponentHarness } from '../../../testing/public-api';
import { DISPLAY_MODULE_CONFIG, provideDisplayModule } from '../config/display-module.config';
import { WorkSpaceNode } from '../models/workspace-node.model';
import { NanoModuleComponent } from './nano-module.component';
import { createNode, renderModule } from '../../testing-helpers';

/*
 * Reusability / isolation tests (NFR-4). The component must work in any
 * Angular host without application-specific services, and several instances
 * must not share state.
 */

@Component({
  selector: 'dm-two-modules-host',
  imports: [NanoModuleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nano-module class="dark" [(workSpaceNode)]="a" [ignoreClasses]="[]" [isSelectMode]="false" [isEditMode]="editA()" />
    <nano-module class="light" [(workSpaceNode)]="b" [ignoreClasses]="[]" [isSelectMode]="false" [isEditMode]="false" />
  `,
})
class TwoModulesHost {
  readonly a = signal<WorkSpaceNode>(createNode({ id: 'node-a', title: 'Module A' }));
  readonly b = signal<WorkSpaceNode>(createNode({ id: 'node-b', title: 'Module B' }));
  readonly editA = signal(true);
}

/** Minimal consumer: only the documented required inputs, no outputs bound. */
@Component({
  selector: 'dm-minimal-host',
  imports: [NanoModuleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nano-module [workSpaceNode]="node" [isSelectMode]="false" [ignoreClasses]="[]" />`,
})
class MinimalHost {
  node = createNode({ title: 'Minimal' });
}

describe('NanoModuleComponent: reusability and isolation (NFR-4)', () => {
  it('[NFR-4][FR-1] should render with only required inputs and no outputs bound', async () => {
    TestBed.configureTestingModule({ imports: [MinimalHost] });
    const fixture = TestBed.createComponent(MinimalHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const harness = await TestbedHarnessEnvironment.loader(fixture).getHarness(NanoModuleComponentHarness);
    expect(await harness.getTitleText()).toBe('Minimal');
  });

  it('[NFR-4][FR-4] should keep edit state per instance when two modules share a page', async () => {
    TestBed.configureTestingModule({ imports: [TwoModulesHost] });
    const fixture = TestBed.createComponent(TwoModulesHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const [a, b] = await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(NanoModuleComponentHarness);
    expect(await a.hasEditingBadge()).toBe(true);
    expect(await b.hasEditingBadge()).toBe(false);
    expect(await b.getDeleteButtons()).toHaveLength(0);
  });

  it('[NFR-4][FR-10] should not leak an inline edit from one instance into another', async () => {
    TestBed.configureTestingModule({ imports: [TwoModulesHost] });
    const fixture = TestBed.createComponent(TwoModulesHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const [a, b] = await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(NanoModuleComponentHarness);
    await a.clickTitle();
    const input = (await a.getTitleInput())!;
    await a.typeInto(input, 'Only A');
    await input.blur();
    expect(fixture.componentInstance.a().title).toBe('Only A');
    expect(fixture.componentInstance.b().title).toBe('Module B');
    expect(await b.getTitleText()).toBe('Module B');
  });

  it('[NFR-4][FR-24] should apply each instance theme independently on the same page', async () => {
    TestBed.configureTestingModule({ imports: [TwoModulesHost] });
    const fixture = TestBed.createComponent(TwoModulesHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const [darkEl, lightEl] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nano-module'));
    expect(getComputedStyle(darkEl).backgroundColor).not.toBe(getComputedStyle(lightEl).backgroundColor);
  });

  it('[NFR-4][FR-26] should render without provideDisplayModule()', async () => {
    const { harness } = await renderModule();
    expect(await harness.getTitleText()).toBe('AI Dataset Analyser');
  });

  it('[NFR-4][FR-26] should accept an alternate asset path through provideDisplayModule()', async () => {
    const { harness } = await renderModule({
      editMode: true,
      providers: [provideDisplayModule({ assetPath: '/custom-assets/' })],
    });
    expect(TestBed.inject(DISPLAY_MODULE_CONFIG).assetPath).toBe('/custom-assets/');
    expect(await harness.getDeleteButtons()).not.toHaveLength(0);
  });

  it('[NFR-4] should not leave tooltips in the document after the module is destroyed', async () => {
    const { fixture, moduleEl, settle } = await renderModule();
    moduleEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    moduleEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await settle();
    fixture.destroy();
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(0);
  });
});
