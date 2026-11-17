import { vi } from 'vitest';

/**
 * Installs Vitest fake timers for debounce tests.
 *
 * Only setTimeout/setInterval/Date are faked. requestAnimationFrame stays real
 * so Angular's zoneless scheduler (setTimeout/rAF race) can still settle
 * fixtures. Callers MUST call `useRealTimersAfter()` (or `vi.useRealTimers()`)
 * in `afterEach`.
 */
export function useDebounceFakeTimers(): void {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
}

/** Advances fake time and flushes resulting microtasks. */
export async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** Restores real timers. */
export function useRealTimersAfter(): void {
  vi.clearAllTimers();
  vi.useRealTimers();
}
