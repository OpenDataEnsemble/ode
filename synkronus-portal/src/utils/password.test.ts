import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateStrongPassword } from './password';

const SEED = 0x5eed1234;

type RandomSource = <T extends ArrayBufferView>(array: T) => T;

/** xorshift32 state, reseeded by the tests. */
let state = SEED;

function nextWord(): number {
  state ^= state << 13;
  state >>>= 0;
  state ^= state >>> 17;
  state ^= state << 5;
  state >>>= 0;
  return state;
}

/**
 * Deterministic stand-in for `crypto.getRandomValues`. Production randomness is
 * left untouched: only the entropy source is replaced so every assertion below
 * is reproducible.
 */
function stubbedRandom(): RandomSource {
  return <T extends ArrayBufferView>(array: T): T => {
    const words = new Uint32Array(
      array.buffer,
      array.byteOffset,
      array.byteLength >>> 2,
    );
    for (let i = 0; i < words.length; i += 1) {
      words[i] = nextWord();
    }
    return array;
  };
}

describe('generateStrongPassword', () => {
  beforeEach(() => {
    state = SEED;
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(
      stubbedRandom(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to 16 characters', () => {
    expect(generateStrongPassword()).toHaveLength(16);
  });

  it('raises a too-small request to the 12 character minimum', () => {
    expect(generateStrongPassword(4)).toHaveLength(12);
    expect(generateStrongPassword(0)).toHaveLength(12);
    expect(generateStrongPassword(-5)).toHaveLength(12);
  });

  it('honours a length above the minimum', () => {
    expect(generateStrongPassword(24)).toHaveLength(24);
    expect(generateStrongPassword(64)).toHaveLength(64);
  });

  it('always contains a character from every class', () => {
    const password = generateStrongPassword(32);

    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*\-_=+]/);
  });

  it('never emits the documented look-alike characters', () => {
    const ambiguous = new Set(['0', 'O', '1', 'l', 'I']);
    const password = generateStrongPassword(256);

    for (const character of password) {
      expect(ambiguous.has(character)).toBe(false);
    }
  });

  it('repeats the same output for the same seed', () => {
    const first = generateStrongPassword(16);

    state = SEED;
    const second = generateStrongPassword(16);

    expect(second).toBe(first);
  });
});
