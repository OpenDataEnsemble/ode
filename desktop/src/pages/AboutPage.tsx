import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import brandMarkUrl from '../assets/custodian.png';
import packageJson from '../../package.json';

const LINKS = [
  { href: 'https://opendataensemble.org', label: 'Website' },
  { href: 'https://forum.opendataensemble.org', label: 'Forum' },
  { href: 'https://github.com/OpenDataEnsemble', label: 'GitHub' },
  {
    href: 'https://github.com/OpenDataEnsemble/ode/blob/main/LICENSE',
    label: 'License',
  },
] as const;

export function AboutPage() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        if (isTauri()) {
          setVersion(await getVersion());
        } else {
          setVersion(packageJson.version?.trim() ?? '');
        }
      } catch {
        setVersion('');
      }
    };
    void load();
  }, []);

  return (
    <section className="page page-about">
      <img
        src={brandMarkUrl}
        alt="ODE Desktop"
        className="about-logo"
        width={256}
        height={256}
      />
      <h2>ODE Desktop</h2>
      {version ? <p className="about-version">v{version}</p> : null}
      <p>
        Open Data Ensemble is an offline-first ecosystem for field data
        collection, synchronization, and stewardship. ODE Desktop helps you
        manage observations locally and develop app bundles before deploying to
        Formulus in the field.
      </p>
      <div className="page-about-links">
        {LINKS.map(l => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
            {l.label}
          </a>
        ))}
      </div>
      <p>
        This application is free (libre) software provided as-is under a
        permissive open-source license. See the License link above for details.
      </p>
      <p>
        For support and assistance, contact us through the{' '}
        <a
          href="https://forum.opendataensemble.org"
          target="_blank"
          rel="noreferrer">
          forum
        </a>{' '}
        or email{' '}
        <a href="mailto:hello@opendataensemble.org">
          hello@opendataensemble.org
        </a>
        .
      </p>
    </section>
  );
}
