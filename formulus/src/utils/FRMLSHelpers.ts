import {Buffer} from 'buffer';

export type FRMLS = {
  v: number;
  s: string; // server URL
  u: string; // username
  p: string; // password
};

const b64e = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const b64d = (s: string) => Buffer.from(s, 'base64').toString('utf8');

export function encodeFRMLS(x: FRMLS): string {
  const parts = [
    `v:${b64e(String(x.v))}`,
    `s:${b64e(x.s)}`,
    `u:${b64e(x.u)}`,
    `p:${b64e(x.p)}`,
  ];
  return `FRMLS:${parts.join(';')};;`;
}

export function decodeFRMLS(raw: string): FRMLS {
  if (!raw.startsWith('FRMLS:')) throw new Error('Not FRMLS format');
  const body = raw.slice(6).replace(/;;\s*$/, '');
  const kv: Record<string, string> = {};
  for (const seg of body.split(';')) {
    if (!seg) continue;
    const i = seg.indexOf(':');
    if (i < 0) continue;
    kv[seg.slice(0, i)] = seg.slice(i + 1);
  }

  if (!kv.v || !kv.s || !kv.u || !kv.p) {
    throw new Error('Missing required FRMLS fields');
  }

  return {
    v: Number(b64d(kv.v)),
    s: b64d(kv.s),
    u: b64d(kv.u),
    p: b64d(kv.p),
  };
}
