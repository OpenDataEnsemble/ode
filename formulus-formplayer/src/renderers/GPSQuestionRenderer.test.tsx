// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { JsonForms } from '@jsonforms/react';
import Ajv from 'ajv';
import GPSQuestionRenderer, { gpsQuestionTester } from './GPSQuestionRenderer';
import FormulusClient from '../services/FormulusInterface';

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

describe('GPS capture storage', () => {
  it('stores captured GPS data as an object for an object schema', async () => {
    vi.spyOn(FormulusClient.getInstance(), 'requestLocation').mockResolvedValue(
      {
        status: 'success',
        data: {
          type: 'location',
          latitude: 0.347596,
          longitude: 32.58252,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          timestamp: '2026-10-27T10:00:00.000Z',
        },
      },
    );

    const onChange = vi.fn();

    render(
      <JsonForms
        schema={objectGpsSchema}
        uischema={gpsUischema}
        data={{}}
        renderers={renderers}
        ajv={ajv}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Capture GPS location' }),
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const latest = onChange.mock.calls.at(-1)?.[0]?.data;

      expect(latest?.location).toEqual({
        latitude: 0.347596,
        longitude: 32.58252,
        accuracy: 5,
        altitude: undefined,
        altitudeAccuracy: undefined,
        timestamp: '2026-10-27T10:00:00.000Z',
      });
    });
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
