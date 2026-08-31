export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(Number(size)) || 1);
  if (items.length === 0) {
    return [];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(items.slice(i, i + n));
  }
  return out;
}
