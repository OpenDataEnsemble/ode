// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JsonForms } from '@jsonforms/react';
import Ajv from 'ajv';
import GPSQuestionRenderer, { gpsQuestionTester } from './GPSQuestionRenderer';

const ajv = new Ajv({ strict: false });
ajv.addFormat('gps', () => true);

const objectGpsSchema = {
  type: 'object',
  properties: {
    location: {
      type: 'object',
      format: 'gps',
      title: 'Current Location',
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        accuracy: { type: 'number' },
        timestamp: { type: 'string' },
      },
    },
  },
};

const gpsUischema = {
  type: 'Control',
  scope: '#/properties/location',
};

const renderers = [
  { tester: gpsQuestionTester, renderer: GPSQuestionRenderer },
];

function ObjectGpsForm({ value }: { value: Record<string, unknown> }) {
  return (
    <JsonForms
      schema={objectGpsSchema}
      uischema={gpsUischema}
      data={{ location: value }}
      renderers={renderers}
      ajv={ajv}
    />
  );
}

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

describe('GPS object observation values', () => {
  it('displays an existing object GPS value', () => {
    render(
      <ObjectGpsForm
        value={{
          latitude: 0.347596,
          longitude: 32.58252,
          accuracy: 5,
          timestamp: '2026-10-27T10:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText('Location Captured')).toBeInTheDocument();
    expect(screen.getByText('0.347596° N')).toBeInTheDocument();
    expect(screen.getByText('32.582520° E')).toBeInTheDocument();
  });
});
