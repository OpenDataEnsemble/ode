/**
 * Generates the :root CSS block for placeholder_app.html from @ode/tokens.
 * Run from formulus root: node scripts/generatePlaceholderTokens.js
 * When ODE tokens change, run this script (or prebuild) so the placeholder updates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const formulusRoot = path.resolve(__dirname, '..');

const TOKENS_PATH = path.join(
  formulusRoot,
  'node_modules',
  '@ode',
  'tokens',
  'dist',
  'json',
  'tokens.json',
);
const PLACEHOLDER_PATH = path.join(
  formulusRoot,
  'assets',
  'webview',
  'placeholder_app.html',
);

const MARKER_START = '/* ODE_TOKENS_START */';
const MARKER_END = '/* ODE_TOKENS_END */';

function loadTokens() {
  if (!fs.existsSync(TOKENS_PATH)) {
    console.error(
      `[generatePlaceholderTokens] Tokens not found at ${TOKENS_PATH}\n` +
        'Run "pnpm run build" in packages/tokens (or from repo root) and ensure formulus has @ode/tokens linked.',
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
}

function generateRootBlock(t) {
  const c = t.color || {};
  const brand = c.brand || {};
  const primary = brand.primary || {};
  const neutral = c.neutral || {};
  const spacing = t.spacing || {};
  const font = t.font || {};
  const size = font.size || {};
  const weight = font.weight || {};
  const family = font.family || {};
  const lineHeight = font.lineHeight || {};
  const border = t.border || {};
  const radius = border.radius || {};
  const width = border.width || {};
  const filter = t.filter || {};
  const blur = filter.blur || {};
  const opacity = t.opacity || {};

  const opacity70 = opacity['70'] ?? '0.7';

  return `/*
       * ODE design tokens — generated from packages/tokens. Do not edit; run pnpm run generate:placeholder-tokens to update.
       */
      :root {
        /* color.brand.primary */
        --color-brand-primary-500: ${primary['500'] ?? '#4f7f4e'};
        --color-brand-primary-400: ${primary['400'] ?? '#6fa46e'};
        /* color.neutral */
        --color-neutral-black: ${neutral.black ?? '#000000'};
        --color-neutral-white: ${neutral.white ?? '#ffffff'};
        --color-neutral-400: ${neutral['400'] ?? '#bdbdbd'};
        --color-neutral-600: ${neutral['600'] ?? '#757575'};
        /* opacity.70 for overlay */
        --opacity-70: ${opacity70};
        --overlay-light: rgba(255, 255, 255, var(--opacity-70));
        --overlay-dark: rgba(0, 0, 0, var(--opacity-70));
        /* spacing */
        --spacing-1: ${spacing['1'] ?? '4px'};
        --spacing-2: ${spacing['2'] ?? '8px'};
        --spacing-3: ${spacing['3'] ?? '12px'};
        --spacing-4: ${spacing['4'] ?? '16px'};
        --spacing-6: ${spacing['6'] ?? '24px'};
        --spacing-8: ${spacing['8'] ?? '32px'};
        --spacing-10: ${spacing['10'] ?? '40px'};
        /* font.size */
        --font-size-xs: ${size.xs ?? '12px'};
        --font-size-sm: ${size.sm ?? '14px'};
        --font-size-base: ${size.base ?? '16px'};
        --font-size-xl: ${size.xl ?? '20px'};
        --font-size-3xl: ${size['3xl'] ?? '32px'};
        /* font.weight */
        --font-weight-regular: ${weight.regular ?? '400'};
        --font-weight-bold: ${weight.bold ?? '700'};
        /* font.family.sans */
        --font-family-sans: ${(family.sans || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif').replace(/"/g, "'")};
        /* font.lineHeight */
        --line-height-tight: ${lineHeight.tight ?? '1.25'};
        --line-height-normal: ${lineHeight.normal ?? '1.5'};
        /* border.radius.md, border.width.thin */
        --border-radius-md: ${radius.md ?? '8px'};
        --border-width-thin: ${width.thin ?? '1px'};
        /* filter.blur */
        --blur-4: ${blur['4'] ?? '4px'};
        --blur-7: ${blur['7'] ?? '7px'};
        /* content max-width: no ODE token; layout constant */
        --content-max-width: 320px;
      }`;
}

function main() {
  const tokens = loadTokens();
  const rootBlock = generateRootBlock(tokens);

  let html = fs.readFileSync(PLACEHOLDER_PATH, 'utf8');

  if (!html.includes(MARKER_START) || !html.includes(MARKER_END)) {
    console.error(
      '[generatePlaceholderTokens] Placeholder HTML must contain /* ODE_TOKENS_START */ and /* ODE_TOKENS_END */.',
    );
    process.exit(1);
  }

  const startIdx = html.indexOf(MARKER_START);
  const endIdx = html.indexOf(MARKER_END) + MARKER_END.length;
  const before = html.slice(0, startIdx);
  const after = html.slice(endIdx);
  const newContent =
    before + MARKER_START + '\n' + rootBlock + '\n      ' + MARKER_END + after;

  fs.writeFileSync(PLACEHOLDER_PATH, newContent, 'utf8');
  console.log(
    '[generatePlaceholderTokens] Updated assets/webview/placeholder_app.html from @ode/tokens.',
  );
}

main();
