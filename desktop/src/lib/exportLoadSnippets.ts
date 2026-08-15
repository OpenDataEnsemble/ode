/** Build analyst load snippets from exported Parquet paths (form type → absolute path). */

export type ExportSnippetLang = 'r' | 'python' | 'stata' | 'julia';

export const EXPORT_SNIPPET_LANGS: {
  id: ExportSnippetLang;
  label: string;
}[] = [
  { id: 'r', label: 'R' },
  { id: 'python', label: 'Python' },
  { id: 'stata', label: 'Stata' },
  { id: 'julia', label: 'Julia' },
];

/** Shown in snippets before an export has concrete file paths. */
export const PARQUET_PATH_PLACEHOLDER = '[INSERT PATH TO PARQUET FILE]';

/** Identifier safe across R / Python / Julia / Stata frame names. */
export function sanitizeExportIdentifier(name: string): string {
  let out = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  out = out.replace(/^_+|_+$/g, '');
  if (!out) {
    return 'form';
  }
  if (/^[0-9]/.test(out)) {
    return `f_${out}`;
  }
  return out;
}

function namedEntries(
  parquetFiles: Record<string, string>,
): { ident: string; path: string; formType: string }[] {
  const used = new Map<string, number>();
  const entries = Object.entries(parquetFiles).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return entries.map(([formType, path]) => {
    const base = sanitizeExportIdentifier(formType);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const ident = n === 1 ? base : `${base}_${n}`;
    return { ident, path, formType };
  });
}

/** Resolve form type → path map for snippets (real paths or placeholders). */
export function resolveSnippetParquetFiles(
  parquetFiles: Record<string, string> | null | undefined,
  formTypes?: string[] | null,
): Record<string, string> {
  if (parquetFiles && Object.keys(parquetFiles).length > 0) {
    return parquetFiles;
  }
  const types = (formTypes ?? []).map(t => t.trim()).filter(Boolean);
  if (types.length === 0) {
    return { form_type: PARQUET_PATH_PLACEHOLDER };
  }
  const out: Record<string, string> = {};
  for (const ft of types) {
    out[ft] = PARQUET_PATH_PLACEHOLDER;
  }
  return out;
}

function escapeR(path: string): string {
  return path.replace(/\\/g, '/').replace(/"/g, '\\"');
}

function escapePy(path: string): string {
  return path.replace(/"/g, '');
}

function escapeJulia(path: string): string {
  return path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeStata(path: string): string {
  // Stata accepts forward slashes on all platforms.
  return path.replace(/\\/g, '/');
}

function quoteStataPath(path: string): string {
  const p = escapeStata(path);
  // Always quote placeholders and paths with spaces.
  if (p === PARQUET_PATH_PLACEHOLDER || /\s/.test(p)) {
    return `"${p}"`;
  }
  return p;
}

export function buildExportLoadSnippet(
  lang: ExportSnippetLang,
  parquetFiles: Record<string, string>,
): string {
  const named = namedEntries(parquetFiles);
  if (named.length === 0) {
    return '# No Parquet files in this export.\n';
  }

  switch (lang) {
    case 'r': {
      const lines = [
        '# ODE Desktop export — load Parquet with arrow',
        'library(arrow)',
        '',
        ...named.map(
          ({ ident, path }) => `${ident} <- read_parquet("${escapeR(path)}")`,
        ),
        '',
      ];
      return lines.join('\n');
    }
    case 'python': {
      const lines = [
        '# ODE Desktop export — load Parquet with pandas',
        'import pandas as pd',
        '',
        ...named.map(
          ({ ident, path }) =>
            `${ident} = pd.read_parquet(r"${escapePy(path)}")`,
        ),
        '',
      ];
      return lines.join('\n');
    }
    case 'stata': {
      const lines = [
        '* ODE Desktop export — Stata 19+ import parquet (one frame per form type)',
        '',
        ...named.flatMap(({ ident, path }) => {
          const quoted = quoteStataPath(path);
          return [
            `capture frame drop ${ident}`,
            `frame create ${ident}`,
            `frame ${ident}: import parquet using ${quoted}, clear`,
            '',
          ];
        }),
      ];
      return lines.join('\n');
    }
    case 'julia': {
      const lines = [
        '# ODE Desktop export — load Parquet with Parquet2 + DataFrames',
        'using Parquet2, DataFrames',
        '',
        ...named.map(
          ({ ident, path }) =>
            `${ident} = DataFrame(Parquet2.Dataset("${escapeJulia(path)}"))`,
        ),
        '',
      ];
      return lines.join('\n');
    }
  }
}
