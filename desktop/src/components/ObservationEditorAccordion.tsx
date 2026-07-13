import { type ReactNode, useState } from 'react';

type EditorSection = 'metadata' | 'data';

export interface ObservationEditorAccordionProps {
  metadata: ReactNode;
  dataEditor: ReactNode;
  /** Form type label shown in the metadata panel header. */
  formTypeLabel?: string;
}

export function ObservationEditorAccordion({
  metadata,
  dataEditor,
  formTypeLabel,
}: ObservationEditorAccordionProps) {
  const [openSection, setOpenSection] = useState<EditorSection>('data');

  const sections: {
    id: EditorSection;
    title: string;
    meta: string;
    icon: string;
  }[] = [
    {
      id: 'metadata',
      title: 'Metadata',
      meta: formTypeLabel?.trim() || 'Repository and envelope fields',
      icon: 'info',
    },
    {
      id: 'data',
      title: 'Data',
      meta: 'Observation JSON payload',
      icon: 'data_object',
    },
  ];

  function toggle(section: EditorSection) {
    setOpenSection(prev => (prev === section ? prev : section));
  }

  return (
    <div className="observations-overview-accordion observation-editor-accordion">
      {sections.map(section => {
        const isOpen = openSection === section.id;
        return (
          <div
            key={section.id}
            className={`observations-overview-accordion-item${isOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="observations-overview-accordion-header"
              aria-expanded={isOpen}
              onClick={() => toggle(section.id)}>
              <span className="material-symbols-outlined" aria-hidden>
                {isOpen ? 'expand_more' : 'chevron_right'}
              </span>
              <span
                className="material-symbols-outlined observations-overview-accordion-icon"
                aria-hidden>
                {section.icon}
              </span>
              <span className="observations-overview-accordion-title">
                {section.title}
              </span>
              <span className="muted observations-overview-accordion-meta">
                {section.meta}
              </span>
            </button>
            {isOpen ? (
              <div
                className={`observations-overview-accordion-body${section.id === 'data' ? ' observation-editor-data-body' : ''}`}>
                {section.id === 'metadata' ? metadata : dataEditor}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
