/**
 * Longest shared directory prefix of two absolute paths, with a trailing slash
 * (at least `/`). Used for the iOS WKWebView read grant that must cover both
 * the bundled Formplayer and the active profile's attachments under Documents.
 */
export function commonAncestor(a: string, b: string): string {
  const left = a.split('/');
  const right = b.split('/');
  const shared: string[] = [];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) break;
    shared.push(left[i]);
  }
  const joined = shared.join('/');
  return joined.length ? `${joined}/` : '/';
}
