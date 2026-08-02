// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { hasClearableValue, useClearOnHide } from './useClearOnHide';

afterEach(() => cleanup());

function Probe(props: {
  visible?: boolean;
  path?: string;
  data?: unknown;
  handleChange?: (path: string, value: unknown) => void;
}) {
  useClearOnHide(props);
  return null;
}

describe('hasClearableValue', () => {
  it('is false for empty sentinels', () => {
    expect(hasClearableValue(undefined)).toBe(false);
    expect(hasClearableValue(null)).toBe(false);
    expect(hasClearableValue('')).toBe(false);
    expect(hasClearableValue([])).toBe(false);
  });

  it('is true for scalars and non-empty arrays', () => {
    expect(hasClearableValue('1')).toBe(true);
    expect(hasClearableValue(0)).toBe(true);
    expect(hasClearableValue(false)).toBe(true);
    expect(hasClearableValue(['x'])).toBe(true);
  });
});

describe('useClearOnHide', () => {
  it('clears once when visible flips to false with a value', async () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <Probe
        visible={true}
        path="child"
        data="1"
        handleChange={handleChange}
      />,
    );
    expect(handleChange).not.toHaveBeenCalled();

    rerender(
      <Probe
        visible={false}
        path="child"
        data="1"
        handleChange={handleChange}
      />,
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('child', undefined);
    });
    expect(handleChange).toHaveBeenCalledTimes(1);

    // Already empty → no further clears
    rerender(
      <Probe
        visible={false}
        path="child"
        data={undefined}
        handleChange={handleChange}
      />,
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  it('does not clear when already empty or when visible stays true', async () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <Probe
        visible={false}
        path="child"
        data={undefined}
        handleChange={handleChange}
      />,
    );
    await waitFor(() => {
      expect(handleChange).not.toHaveBeenCalled();
    });

    rerender(
      <Probe
        visible={true}
        path="child"
        data="1"
        handleChange={handleChange}
      />,
    );
    await waitFor(() => {
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  it('no-ops without path or handleChange', async () => {
    const handleChange = vi.fn();
    render(<Probe visible={false} data="1" handleChange={handleChange} />);
    render(<Probe visible={false} path="child" data="1" />);
    await waitFor(() => {
      expect(handleChange).not.toHaveBeenCalled();
    });
  });
});
