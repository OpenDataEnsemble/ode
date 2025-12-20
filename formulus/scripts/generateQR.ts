#!/usr/bin/env ts-node

import {Buffer} from 'buffer';

// Polyfill Buffer for Node.js environment
if (typeof global !== 'undefined' && !global.Buffer) {
  global.Buffer = Buffer;
}

type FRMLS = {
  v: number;
  s: string; // server URL
  u: string; // username
  p: string; // password
};

const b64e = (s: string) => Buffer.from(s, 'utf8').toString('base64');

function encodeFRMLS(x: FRMLS): string {
  const parts = [
    `v:${b64e(String(x.v))}`,
    `s:${b64e(x.s)}`,
    `u:${b64e(x.u)}`,
    `p:${b64e(x.p)}`,
  ];
  return `FRMLS:${parts.join(';')};;`;
}

function parseArgs(): FRMLS {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (key && value) {
      params[key] = value;
    }
  }

  if (!params.url || !params.user || !params.pass) {
    console.error(
      'Usage: npm run generate_qr url=<server_url> user=<username> pass=<password>',
    );
    console.error(
      'Example: npm run generate_qr url=http://localhost:3000/synk user=admin pass=admin',
    );
    process.exit(1);
  }

  return {
    v: 1, // version
    s: params.url,
    u: params.user,
    p: params.pass,
  };
}

function main() {
  try {
    const frmls = parseArgs();
    const encoded = encodeFRMLS(frmls);
    console.log(encoded);
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
