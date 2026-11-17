import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

/**
 * Optional library configuration.
 *
 * PROVISIONAL (AMBIGUITY_LOG.md A-08): the requirement says "Optional accept
 * asset path if parent uses alternate locations or convert the add icon,
 * delete icon into Base64". It does not name an input or mechanism. The
 * generator's naming rules give `provideDisplayModule()` / `DISPLAY_MODULE_CONFIG`
 * as the configuration surface, so the asset path is exposed here.
 */
export interface DisplayModuleConfig {
  /**
   * Base path for the add/delete icon assets. Optional.
   *
   * When set, `<nano-module>` loads `plus-circle.svg` (add) and `trash-03.svg`
   * (delete) from this location. When omitted, inline Base64 icons are used.
   */
  assetPath?: string;
}

/**
 * Injection token carrying {@link DisplayModuleConfig}.
 * It has no default value: `<nano-module>` works without it.
 */
export const DISPLAY_MODULE_CONFIG = new InjectionToken<DisplayModuleConfig>(
  'DISPLAY_MODULE_CONFIG',
);

/**
 * Registers optional library configuration.
 *
 * @example
 * bootstrapApplication(App, { providers: [provideDisplayModule({ assetPath: '/assets/nano/' })] });
 *
 * @param config Library configuration.
 * @returns Environment providers for {@link DISPLAY_MODULE_CONFIG}.
 */
export function provideDisplayModule(config: DisplayModuleConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: DISPLAY_MODULE_CONFIG, useValue: config }]);
}
