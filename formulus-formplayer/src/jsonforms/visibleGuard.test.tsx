// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { isControlHidden, withVisibleGuard } from './visibleGuard';

describe('visibleGuard', () => {
  it('isControlHidden is true only when visible is false', () => {
    expect(isControlHidden(false)).toBe(true);
    expect(isControlHidden(undefined)).toBe(false);
    expect(isControlHidden(true)).toBe(false);
  });

  it('withVisibleGuard hides wrapped component when visible is false', () => {
    const Inner = ({ label }: { label: string; visible?: boolean }) => (
      <span>{label}</span>
    );
    const Guarded = withVisibleGuard(Inner);
    const { rerender } = render(<Guarded label="shown" visible={true} />);
    expect(screen.getByText('shown')).toBeTruthy();
    rerender(<Guarded label="shown" visible={false} />);
    expect(screen.queryByText('shown')).toBeNull();
  });

  it('withVisibleGuard clears control data when visible becomes false', async () => {
    const handleChange = vi.fn();
    const Inner = ({ label }: { label: string; visible?: boolean }) => (
      <span>{label}</span>
    );
    const Guarded = withVisibleGuard(Inner);
    const { rerender } = render(
      <Guarded
        label="field"
        visible={true}
        path="fez"
        data="1"
        handleChange={handleChange}
      />,
    );
    expect(handleChange).not.toHaveBeenCalled();
    rerender(
      <Guarded
        label="field"
        visible={false}
        path="fez"
        data="1"
        handleChange={handleChange}
      />,
    );
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('fez', undefined);
    });
  });
});
