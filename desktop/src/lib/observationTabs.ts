export function observationTabLabel(id: string): string {
  if (id.length <= 6) {
    return id;
  }
  return `${id.slice(0, 3)}…${id.slice(-3)}`;
}

export const MAX_OBSERVATION_TABS = 10;
