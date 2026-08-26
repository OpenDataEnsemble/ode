import { convertFileSrc } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { bundleFormsRel, bundleSegment } from './bundleLayout';
import type { ExtensionMetadata, FormInitData } from './formplayerHost';
import { tauriClient } from './tauriClient';

export type ExtensionFunctionShape = {
  name: string;
  module: string;
  export: string;
};

export type ExtensionRendererShape = {
  name: string;
  format: string;
  module: string;
  tester?: string;
  renderer: string;
};

export type CustomQuestionTypesManifest = {
  custom_types?: Record<string, { source: string }>;
  validators?: Record<string, { source: string }>;
};

function normalizeJson(raw: Record<string, unknown>): {
  definitions: Record<string, unknown>;
  functions: Record<string, ExtensionFunctionShape>;
  renderers: Record<string, ExtensionRendererShape>;
} {
  const definitions =
    (raw.definitions as Record<string, unknown> | undefined) ??
    (raw.schemas as { definitions?: Record<string, unknown> } | undefined)
      ?.definitions ??
    {};
  const functionsRaw = raw.functions as
    Record<string, Record<string, unknown>> | undefined;
  const functions: Record<string, ExtensionFunctionShape> = {};
  if (functionsRaw) {
    for (const [key, func] of Object.entries(functionsRaw)) {
      functions[key] = {
        name: key,
        module: String(func.path ?? func.module ?? ''),
        export: String(func.export ?? key),
      };
    }
  }
  const renderersRaw = raw.renderers as
    Record<string, Record<string, unknown>> | undefined;
  const renderers: Record<string, ExtensionRendererShape> = {};
  if (renderersRaw) {
    for (const [key, renderer] of Object.entries(renderersRaw)) {
      const rendererObj = (renderer.renderer ?? renderer) as Record<
        string,
        unknown
      >;
      const testerObj = (renderer.tester ?? {}) as Record<string, unknown>;
      const rendererTester = renderer.tester as
        Record<string, unknown> | undefined;
      renderers[key] = {
        name: key,
        format: String(renderer.format ?? rendererObj?.format ?? ''),
        module: String(
          rendererObj?.path ?? rendererObj?.module ?? renderer.module ?? '',
        ),
        tester: (testerObj.export ?? rendererTester?.export) as
          string | undefined,
        renderer: String(rendererObj.export ?? rendererTester?.export ?? key),
      };
    }
  }
  return { definitions, functions, renderers };
}

function mergeLayer(
  a: {
    definitions: Record<string, unknown>;
    functions: Record<string, ExtensionFunctionShape>;
    renderers: Record<string, ExtensionRendererShape>;
  },
  b: {
    definitions: Record<string, unknown>;
    functions: Record<string, ExtensionFunctionShape>;
    renderers: Record<string, ExtensionRendererShape>;
  },
) {
  return {
    definitions: { ...a.definitions, ...b.definitions },
    functions: { ...a.functions, ...b.functions },
    renderers: { ...a.renderers, ...b.renderers },
  };
}

export function formplayerExtensionsFromMerged(
  merged: ReturnType<typeof normalizeJson>,
  basePath: string,
): ExtensionMetadata {
  const functions: NonNullable<ExtensionMetadata['functions']> = {};
  for (const [key, func] of Object.entries(merged.functions)) {
    const modulePath = (func.module || '').replace(/^\/+/, '');
    functions[key] = {
      name: func.name,
      module: modulePath,
      export: func.export,
    };
  }
  const renderers: NonNullable<ExtensionMetadata['renderers']> = {};
  for (const [key, r] of Object.entries(merged.renderers)) {
    const modulePath = (r.module || '').replace(/^\/+/, '');
    renderers[key] = {
      name: r.name,
      format: r.format,
      module: modulePath,
      tester: r.tester,
      renderer: r.renderer,
    };
  }
  return {
    definitions: merged.definitions,
    functions,
    renderers,
    basePath,
  };
}

const emptyNorm = (): ReturnType<typeof normalizeJson> => ({
  definitions: {},
  functions: {},
  renderers: {},
});

/**
 * Loads merged `ext.json` (app-level + form-level) and custom question types / validators
 * from the same layout as Formulus `FormplayerModal` (see `ExtensionService` + CQT scan).
 */
export async function loadBundleFormplayerExtensions(
  formType: string,
  developerMode = false,
): Promise<{
  extensions: FormInitData['extensions'];
  customQuestionTypes: FormInitData['customQuestionTypes'];
}> {
  const formsRoot = bundleFormsRel(developerMode);
  let appJson: Record<string, unknown> | null = null;
  let formJson: Record<string, unknown> | null = null;
  try {
    const t = await tauriClient.readWorkspaceTextFile(`${formsRoot}/ext.json`);
    appJson = JSON.parse(t) as Record<string, unknown>;
  } catch {
    // optional file
  }
  try {
    const t = await tauriClient.readWorkspaceTextFile(
      `${formsRoot}/${formType}/ext.json`,
    );
    formJson = JSON.parse(t) as Record<string, unknown>;
  } catch {
    // optional file
  }

  const appNorm = appJson ? normalizeJson(appJson) : emptyNorm();
  const formNorm = formJson ? normalizeJson(formJson) : emptyNorm();
  const merged = mergeLayer(mergeLayer(emptyNorm(), appNorm), formNorm);

  const hasExtensionContent =
    Object.keys(merged.definitions).length > 0 ||
    Object.keys(merged.functions).length > 0 ||
    Object.keys(merged.renderers).length > 0;

  let extensions: FormInitData['extensions'];
  if (hasExtensionContent) {
    const basePath = await tauriClient.getActiveBundleFormsFileBaseUrl();
    extensions = formplayerExtensionsFromMerged(merged, basePath);

    const ws = await tauriClient.getWorkspace();
    if (ws && extensions?.functions) {
      const segment = bundleSegment(developerMode);
      const gbmisAbs = await join(
        ws,
        'bundles',
        segment,
        'app',
        'extensions',
        'gbmis.js',
      );
      const gbmisUrl = convertFileSrc(gbmisAbs);
      for (const fn of Object.values(extensions.functions)) {
        const meta = fn as Record<string, unknown>;
        const modulePath = String(meta.module ?? '');
        if (modulePath.includes('gbmis.js')) {
          meta.module = gbmisUrl;
        }
      }
    }
  } else {
    extensions = undefined;
  }

  const cqtRaw = await tauriClient.scanBundleCustomQuestionTypes();
  const customQuestionTypes =
    cqtRaw &&
    typeof cqtRaw === 'object' &&
    !Array.isArray(cqtRaw) &&
    Object.keys(cqtRaw).length > 0
      ? (cqtRaw as CustomQuestionTypesManifest)
      : undefined;

  return { extensions, customQuestionTypes };
}
