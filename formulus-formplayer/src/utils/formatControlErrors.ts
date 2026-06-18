/** Normalize JSON Forms `errors` for QuestionShell display. */
export function formatControlErrors(
  errors: string | string[] | undefined | null,
): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    const joined = errors.filter(Boolean).join(', ');
    return joined || null;
  }
  return String(errors) || null;
}
