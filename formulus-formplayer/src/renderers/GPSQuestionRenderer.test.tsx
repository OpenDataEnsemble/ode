// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { gpsQuestionTester } from './GPSQuestionRenderer';

describe('gpsQuestionTester', () => {
  it('matches an object schema with gps format', () => {
    const rootSchema = {
      type: 'object',
      properties: {
        location: {
          type: 'object',
          format: 'gps',
          title: 'Current Location',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
        },
      },
    };

    const uischema = {
      type: 'Control',
      scope: '#/properties/location',
    };

    expect(
      gpsQuestionTester(uischema as any, rootSchema as any, {} as any),
    ).toBe(10);
  });
});
