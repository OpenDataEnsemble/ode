// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
