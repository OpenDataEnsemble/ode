import React, {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

import styles from './styles.module.css';

const RELEASE_API_URL = 'https://api.github.com/repos/OpenDataEnsemble/ode/releases/latest';
const RELEASES_URL = 'https://github.com/OpenDataEnsemble/ode/releases';
const F_DROID_URL = 'https://f-droid.org/en/packages/org.opendataensemble.formulus/';
const OBTAINIUM_URL = 'https://github.com/ImranR98/Obtainium';
const APP_STORE_URL = 'https://apps.apple.com/dk/app/formulus/id6798318215';

type Platform = 'macOS' | 'Windows' | 'Linux' | null;
type Architecture = 'arm64' | 'amd64';

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type Release = {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
};

type PlatformDownload = {
  label: string;
  platform: Platform;
  architecture: Architecture;
  asset?: ReleaseAsset;
  note: string;
};

function detectPlatform(): {platform: Platform; architecture: Architecture} {
  if (typeof navigator === 'undefined') {
    return {platform: null, architecture: 'amd64'};
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  const architecture: Architecture =
    /arm64|aarch64|arm/.test(userAgent) || /arm64|aarch64|arm/.test(platform)
      ? 'arm64'
      : 'amd64';

  if (/macintosh|mac os x/.test(userAgent)) {
    return {platform: 'macOS', architecture};
  }
  if (/windows/.test(userAgent)) {
    return {platform: 'Windows', architecture};
  }
  if (/linux/.test(userAgent)) {
    return {platform: 'Linux', architecture};
  }
  return {platform: null, architecture};
}

function findAsset(
  assets: ReleaseAsset[],
  required: string[],
  extensions: string[],
): ReleaseAsset | undefined {
  return assets.find(asset => {
    const name = asset.name.toLowerCase();
    return (
      required.every(part => name.includes(part)) &&
      extensions.some(extension => name.endsWith(extension))
    );
  });
}

function DownloadLink({asset, children}: {asset?: ReleaseAsset; children: string}) {
  return asset ? (
    <a className="button button--primary" href={asset.browser_download_url}>
      {children}
    </a>
  ) : (
    <a className="button button--secondary" href={RELEASES_URL}>
      View release assets
    </a>
  );
}

function DownloadTable({downloads}: {downloads: PlatformDownload[]}) {
  return (
    <div className={styles.downloadTable}>
      {downloads.map(download => (
        <div className={styles.downloadRow} key={download.label}>
          <div>
            <strong>{download.label}</strong>
            <span>{download.note}</span>
          </div>
          <DownloadLink asset={download.asset}>Download</DownloadLink>
        </div>
      ))}
    </div>
  );
}

export default function Downloads(): React.ReactElement {
  const [release, setRelease] = useState<Release | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [detected, setDetected] = useState<{platform: Platform; architecture: Architecture}>(
    {platform: null, architecture: 'amd64'},
  );

  useEffect(() => {
    setDetected(detectPlatform());
    void fetch(RELEASE_API_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`GitHub responded with ${response.status}`);
        }
        return response.json() as Promise<Release>;
      })
      .then(setRelease)
      .catch(() => setLoadFailed(true));
  }, []);

  const assets = release?.assets ?? [];
  const desktopDownloads: PlatformDownload[] = [
    {
      label: 'macOS — Apple silicon',
      platform: 'macOS',
      architecture: 'arm64',
      asset: findAsset(assets, ['ode-desktop-darwin-arm64'], ['.dmg', '.zip']),
      note: 'M-series Mac',
    },
    {
      label: 'macOS — Intel',
      platform: 'macOS',
      architecture: 'amd64',
      asset: findAsset(assets, ['ode-desktop-darwin-amd64'], ['.dmg', '.zip']),
      note: 'Intel Mac',
    },
    {
      label: 'Windows — ARM64',
      platform: 'Windows',
      architecture: 'arm64',
      asset: findAsset(assets, ['ode-desktop-windows-arm64'], ['.msi', '.exe']),
      note: 'Windows on ARM',
    },
    {
      label: 'Windows — x64',
      platform: 'Windows',
      architecture: 'amd64',
      asset: findAsset(assets, ['ode-desktop-windows-amd64'], ['.msi', '.exe']),
      note: 'Most Windows PCs',
    },
    {
      label: 'Linux — ARM64',
      platform: 'Linux',
      architecture: 'arm64',
      asset: findAsset(assets, ['ode-desktop-linux-arm64'], ['.appimage', '.deb', '.rpm']),
      note: 'AppImage when available',
    },
    {
      label: 'Linux — x64',
      platform: 'Linux',
      architecture: 'amd64',
      asset: findAsset(assets, ['ode-desktop-linux-amd64'], ['.appimage', '.deb', '.rpm']),
      note: 'AppImage when available',
    },
  ];
  const cliDownloads: PlatformDownload[] = [
    {
      label: 'macOS — Apple silicon',
      platform: 'macOS',
      architecture: 'arm64',
      asset: findAsset(assets, ['synkronus-cli-darwin-arm64'], ['']),
      note: 'M-series Mac binary',
    },
    {
      label: 'macOS — Intel',
      platform: 'macOS',
      architecture: 'amd64',
      asset: findAsset(assets, ['synkronus-cli-darwin-amd64'], ['']),
      note: 'Intel Mac binary',
    },
    {
      label: 'Windows — ARM64',
      platform: 'Windows',
      architecture: 'arm64',
      asset: findAsset(assets, ['synkronus-cli-windows-arm64'], ['.exe']),
      note: 'Windows on ARM binary',
    },
    {
      label: 'Windows — x64',
      platform: 'Windows',
      architecture: 'amd64',
      asset: findAsset(assets, ['synkronus-cli-windows-amd64'], ['.exe']),
      note: 'Most Windows PCs',
    },
    {
      label: 'Linux — ARM64',
      platform: 'Linux',
      architecture: 'arm64',
      asset: findAsset(assets, ['synkronus-cli-linux-arm64'], ['']),
      note: 'ARM64 binary',
    },
    {
      label: 'Linux — x64',
      platform: 'Linux',
      architecture: 'amd64',
      asset: findAsset(assets, ['synkronus-cli-linux-amd64'], ['']),
      note: 'Most Linux PCs and servers',
    },
  ];
  const recommendedDesktop = desktopDownloads.find(
    download =>
      download.platform === detected.platform &&
      download.architecture === detected.architecture,
  );
  const recommendedCli = cliDownloads.find(
    download =>
      download.platform === detected.platform &&
      download.architecture === detected.architecture,
  );
  const formulusApk =
    findAsset(assets, ['formulus-', '-universal-'], ['.apk']) ??
    findAsset(assets, ['formulus-', 'arm64-v8a'], ['.apk']) ??
    findAsset(assets, ['formulus-'], ['.apk']);

  return (
    <Layout title="Downloads" description="Download ODE Desktop, Synkronus CLI, and Formulus.">
      <main className={styles.page}>
        <div className="container">
          <header className={styles.header}>
            <p className={styles.eyebrow}>Open Data Ensemble</p>
            <h1>Downloads</h1>
            <p>
              Get the latest stable ODE applications. Download links below are loaded from the
              latest GitHub release and are matched to your device when possible.
            </p>
            {release ? (
              <p className={styles.release}>Latest stable release: <a href={release.html_url}>{release.tag_name}</a></p>
            ) : loadFailed ? (
              <p className={styles.release}>Could not load the latest release automatically. Browse the <a href={RELEASES_URL}>GitHub releases</a>.</p>
            ) : (
              <p className={styles.release}>Loading the latest stable release…</p>
            )}
          </header>

          <section className={styles.product}>
            <div>
              <h2>Formulus</h2>
              <p>Mobile data collection for Android and iPhone/iPad.</p>
            </div>
            <div className={styles.mobileOptions}>
              <article>
                <h3>Android</h3>
                <p><a href={F_DROID_URL}>F-Droid</a> is the recommended store for open-source Android apps.</p>
                <a className="button button--primary" href={F_DROID_URL}>Get Formulus on F-Droid</a>
                <p>Alternatively, use <a href={OBTAINIUM_URL}>Obtainium</a> with <code>https://github.com/OpenDataEnsemble/ode</code> for GitHub-release updates.</p>
                <DownloadLink asset={formulusApk}>Download APK directly</DownloadLink>
              </article>
              <article>
                <h3>iPhone and iPad</h3>
                <p>Install Formulus from Apple’s App Store.</p>
                <a className="button button--primary" href={APP_STORE_URL}>Get Formulus on the App Store</a>
              </article>
            </div>
          </section>

          <section className={styles.product}>
            <div>
              <h2>ODE Desktop</h2>
              <p>Manage observations, synchronize data, and work with forms and custom app bundles.</p>
              {recommendedDesktop ? (
                <p className={styles.recommended}>Recommended for your device: <strong>{recommendedDesktop.label}</strong></p>
              ) : null}
            </div>
            {recommendedDesktop ? <DownloadLink asset={recommendedDesktop.asset}>Download ODE Desktop</DownloadLink> : null}
            <DownloadTable downloads={desktopDownloads} />
          </section>

          <section className={styles.product}>
            <div>
              <h2>Synkronus CLI</h2>
              <p>The <code>synk</code> command-line client for login, synchronization, bundles, and exports.</p>
              {recommendedCli ? (
                <p className={styles.recommended}>Recommended for your device: <strong>{recommendedCli.label}</strong></p>
              ) : null}
            </div>
            {recommendedCli ? <DownloadLink asset={recommendedCli.asset}>Download Synkronus CLI</DownloadLink> : null}
            <DownloadTable downloads={cliDownloads} />
            <p className={styles.hint}>After downloading a macOS or Linux binary, make it executable with <code>chmod +x &lt;filename&gt;</code>. See the <Link to="/docs/reference/synkronus-cli">CLI reference</Link> for setup and usage.</p>
          </section>
        </div>
      </main>
    </Layout>
  );
}
