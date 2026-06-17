/**
 * Minimal valid FormInitData for desktop formplayer smoke test (JSON Forms).
 * Matches `FormulusInterfaceDefinition.FormInitData` shape.
 */
export const FORMPLAYER_MINIMAL_INIT = {
  formType: 'ode.desktop.preview',
  observationId: null,
  params: {},
  savedData: {},
  formSchema: {
    type: 'object',
    properties: {
      note: { type: 'string', title: 'Note' },
    },
  },
  uiSchema: {
    type: 'VerticalLayout',
    elements: [
      {
        type: 'Control',
        scope: '#/properties/note',
      },
    ],
  },
};
