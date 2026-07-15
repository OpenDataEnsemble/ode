import QRCode from 'qrcode';
import qrLogoUrl from '../assets/qr_logo.png';
import { encodeFormulusLoginQr } from './frmls';

const QR_SIZE = 1060;
const QR_MARGIN_MODULES = 2;
const MAX_LOGO_RATIO = 0.2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load QR logo'));
    image.src = src;
  });
}

/**
 * Render an FRMLS login QR in the portal with the same visual treatment as
 * `synk qr`: black square modules, white background, and the round ODE logo
 * centred at no more than one fifth of the QR width.
 */
export async function generateFormulusQrDataUrl(
  serverUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(
    canvas,
    encodeFormulusLoginQr(serverUrl, username, password),
    {
      width: QR_SIZE,
      margin: QR_MARGIN_MODULES,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    },
  );

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create QR image');
  }

  const logo = await loadImage(qrLogoUrl);
  const maxLogoSize = Math.floor(QR_SIZE * MAX_LOGO_RATIO);
  const logoSize = Math.min(logo.naturalWidth, logo.naturalHeight, maxLogoSize);
  const offset = Math.floor((QR_SIZE - logoSize) / 2);
  context.drawImage(logo, offset, offset, logoSize, logoSize);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function sanitizeQrFilename(username: string): string {
  const safe = username.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_|_$/g, '');
  return `formulus-qr-${safe || 'user'}.png`;
}
