/**
 * React Router `location.state` payload when opening Form preview from Data management
 * (e.g. “Edit in formplayer” on an observation).
 */
export type FormPreviewEditState = {
  formType: string;
  observationId: string;
  params: Record<string, unknown>;
  savedData: Record<string, unknown>;
};
