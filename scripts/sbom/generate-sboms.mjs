#!/usr/bin/env node
/**
 * Generate CycloneDX JSON SBOMs from the pnpm workspace and Go modules (cyclonedx-gomod).
 *
 * Usage:
 *   node scripts/sbom/generate-sboms.mjs [--out DIR] [--omit dev | --include-dev]
 *
 * Default: omit devDependencies (--omit dev).
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

/** @type {{ dir: string, slug: string }[]} */
const NPM_PROJECTS = [
  { dir: 'formulus', slug: 'formulus' },
  { dir: 'formulus-formplayer', slug: 'formulus-formplayer' },
  { dir: 'synkronus-portal', slug: 'synkronus-portal' },
  { dir: 'packages/components', slug: 'ode-components' },
  { dir: 'packages/tokens', slug: 'ode-tokens' },
];

/** @type {{ dir: string, slug: string }[]} */
const GO_MODULES = [
  { dir: 'synkronus', slug: 'synkronus' },
  { dir: 'synkronus-cli', slug: 'synkronus-cli' },
];

const CDX_SPEC_VERSION = '1.5';
const GOMOD_CDXML = 'github.com/CycloneDX/cyclonedx-gomod/cmd/cyclonedx-gomod@v1.9.0';

function parseArgs(argv) {
  let outDir = join(REPO_ROOT, 'sbom-dist');
  let omitDev = true;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) {
      outDir = resolve(argv[++i]);
    } else if (a === '--include-dev') {
      omitDev = false;
    } else if (a === '--omit' && argv[i + 1] === 'dev') {
      omitDev = true;
      i++;
    } else if (a === '--help' || a === '-h') {
      console.error(`Usage: node scripts/sbom/generate-sboms.mjs [--out DIR] [--omit dev] [--include-dev]`);
      process.exit(0);
    }
  }
  return { outDir, omitDev };
}

/**
 * @param {string} lockPath
 */
function nameFromNodeModulesPath(lockPath) {
  if (!lockPath.startsWith('node_modules/')) return null;
  const rest = lockPath.slice('node_modules/'.length);
  const segments = rest.split('/').filter(Boolean);
  if (segments[0]?.startsWith('@')) {
    if (segments.length < 2) return null;
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0] ?? null;
}

/**
 * @param {unknown} license
 * @returns {{ license: { id?: string, name?: string } }[]}
 */
function normalizeLicenses(license) {
  if (!license) return [];
  /** @type {{ id?: string, name?: string }[]} */
  const out = [];
  const push = (obj) => {
    if (obj.id) out.push({ license: { id: obj.id } });
    else if (obj.name) out.push({ license: { name: obj.name } });
  };
  if (typeof license === 'string') {
    push({ id: license });
    return out;
  }
  if (typeof license === 'object' && license !== null && 'type' in license && typeof license.type === 'string') {
    push({ name: license.type });
    return out;
  }
  if (Array.isArray(license)) {
    for (const entry of license) {
      if (typeof entry === 'string') push({ id: entry });
      else if (typeof entry === 'object' && entry && 'type' in entry) push({ name: entry.type });
    }
  }
  return out;
}

/**
 * @param {string} name
 * @param {string} version
 */
