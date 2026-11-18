import {
  basemapProbeUrl,
  buildRasterStyle,
  estimateTileCount,
  OSM_TILE_URL,
  padBounds,
  resolveBasemap,
  resolveBundledStyle,
} from '../basemap';

describe('resolveBasemap', () => {
  it('defaults to OpenStreetMap tiles and blocks area downloads', () => {
    const basemap = resolveBasemap({
      config: undefined,
      bundledFiles: [],
      bundledStyle: null,
    });
    const style = basemap.mapStyle as ReturnType<typeof buildRasterStyle>;
    expect(style.sources.online).toMatchObject({ tiles: [OSM_TILE_URL] });
    expect(basemap.downloadStyle).toBeNull();
    expect(basemap.downloadBlockedReason).toBe('osm-policy');
  });

  it('never allows downloads from OSM even when the config asks', () => {
    const basemap = resolveBasemap({
      config: { tiles: [OSM_TILE_URL], allowOfflineDownload: true },
      bundledFiles: [],
      bundledStyle: null,
    });
    expect(basemap.downloadStyle).toBeNull();
    expect(basemap.downloadBlockedReason).toBe('osm-policy');
  });

  it('allows downloads from a provider that opts in', () => {
    const basemap = resolveBasemap({
      config: {
        tiles: ['https://tiles.example.org/{z}/{x}/{y}.png'],
        allowOfflineDownload: true,
      },
      bundledFiles: [{ name: 'area.mbtiles', path: '/data/maps/area.mbtiles' }],
      bundledStyle: null,
    });
    expect(basemap.downloadBlockedReason).toBeNull();
    // The pack style excludes bundled files: they are already on the device.
    expect(basemap.downloadStyle).not.toContain('mbtiles://');
    expect(basemap.downloadStyle).toContain('tiles.example.org');
  });

  it('uses the fetched or cached style for a configured style URL', () => {
    const remoteStyle = { version: 8 as const, sources: {}, layers: [] };
    const basemap = resolveBasemap({
      config: {
        styleUrl: 'https://tiles.example.org/styles/liberty',
        allowOfflineDownload: true,
      },
      bundledFiles: [],
      bundledStyle: null,
      remoteStyle,
    });
    expect(basemap.mapStyle).toBe(remoteStyle);
    expect(basemap.downloadStyle).toBe(
      'https://tiles.example.org/styles/liberty',
    );
    expect(basemap.offlineMaxZoom).toBe(14);
  });

  it('falls back to the built-in style when a style URL was never reachable', () => {
    const basemap = resolveBasemap({
      config: { styleUrl: 'https://tiles.example.org/styles/liberty' },
      bundledFiles: [],
      bundledStyle: null,
      remoteStyle: null,
    });
    expect(typeof basemap.mapStyle).toBe('object');
    expect(JSON.stringify(basemap.mapStyle)).toContain(OSM_TILE_URL);
  });

  it('probes the first tile of a raster source or the style URL', () => {
    expect(basemapProbeUrl(undefined)).toBe(
      'https://tile.openstreetmap.org/0/0/0.png',
    );
    expect(
      basemapProbeUrl({ tiles: ['https://{s}.t.example/{z}/{x}/{y}.png'] }),
    ).toBe('https://a.t.example/0/0/0.png');
    expect(basemapProbeUrl({ styleUrl: 'https://s.example/style.json' })).toBe(
      'https://s.example/style.json',
    );
  });

  it('prefers a bundled style over everything', () => {
    const bundledStyle = { version: 8 as const, sources: {}, layers: [] };
    const basemap = resolveBasemap({
      config: { styleUrl: 'https://x', allowOfflineDownload: true },
      bundledFiles: [],
      bundledStyle,
    });
    expect(basemap.mapStyle).toBe(bundledStyle);
    expect(basemap.usesBundledStyle).toBe(true);
    expect(basemap.downloadBlockedReason).toBe('bundled');
  });
});

describe('buildRasterStyle', () => {
  it('stacks bundled raster files above the online layer', () => {
    const style = buildRasterStyle(undefined, [
      { name: 'district a.mbtiles', path: '/data/maps/district a.mbtiles' },
      { name: 'b.pmtiles', path: '/data/maps/b.pmtiles' },
    ]);
    expect(style.layers.map(l => l.id)).toEqual([
      'background',
      'online',
      'bundle_district_a_mbtiles',
      'bundle_b_pmtiles',
    ]);
    expect(style.sources.bundle_district_a_mbtiles).toMatchObject({
      url: 'mbtiles:///data/maps/district a.mbtiles',
    });
    expect(style.sources.bundle_b_pmtiles).toMatchObject({
      url: 'pmtiles://file:///data/maps/b.pmtiles',
    });
  });
});

describe('resolveBundledStyle', () => {
  it('substitutes {mapsDir} and requires a v8 style', () => {
    const raw = JSON.stringify({
      version: 8,
      sources: { v: { type: 'vector', url: 'mbtiles://{mapsDir}/r.mbtiles' } },
      layers: [],
    });
    const style = resolveBundledStyle(raw, '/data/app/maps/');
    expect(style?.sources.v).toMatchObject({
      url: 'mbtiles:///data/app/maps/r.mbtiles',
    });
    expect(resolveBundledStyle('{"version":7}', '/x')).toBeNull();
    expect(resolveBundledStyle('nope', '/x')).toBeNull();
  });
});

describe('tile estimates', () => {
  it('counts one tile for the world at zoom 0 and four at zoom 1', () => {
    expect(estimateTileCount([-180, -85, 180, 85], 0, 0)).toBe(1);
    expect(estimateTileCount([-180, -85, 180, 85], 1, 1)).toBe(4);
  });

  it('pads bounds by roughly the given distance', () => {
    const [west, south, east, north] = padBounds([32, 0, 33, 1], 1);
    expect(south).toBeCloseTo(-0.009, 3);
    expect(north).toBeCloseTo(1.009, 3);
    expect(west).toBeLessThan(32);
    expect(east).toBeGreaterThan(33);
  });
});
