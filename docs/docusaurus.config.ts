import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ODE - Open Data Ensemble',
  tagline: 'A symphony of data instruments to support your data collection and analysis.',
  favicon: 'img/favicon.ico',

  url: 'https://opendataensemble.org',
  baseUrl: '/',

  organizationName: 'OpenDataEnsemble',
  projectName: 'ode',

  onBrokenLinks: 'throw',
  // TOC same-page links (#overview, etc.) are validated at build time but markdown
  // heading IDs are not always collected in the same pass — site-wide false positives.
  // Real cross-page anchor issues are rare; onBrokenLinks still throws on bad paths.
  onBrokenAnchors: 'ignore',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: 'https://github.com/OpenDataEnsemble/ode/tree/dev/docs/',
          remarkPlugins: [require('./plugins/fix-docs-links')],
          rehypePlugins: [require('./plugins/fix-docs-links-rehype')],
          disableVersioning: true,
        },
        pages: {
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'ODE',
      logo: {
        alt: 'ODE Logo',
        src: 'img/ode-logo.png',
      },
      hideOnScroll: false,
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          label: 'Documentation',
          position: 'right',
        },
        {
          to: '/downloads',
          label: 'Downloads',
          position: 'right',
        },
        {
          label: 'Components',
          position: 'right',
          items: [
            {
              type: 'doc',
              docId: 'reference/formulus',
              label: 'Formulus',
            },
            {
              type: 'doc',
              docId: 'reference/synkronus-server',
              label: 'Synkronus Server',
            },
            {
              type: 'doc',
              docId: 'reference/synkronus-cli',
              label: 'Synkronus CLI',
            },
            {
              type: 'doc',
              docId: 'reference/formplayer',
              label: 'Formplayer',
            },
            {
              type: 'doc',
              docId: 'reference/ode-desktop',
              label: 'ODE Desktop',
            },
          ],
        },
        {
          label: 'Community',
          position: 'right',
          items: [
            {
              label: 'Forum',
              href: 'https://forum.opendataensemble.org',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/OpenDataEnsemble/ode',
            },
            {
              type: 'doc',
              docId: 'community/getting-help',
              label: 'Get Help',
            },
            {
              type: 'doc',
              docId: 'community/examples',
              label: 'Examples',
            },
          ],
        },
        {
          label: 'Resources',
          position: 'right',
          items: [
            {
              type: 'doc',
              docId: 'getting-started/what-is-ode',
              label: 'What is ODE?',
            },
            {
              type: 'doc',
              docId: 'development/quick-start',
              label: 'Quick Start',
            },
            {
              type: 'doc',
              docId: 'development/installation',
              label: 'Installation',
            },
            {
              type: 'doc',
              docId: 'development/setup',
              label: 'Development Setup',
            },
          ],
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Overview',
              to: '/docs',
            },
            {
              label: 'Downloads',
              to: '/downloads',
            },
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Using ODE',
              to: '/docs/using',
            },
            {
              label: 'Reference',
              to: '/docs/reference',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Forum',
              href: 'https://forum.opendataensemble.org',
            },
          ],
        },
        {
          title: 'Legal',
          items: [
            {
              label: 'Formulus privacy policy',
              to: '/docs/legal/formulus-privacy-policy',
            },
            {
              label: 'Account & data deletion',
              to: '/docs/legal/formulus-account-deletion',
            },
            {
              label: 'Formulus terms of use',
              to: '/docs/legal/formulus-terms',
            },
            {
              label: 'Open source license (MIT)',
              to: '/docs/legal/open-source-license',
            },
          ],
        },
        {
          title: 'Contact',
          items: [
            {
              html: '<a href="https://github.com/OpenDataEnsemble/ode" target="_blank" rel="noopener noreferrer" class="footer__social-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHub</a>',
            },
            {
              html: '<a href="https://www.linkedin.com/company/opendataensemble" target="_blank" rel="noopener noreferrer" class="footer__social-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> LinkedIn</a>',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Open Data Ensemble. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'typescript', 'javascript'],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