function npmPurl(name, version) {
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    if (slash === -1) return `pkg:npm/${name}@${version}`;
    const scope = name.slice(0, slash);
    const pkg = name.slice(slash + 1);
    return `pkg:npm/${scope}/${pkg}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

/**
 * @param {object} lock
 * @param {{ omitDev: boolean, rootName: string, rootVersion: string, slug: string }} opts
 */
function lockfileToCycloneDX(lock, opts) {
  const { omitDev, rootName, rootVersion, slug } = opts;
  const packages = lock.packages;
  if (!packages || typeof packages !== 'object') {
    throw new Error('Invalid lockfile: missing packages');
  }

  /** @type {Map<string, object>} */
  const byPurl = new Map();

  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (pkgPath === '') continue;
    if (omitDev && meta.dev === true) continue;
    if (!meta || typeof meta !== 'object') continue;

    const name = meta.name ?? (pkgPath.startsWith('../') ? meta.name : nameFromNodeModulesPath(pkgPath));
    const version = meta.version;
    if (!name || !version || typeof name !== 'string' || typeof version !== 'string') continue;

    const purl = npmPurl(name, version);
    if (byPurl.has(purl)) continue;

    /** @type {Record<string, unknown>} */
    const comp = {
      type: 'library',
      'bom-ref': purl,
      name,
      version,
      purl,
    };

    const lic = normalizeLicenses(meta.license);
    if (lic.length) comp.licenses = lic;

    if (typeof meta.resolved === 'string' && meta.resolved) {
      comp.externalReferences = [
        {
          type: 'distribution',
          url: meta.resolved,
        },
      ];
    }

    byPurl.set(purl, comp);
  }

  const components = [...byPurl.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );

  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: CDX_SPEC_VERSION,
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: 'application',
        'bom-ref': npmPurl(rootName, rootVersion),
        name: rootName,
        version: rootVersion,
        purl: npmPurl(rootName, rootVersion),
        properties: [
          {
            name: 'ode:sbom:slug',
            value: slug,
          },
          {
            name: 'ode:sbom:source',
            value: 'pnpm-lock.yaml',
          },
        ],
      },
    },
    components,
  };

  return bom;
}

/**
 * @param {string} projectDir absolute or relative to repo root
 * @param {string} slug
 * @param {boolean} omitDev
 */
function collectPnpmListNode(node, byPurl) {
  if (!node || typeof node !== 'object') return;
  const n = /** @type {Record<string, unknown>} */ (node);
  const name = typeof n.name === 'string' ? n.name : null;
  const version = typeof n.version === 'string' ? n.version : null;
  if (name && version) {
    const purl = npmPurl(name, version);
    if (!byPurl.has(purl)) {
      byPurl.set(purl, {
        type: 'library',
        'bom-ref': purl,
        name,
        version,
        purl,
      });
    }
  }
  const deps = n.dependencies;
  if (deps && typeof deps === 'object') {
    for (const dep of Object.values(deps)) {
      collectPnpmListNode(dep, byPurl);
    }
  }
}

function generateNpmSbom(projectDir, slug, omitDev) {
  const abs = join(REPO_ROOT, projectDir);
  const pkgJsonPath = join(abs, 'package.json');
  const lockPath = join(abs, 'pnpm-lock.yaml');
  if (!existsSync(pkgJsonPath)) {
    console.warn(`[sbom] skip (no package.json): ${projectDir}`);
    return null;
  }
  if (!existsSync(lockPath)) {
    console.warn(`[sbom] skip pnpm (no pnpm-lock.yaml): ${projectDir}`);
    return null;
  }

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  if (!pkg?.name || !pkg?.version) {
    throw new Error(`Missing name/version in ${pkgJsonPath}`);
  }

  const args = ['list', '--json', '--depth', 'Infinity'];
  if (omitDev) args.push('--prod');
  const out = execFileSync('pnpm', args, {
    cwd: abs,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const trees = JSON.parse(out);
  if (!Array.isArray(trees)) {
    throw new Error(`Unexpected pnpm list output for ${pkg.name}`);
  }

  /** @type {Map<string, object>} */
  const byPurl = new Map();
  for (const tree of trees) {
    collectPnpmListNode(tree, byPurl);
  }

  const components = [...byPurl.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );

  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: CDX_SPEC_VERSION,
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: 'application',
        'bom-ref': npmPurl(pkg.name, pkg.version),
        name: pkg.name,
        version: pkg.version,
        purl: npmPurl(pkg.name, pkg.version),
        properties: [
          { name: 'ode:sbom:slug', value: slug },
          { name: 'ode:sbom:source', value: 'pnpm-lock.yaml' },
        ],
      },
    },
    components,
  };

  return { filename: `${slug}.cdx.json`, json: JSON.stringify(bom, null, 2) };
}

function generateGoSbom(projectDir, slug, outFile) {
  const abs = join(REPO_ROOT, projectDir);
  const mod = join(abs, 'go.mod');
  if (!existsSync(mod)) {
    console.warn(`[sbom] skip go (no go.mod): ${projectDir}`);
    return false;
  }
  console.log(`[sbom] go module: ${projectDir}`);
  execFileSync(
    'go',
    [
      'run',
      GOMOD_CDXML,
      'mod',
      '-json',
      '-licenses',
      '-type',
      'application',
      '-output',
      outFile,
      '.',
    ],
    {
      cwd: abs,
      stdio: 'inherit',
      env: process.env,
    },
  );
  return true;
}

function main() {
  const { outDir, omitDev } = parseArgs(process.argv);
  mkdirSync(outDir, { recursive: true });

  console.log(`[sbom] output directory: ${outDir}`);
  console.log(`[sbom] omit devDependencies: ${omitDev}`);

  for (const { dir, slug } of NPM_PROJECTS) {
    try {
      const result = generateNpmSbom(dir, slug, omitDev);
      if (result) {
        const target = join(outDir, result.filename);
        writeFileSync(target, result.json, 'utf8');
        const parsed = JSON.parse(result.json);
        console.log(`[sbom] npm ${slug}: ${parsed.components?.length ?? 0} components → ${target}`);
      }
    } catch (e) {
      console.error(`[sbom] FAILED npm ${slug}:`, e);
      process.exitCode = 1;
    }
  }

  for (const { dir, slug } of GO_MODULES) {
    try {
      const outFile = join(outDir, `${slug}.cdx.json`);
      generateGoSbom(dir, slug, outFile);
    } catch (e) {
      console.error(`[sbom] FAILED go ${slug}:`, e);
      process.exitCode = 1;
    }
  }

  if (process.exitCode) {
    console.error('[sbom] completed with errors');
  } else {
    console.log('[sbom] done');
  }
}

main();
