import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNavigationGrid } from './navigationGrid';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('navigation grid', () => {
  it('stays visible while navigating and disappears after inactivity', () => {
    const render = vi.fn();
    const grid = createNavigationGrid(render);
    for (let i = 0; i < 5; i++) {
      grid.show();
      vi.advanceTimersByTime(500);
      expect(render.mock.lastCall?.[0].enabled).toBe(true);
    }
    vi.advanceTimersByTime(2000);
    expect(render.mock.lastCall?.[0]).toEqual({ enabled: false, opacity: 0 });
    grid.dispose();
  });

  it('restores visibility when movement resumes during a fade', () => {
    const render = vi.fn();
    const grid = createNavigationGrid(render);
    grid.show();
    const visibleOpacity = render.mock.lastCall?.[0].opacity;
    vi.advanceTimersByTime(1000);
    expect(render.mock.lastCall?.[0].opacity).toBeLessThan(visibleOpacity);
    expect(render.mock.lastCall?.[0].opacity).toBeGreaterThan(0);
    grid.show();
    expect(render.mock.lastCall?.[0].opacity).toBe(visibleOpacity);
    vi.advanceTimersByTime(500);
    expect(render.mock.lastCall?.[0].opacity).toBe(visibleOpacity);
    grid.dispose();
  });

  it('stops pending animations and ignores events after cleanup', () => {
    const render = vi.fn();
    const grid = createNavigationGrid(render);
    grid.show();
    vi.advanceTimersByTime(1000);
    grid.dispose();
    render.mockClear();
    vi.advanceTimersByTime(3000);
    grid.show();
    vi.advanceTimersByTime(3000);
    expect(render).not.toHaveBeenCalled();
  });
});
