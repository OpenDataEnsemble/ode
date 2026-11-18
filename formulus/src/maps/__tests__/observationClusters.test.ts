import {
  CLUSTER_BADGES,
  clusterBadgeExpression,
  clusterBadgeFor,
  colorsByFormType,
  FORM_TYPE_PALETTE,
  toFeatureCollection,
} from '../observationClusters';
import { CLUSTER_BADGE_IMAGES } from '../clusterBadgeImages';

describe('colorsByFormType', () => {
  it('assigns stable colours independent of input order', () => {
    expect(colorsByFormType(['b', 'a', 'b'])).toEqual(
      colorsByFormType(['a', 'b']),
    );
    expect(colorsByFormType(['a']).a).toBe(FORM_TYPE_PALETTE[0]);
  });
});

describe('toFeatureCollection', () => {
  it('builds lon/lat point features with display properties', () => {
    const fc = toFeatureCollection(
      [
        {
          observationId: 'o1',
          formType: 'survey',
          createdAt: new Date(0),
          synced: false,
          latitude: 0.35,
          longitude: 32.58,
          accuracy: null,
        },
      ],
      { survey: '#123456' },
    );
    expect(fc.features[0].geometry.coordinates).toEqual([32.58, 0.35]);
    expect(fc.features[0].properties).toEqual({
      observationId: 'o1',
      formType: 'survey',
      color: '#123456',
      synced: false,
    });
  });
});

describe('cluster badges', () => {
  it('has a bundled image for every badge', () => {
    for (const [, image] of CLUSTER_BADGES) {
      expect(CLUSTER_BADGE_IMAGES[image]).toBeDefined();
    }
  });

  it('picks exact badges below ten and ranges above', () => {
    expect(clusterBadgeFor(2)).toBe('cluster-2');
    expect(clusterBadgeFor(9)).toBe('cluster-9');
    expect(clusterBadgeFor(10)).toBe('cluster-10p');
    expect(clusterBadgeFor(49)).toBe('cluster-20p');
    expect(clusterBadgeFor(1500)).toBe('cluster-1kp');
    expect(clusterBadgeFor(250000)).toBe('cluster-10kp');
  });

  it('builds an ascending step expression matching clusterBadgeFor', () => {
    const expr = clusterBadgeExpression();
    expect(expr.slice(0, 3)).toEqual([
      'step',
      ['get', 'point_count'],
      'cluster-2',
    ]);
    const thresholds = expr.slice(3).filter((_, i) => i % 2 === 0);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => +a - +b));
  });
});
