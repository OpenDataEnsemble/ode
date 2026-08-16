import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';
import { saveZipToDevice } from '../services/saveZipToDevice';
import { serverConfigService } from '../services/ServerConfigService';
import { appVersionService } from '../services/AppVersionService';
import {
  getEventsFilePath,
  getExitsFilePath,
  readFileIfExists,
  readLastExit,
  readRecentEvents,
} from './DiagnosticLog';
import { formatExitReason } from './classifyExit';
import { buildSummaryText, serverHostnameOnly } from './exportDiagnosticsText';

export {
  DIAGNOSTICS_ZIP_FILES,
  buildSummaryText,
  serverHostnameOnly,
} from './exportDiagnosticsText';

export async function exportDiagnosticsZip(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const workDir = `${RNFS.CachesDirectoryPath}/formulus-diagnostics-${stamp}`;
  const zipName = `formulus-diagnostics-${stamp}.zip`;
  const zipPath = `${RNFS.CachesDirectoryPath}/${zipName}`;

  if (await RNFS.exists(workDir)) {
    await RNFS.unlink(workDir);
  }
  await RNFS.mkdir(workDir);

  try {
    const events = await readFileIfExists(getEventsFilePath());
    const exits = await readFileIfExists(getExitsFilePath());
    await RNFS.writeFile(`${workDir}/events.ndjson`, events, 'utf8');
    await RNFS.writeFile(`${workDir}/exits.ndjson`, exits, 'utf8');

    const [lastExit, recent, serverUrl, appVersion] = await Promise.all([
      readLastExit(),
      readRecentEvents(40),
      serverConfigService.getServerUrl(),
      appVersionService.getFullVersion().catch(() => 'unknown'),
    ]);
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
    });
    await RNFS.writeFile(`${workDir}/summary.txt`, summary, 'utf8');

    if (await RNFS.exists(zipPath)) {
      await RNFS.unlink(zipPath);
    }
    await zip(workDir, zipPath);
  } finally {
    if (await RNFS.exists(workDir)) {
      await RNFS.unlink(workDir).catch(() => {
        /* best-effort */
      });
    }
  }

  await saveZipToDevice(zipPath, zipName);
}
