import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Persona-based sidebar structure for Open Data Ensemble documentation.
 * 
 * This structure prioritizes three main user personas:
 * 1. Data Collectors - Non-technical field workers using Formulus
 * 2. Implementers - Form designers and project managers
 * 3. Developers - Engineers contributing to or extending ODE
 * 
 * Documentation best practices applied:
 * - User-focused content organized by role
 * - Clear entry points for each persona
 * - Shared reference materials (API, Components)
 * - Community resources for all users
 */
const sidebars: SidebarsConfig = {
  docs: [
    // Main landing page
    {
      type: 'doc',
      id: 'index',
      label: 'Welcome to ODE',
    },
    
    // Getting Started
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/why-ode',
        'getting-started/key-concepts',
        {
          type: 'link',
          label: 'Downloads',
          href: '/downloads',
        },
        {
          type: 'category',
          label: 'Installation',
          link: { type: 'doc', id: 'getting-started/installation' },
          items: [
            'getting-started/installation/installing-synkronus',
            'getting-started/installation/installing-formulus',
            'getting-started/installation/installing-ode-desktop',
          ],
        },
        'getting-started/faq',
        'getting-started/architecture-overview',
        'getting-started/synkronus-quickstart',
      ],
    },
    
    // PERSONA 1: Data Collectors (Non-technical field workers)
    {
      type: 'category',
      label: 'For Data Collectors',
      link: {
        type: 'doc',
        id: 'collector/collector-index',
      },
      items: [
        {
          type: 'doc',
          id: 'collector/collector-index',
          label: 'Overview',
        },
        'collector/collector-getting-started',
        'getting-started/installation/installing-formulus',
        'using/your-first-form',
        'using/formulus-features',
        'using/synchronization',
        'using/working-offline',
        'using/troubleshooting',
      ],
    },
    
    // PERSONA 2: Implementers (Form designers & project managers)
    {
      type: 'category',
      label: 'For Implementers',
      link: {
        type: 'doc',
        id: 'implementer/implementer-index',
      },
      items: [
        {
          type: 'doc',
          id: 'implementer/implementer-index',
          label: 'Overview',
        },
        'implementer/implementer-overview',
        {
          type: 'category',
          label: 'Guides',
          items: [
            'guides/building-custom-apps',
            'guides/building-custom-apps-v1',
            'guides/building-custom-apps-v2',
            'guides/form-design',
            'guides/form-translations',
            'guides/choice-lists',
            'guides/dynamic-choice-lists',
            'guides/observation-queries',
            'guides/ode-desktop-developer-mode',
            'guides/custom-extensions',
            'guides/custom-question-types',
            'guides/server-architecture-for-it',
            'guides/deployment',
            'guides/configuration',
          ],
        },
        'using/app-bundles',
        'using/data-management',
        'using/custom-applications',
        {
          type: 'category',
          label: 'ODE Desktop',
          link: { type: 'doc', id: 'using/ode-desktop/index' },
          items: [
            'using/ode-desktop/profiles',
            'using/ode-desktop/observations',
            'using/ode-desktop/import',
            'using/ode-desktop/sync',
            'using/ode-desktop/about',
            {
              type: 'category',
              label: 'Workbench',
              items: [
                'using/ode-desktop/workbench-bundles',
                'using/ode-desktop/workbench-form-preview',
                'using/ode-desktop/workbench-custom-app',
                'using/ode-desktop/developer-mode',
              ],
            },
          ],
        },
      ],
    },
    
    // PERSONA 3: Developers (Engineers & contributors)
    {
      type: 'category',
      label: 'For Developers',
      link: {
        type: 'doc',
        id: 'developer/developer-index',
      },
      items: [
        {
          type: 'doc',
          id: 'developer/developer-index',
          label: 'Overview',
        },
        'developer/developer-getting-started',
        'development/quick-start',
        'development/architecture',
        'development/setup',
        'development/building-testing',
        'development/contributing',
        'development/extending',
        {
          type: 'category',
          label: 'Component Development',
          items: [
            'development/formulus-development',
            'development/formplayer-development',
            'development/synkronus-development',
            'development/synkronus-portal-development',
            'development/ode-desktop-development',
          ],
        },
      ],
    },
    
    // Shared Reference Materials
    {
      type: 'category',
      label: 'Reference',
      link: {
        type: 'doc',
        id: 'reference/index',
      },
      items: [
        {
          type: 'category',
          label: 'API',
          items: [
            'reference/api',
            'reference/form-specifications',
            'reference/app-bundle-format',
            {
              type: 'category',
              label: 'REST API',
              items: [
                'reference/rest-api/overview',
                'reference/rest-api/authentication',
                'reference/rest-api/sync',
                'reference/rest-api/app-bundle',
                'reference/rest-api/attachments',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'Components',
          items: [
            'reference/components',
            'reference/formulus',
            'reference/formplayer',
            'reference/formplayer-contract',
            'reference/synkronus-server',
            'reference/synkronus-cli',
            'reference/synkronus-portal',
            'reference/ode-desktop',
          ],
        },
        {
          type: 'category',
          label: 'Configuration',
          items: [
            'reference/configuration/client',
            'reference/configuration/server',
            'reference/security',
          ],
        },
      ],
    },
    
    // Community & Support
    {
      type: 'category',
      label: 'Community',
      link: {
        type: 'doc',
        id: 'community/index',
      },
      items: [
        'community/getting-help',
        'community/examples',
        'community/contribute/first-time',
        'community/contribute/code-of-conduct',
      ],
    },

  ],
};

export default sidebars;
