export type FRMLS = {
  v: number;
  s: string;
  u: string;
  p: string;
};

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Encode Formulus settings using the FRMLS v1 format used by `synk qr`.
 */
export function encodeFRMLS(settings: FRMLS): string {
  const parts = [
    `v:${encodeBase64(String(settings.v))}`,
    `s:${encodeBase64(settings.s)}`,
    `u:${encodeBase64(settings.u)}`,
    `p:${encodeBase64(settings.p)}`,
  ];
  return `FRMLS:${parts.join(';')};;`;
}

export function encodeFormulusLoginQr(
  serverUrl: string,
  username: string,
  password: string,
): string {
  return encodeFRMLS({
    v: 1,
    s: serverUrl,
    u: username,
    p: password,
  });
}
