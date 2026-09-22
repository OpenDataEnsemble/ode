import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';
import { saveZipToDevice } from '../services/saveZipToDevice';
import { profileActivity } from '../profiles/ProfileActivity';
import { profileCachePath, profilePaths } from '../profiles/ProfilePaths';
import { serverConfigService } from '../services/ServerConfigService';
import { appVersionService } from '../services/AppVersionService';
import {
  getEventsFilePath,
  getExitsFilePath,
  getTracesDirPath,
  readFileIfExists,
  readLastExit,
  readRecentEvents,
} from './DiagnosticLog';
import { formatExitReason } from './classifyExit';
import { buildSummaryText, serverHostnameOnly } from './exportDiagnosticsText';

/** Cap bundled traces defensively; the native side already prunes to a few. */
const MAX_BUNDLED_TRACES = 4;
let exportSequence = 0;

async function copyRecentTraces(destDir: string): Promise<string[]> {
  const sourceDir = getTracesDirPath();
  if (!(await RNFS.exists(sourceDir))) {
    return [];
  }
  try {
    const entries = await RNFS.readDir(sourceDir);
    const files = entries
      .filter(entry => entry.isFile())
      .sort((a, b) => Number(b.mtime ?? 0) - Number(a.mtime ?? 0))
      .slice(0, MAX_BUNDLED_TRACES);
    if (files.length === 0) {
      return [];
    }
    await RNFS.mkdir(`${destDir}/traces`);
    const names: string[] = [];
    for (const file of files) {
      await RNFS.copyFile(file.path, `${destDir}/traces/${file.name}`);
      names.push(file.name);
    }
    return names;
  } catch {
    return [];
  }
}

export {
  DIAGNOSTICS_ZIP_FILES,
  buildSummaryText,
  serverHostnameOnly,
} from './exportDiagnosticsText';

export async function exportDiagnosticsZip(): Promise<void> {
  return profileActivity.run('Export diagnostics', async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + `-${++exportSequence}`;
  const workDir = profileCachePath(`formulus-diagnostics-${stamp}`);
  const zipName = `formulus-diagnostics-${stamp}.zip`;
  const zipPath = profileCachePath(zipName);

  try {
    await RNFS.mkdir(profilePaths.cache());
    await RNFS.mkdir(workDir);
    const events = await readFileIfExists(getEventsFilePath());
    const exits = await readFileIfExists(getExitsFilePath());
    await RNFS.writeFile(`${workDir}/events.ndjson`, events, 'utf8');
    await RNFS.writeFile(`${workDir}/exits.ndjson`, exits, 'utf8');

    // Keep these reads sequential: a failure must not leave trace-copy IO
    // running while the finally block removes its destination directory.
    const traceFiles = await copyRecentTraces(workDir);
    const lastExit = await readLastExit();
    const recent = await readRecentEvents(40);
    const serverUrl = await serverConfigService.getServerUrl();
    const appVersion = await appVersionService.getFullVersion().catch(() => 'unknown');
    const breadcrumbs = recent
      .filter(event => event.kind === 'breadcrumb')
      .slice(0, 20)
      .map(event => `${event.ts} ${event.message}`);

    const summary = buildSummaryText({
      deviceModel: DeviceInfo.getModel(),
      systemName: DeviceInfo.getSystemName(),
      systemVersion: DeviceInfo.getSystemVersion(),
      appVersion,
      serverHost: serverHostnameOnly(serverUrl),
      lastExitReason: lastExit ? formatExitReason(lastExit) : null,
      breadcrumbs,
      traceFiles,
    });
    await RNFS.writeFile(`${workDir}/summary.txt`, summary, 'utf8');

    await zip(workDir, zipPath);
    await saveZipToDevice(zipPath, zipName);
  } finally {
    // Also clean up partial ZIPs when zip/save fails. Source logs remain global
    // and are never removed; only this export's profile-owned staging is deleted.
    await RNFS.unlink(workDir).catch(() => undefined);
    await RNFS.unlink(zipPath).catch(() => undefined);
  }
  });
}
