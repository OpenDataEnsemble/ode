import type { WorkspaceItem } from '../types/domain';
import { tauriClient } from './tauriClient';
import {
  rewriteAppRootBundledFile,
  rewriteVendorChunkFile,
} from './rewriteEmbeddedBundleHtml';

async function collectWorkspaceFilesRecursive(
  dirRel: string,
): Promise<string[]> {
  let items: WorkspaceItem[];
  try {
    items = await tauriClient.listWorkspaceItems(dirRel);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of items) {
    const rel = `${dirRel}/${e.name}`;
    if (e.isDir) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) {
        continue;
      }
      out.push(...(await collectWorkspaceFilesRecursive(rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function rewriteByPath(relativePath: string, content: string): string {
  if (relativePath.includes('/app/assets/')) {
    return rewriteVendorChunkFile(content);
  }
  if (
    /\.(js|css)$/i.test(relativePath) &&
    relativePath.includes('/app/') &&
    !relativePath.includes('/app/assets/')
  ) {
    return rewriteAppRootBundledFile(content);
  }
  return content;
}

/**
 * Idempotently fixes Vite `base: '/'` root-absolute paths in the extracted custom app
 * (`bundles/active/app/**`). Safe to call on every iframe load: already-patched files
 * no longer contain `/assets/` at the start of string literals, so content is unchanged.
 */
export async function patchWorkspaceAppBundleAbsolutePaths(): Promise<void> {
  const files = await collectWorkspaceFilesRecursive('bundles/active/app');
  const targets = files.filter(
    f =>
      /\.(js|css)$/i.test(f) &&
      !f.includes('/node_modules/') &&
      !/\/index\.html$/i.test(f),
  );
  const enc = new TextEncoder();
  for (const rel of targets) {
    let content: string;
    try {
      content = await tauriClient.readWorkspaceTextFile(rel);
    } catch {
      continue;
    }
    const next = rewriteByPath(rel, content);
    if (next === content) {
      continue;
    }
    await tauriClient.writeWorkspaceFile(rel, enc.encode(next));
  }
}
