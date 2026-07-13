import { useDeferredValue, useEffect, useState } from 'react';
import { Button, Input } from '@ode/components/react-web';
import {
  HiArrowDownTray,
  HiCheck,
  HiClipboard,
  HiEye,
  HiEyeSlash,
} from 'react-icons/hi2';
import {
  downloadDataUrl,
  generateFormulusQrDataUrl,
  sanitizeQrFilename,
} from '../utils/formulusQr';
import './FormulusOnboardingModal.css';

export type FormulusOnboardingCredentials = {
  username: string;
  password: string;
  serverUrl: string;
};

type FormulusOnboardingModalProps = {
  credentials: FormulusOnboardingCredentials;
  onClose: () => void;
};

type CopyField = 'username' | 'password';

export function FormulusOnboardingModal({
  credentials,
  onClose,
}: FormulusOnboardingModalProps) {
  const [serverUrl, setServerUrl] = useState(credentials.serverUrl);
  const deferredServerUrl = useDeferredValue(serverUrl.trim());
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<CopyField | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!deferredServerUrl) {
        setQrDataUrl(null);
        setQrError('Enter a server URL');
        setGenerating(false);
        return;
      }

      setGenerating(true);
      setQrError(null);
      try {
        const url = await generateFormulusQrDataUrl(
          deferredServerUrl,
          credentials.username,
          credentials.password,
        );
        if (!cancelled) setQrDataUrl(url);
      } catch (err) {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError(
            err instanceof Error ? err.message : 'Failed to generate QR code',
          );
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [deferredServerUrl, credentials.username, credentials.password]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    downloadDataUrl(qrDataUrl, sanitizeQrFilename(credentials.username));
  };

  const copyText = async (field: CopyField, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Clipboard may be denied; reveal password for manual copy if needed.
      if (field === 'password') setShowPassword(true);
    }
  };

  const passwordDisplay = showPassword
    ? credentials.password
    : '•'.repeat(Math.min(18, Math.max(12, credentials.password.length)));

  return (
    <div className="modal-overlay formulus-onboarding-overlay">
      <div
        className="modal-content modal-formulus-onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formulus-onboarding-title"
        onClick={e => e.stopPropagation()}>
        <div className="formulus-onboarding-header">
          <div>
            <h2 id="formulus-onboarding-title">Share with Formulus</h2>
            <p className="formulus-onboarding-subtitle">
              Scan this QR in Formulus Settings. It is shown once and cannot be
              recovered later.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close">
            ×
          </button>
        </div>

        <div className="formulus-onboarding-layout">
          <div className="formulus-qr-column">
            <div
              className={`formulus-qr-frame${generating ? ' is-loading' : ''}`}>
              {generating && (
                <div className="formulus-qr-status" aria-live="polite">
                  Generating…
                </div>
              )}
              {!generating && qrError && (
                <div
                  className="formulus-qr-status formulus-qr-error"
                  role="alert">
                  {qrError}
                </div>
              )}
              {!generating && qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`Formulus QR for ${credentials.username}`}
                  className="formulus-qr-image"
                />
              )}
            </div>
            <Button
              variant="secondary"
              onPress={handleDownload}
              disabled={!qrDataUrl || generating}
              className="formulus-download-btn">
              <HiArrowDownTray /> Download PNG
            </Button>
          </div>

          <div className="formulus-details-column">
            <div className="formulus-field">
              <div className="formulus-field-top">
                <span className="formulus-field-label">Username</span>
                <button
                  type="button"
                  className="formulus-icon-btn"
                  onClick={() => copyText('username', credentials.username)}
                  aria-label="Copy username">
                  {copiedField === 'username' ? <HiCheck /> : <HiClipboard />}
                </button>
              </div>
              <div className="formulus-field-value">{credentials.username}</div>
            </div>

            <div className="formulus-field">
              <div className="formulus-field-top">
                <span className="formulus-field-label">Password</span>
                <div className="formulus-field-actions">
                  <button
                    type="button"
                    className="formulus-icon-btn"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }>
                    {showPassword ? <HiEyeSlash /> : <HiEye />}
                  </button>
                  <button
                    type="button"
                    className="formulus-icon-btn"
                    onClick={() => copyText('password', credentials.password)}
                    aria-label="Copy password">
                    {copiedField === 'password' ? <HiCheck /> : <HiClipboard />}
                  </button>
                </div>
              </div>
              <div
                className={`formulus-field-value formulus-password-value${showPassword ? '' : ' is-masked'}`}>
                {passwordDisplay}
              </div>
            </div>

            <div className="formulus-server-field">
              <Input
                label="Server URL"
                type="text"
                value={serverUrl}
                onChangeText={setServerUrl}
                className="modal-input"
              />
              <p className="formulus-server-hint">
                Must be reachable from the device that scans the QR.
              </p>
            </div>

            <div className="formulus-onboarding-footer">
              <Button variant="primary" onPress={onClose}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
