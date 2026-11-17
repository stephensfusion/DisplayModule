import { EnvironmentProviders, Provider, provideZonelessChangeDetection } from '@angular/core';

/**
 * Global test providers (unit-test builder `providersFile`).
 * Zoneless change detection, as required by the generator §3.1. zone.js is not loaded.
 */
const providers: (Provider | EnvironmentProviders)[] = [provideZonelessChangeDetection()];

export default providers;
