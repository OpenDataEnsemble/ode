/** Temporary sub-observation tracing — grep `SUBOBS_DEBUG` to remove. */

export function subObsDebug(
  phase: string,
  detail?: Record<string, unknown>,
): void {
  if (typeof console === 'undefined') {
    return;
  }
  console.warn(`[SUBOBS_DEBUG] ${phase}`, detail ?? '');
}

export function subObsCompletionSummary(
  completion: Record<string, unknown>,
): Record<string, unknown> {
  const formData = completion.formData;
  return {
    status: completion.status,
    formType: completion.formType,
    observationId: completion.observationId,
    formDataKeys:
      formData && typeof formData === 'object'
        ? Object.keys(formData as object)
        : [],
    message: completion.message,
  };
}
