// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FormLayout from '../components/FormLayout';
import * as keyboardScroll from '../utils/keyboardScroll';

afterEach(() => cleanup());

describe('FormLayout keyboard scroll integration', () => {
  it('does not re-reveal on visualViewport scroll after keyboard session ends', async () => {
    const revealSpy = vi.spyOn(keyboardScroll, 'revealFieldIfNeeded');

    render(
      <FormLayout showNavigation={false}>
        <div style={{ height: 1200 }}>
          <input data-testid="field" type="text" defaultValue="" />
        </div>
      </FormLayout>,
    );

    const input = screen.getByTestId('field');

    fireEvent.focusIn(input, { bubbles: true });
    await new Promise(resolve => setTimeout(resolve, 150));
    revealSpy.mockClear();

    window.visualViewport?.dispatchEvent(new Event('scroll'));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(revealSpy).not.toHaveBeenCalled();
    revealSpy.mockRestore();
  });

  it('does not re-reveal on input or layout resize while focused', async () => {
    const revealSpy = vi.spyOn(keyboardScroll, 'revealFieldIfNeeded');

    render(
      <FormLayout showNavigation={false}>
        <div style={{ height: 1200 }}>
          <input data-testid="field" type="number" defaultValue="" />
        </div>
      </FormLayout>,
    );

    const scrollArea = screen.getByTestId('formplayer-scroll-area');
    const input = screen.getByTestId('field');

    fireEvent.focusIn(input, { bubbles: true });
    await new Promise(resolve => setTimeout(resolve, 250));
    revealSpy.mockClear();

    fireEvent.input(input, { target: { value: '5' }, bubbles: true });
    scrollArea.appendChild(document.createElement('div'));
    window.visualViewport?.dispatchEvent(new Event('resize'));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(revealSpy).not.toHaveBeenCalled();
    revealSpy.mockRestore();
  });

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
