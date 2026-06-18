// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FormLayout from '../components/FormLayout';

afterEach(() => cleanup());

describe('FormLayout keyboard scroll integration', () => {
  it('clamps scrollTop after input without exceeding max scroll', async () => {
    const { container } = render(
      <FormLayout showNavigation={false}>
        <div style={{ height: 1200 }}>
          <input data-testid="field" type="text" defaultValue="" />
        </div>
      </FormLayout>,
    );

    const scrollArea = screen.getByTestId('formplayer-scroll-area');
    Object.defineProperty(scrollArea, 'scrollHeight', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(scrollArea, 'clientHeight', {
      configurable: true,
      value: 400,
    });
    scrollArea.scrollTop = 900;

    const input = screen.getByTestId('field');
    fireEvent.focusIn(input, { bubbles: true });
    fireEvent.input(input, { target: { value: 'x' }, bubbles: true });

    await new Promise(resolve => setTimeout(resolve, 50));

    const max = Math.max(0, scrollArea.scrollHeight - scrollArea.clientHeight);
    expect(scrollArea.scrollTop).toBeLessThanOrEqual(max);
    expect(container).toBeTruthy();
  });
});
