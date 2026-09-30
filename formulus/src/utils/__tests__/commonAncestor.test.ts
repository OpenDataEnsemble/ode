import { commonAncestor } from '../commonAncestor';

describe('commonAncestor', () => {
  it('returns the shared container of an iOS app bundle and its Documents directory', () => {
    expect(
      commonAncestor(
        '/var/containers/Bundle/Application/ABC/Formulus.app',
        '/var/mobile/Containers/Data/Application/DEF/Documents',
      ),
    ).toBe('/var/');
  });

  it('returns the deepest shared directory with a trailing slash', () => {
    expect(commonAncestor('/a/b/c/index.html', '/a/b/d/photo.jpg')).toBe(
      '/a/b/',
    );
  });

  it('falls back to the filesystem root when nothing is shared', () => {
    expect(commonAncestor('/x/y', '/z')).toBe('/');
  });
});
