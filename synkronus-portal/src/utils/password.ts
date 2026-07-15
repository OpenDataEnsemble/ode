/**
 * Generate a strong random password suitable for Formulus onboarding handoff.
 * Uses crypto.getRandomValues; excludes ambiguous characters (0/O, 1/l/I).
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % max;
}

function pick(charset: string): string {
  return charset[randomIndex(charset.length)]!;
}

export function generateStrongPassword(length = 16): string {
  const len = Math.max(12, length);
  // Guarantee at least one of each class, then fill the rest.
  const chars: string[] = [
    pick(UPPER),
    pick(LOWER),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  for (let i = chars.length; i < len; i++) {
    chars.push(pick(ALL));
  }
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
