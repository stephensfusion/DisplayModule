/**
 * Internal helper: creates ids for newly added ports (FR-31).
 * Not exported from the public API.
 */

const PORT_ID_PREFIX = 'port_';

/** Monotonic part of the last-resort generator, so two calls in the same millisecond differ. */
let fallbackCounter = 0;

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/** RFC 4122 version 4 UUID built from 16 random bytes (for non-secure contexts). */
function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, toHex);
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

function randomToken(): string {
  // `randomUUID` is only defined in secure contexts, so both members are treated as optional.
  const source: Partial<Crypto> | undefined = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') {
    return source.randomUUID();
  }
  if (typeof source?.getRandomValues === 'function') {
    return uuidFromBytes(source.getRandomValues(new Uint8Array(16)));
  }
  fallbackCounter += 1;
  return [Date.now().toString(36), fallbackCounter.toString(36), Math.random().toString(36).slice(2)].join('-');
}

/**
 * Returns `'port_' + crypto.randomUUID()` (or an equivalent random token where
 * `randomUUID` is unavailable). The result is never one of `existingIds`.
 */
export function createPortId(existingIds: ReadonlySet<string>): string {
  let id = PORT_ID_PREFIX + randomToken();
  while (existingIds.has(id)) {
    id = PORT_ID_PREFIX + randomToken();
  }
  return id;
}
