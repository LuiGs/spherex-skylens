interface GridOptions {
  enabled: boolean;
  opacity: number;
}

const OPACITY = 0.55;
const IDLE_DELAY_MS = 650;
const FADE_MS = 700;

/** Fade Aladin's projected coordinate grid after the last navigation event. */
export function createNavigationGrid(render: (options: GridOptions) => void) {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let fadeFrame: number | undefined;
  let disposed = false;
  let opacity = 0;

  const cancel = () => {
    clearTimeout(idleTimer);
    if (fadeFrame !== undefined) cancelAnimationFrame(fadeFrame);
  };

  const show = () => {
    if (disposed) return;
    cancel();
    if (opacity !== OPACITY) {
      opacity = OPACITY;
      render({ enabled: true, opacity });
    }
    idleTimer = setTimeout(() => {
      const start = performance.now();
      const fade = (now: number) => {
        if (disposed) return;
        const progress = Math.min(1, (now - start) / FADE_MS);
        opacity = OPACITY * (1 - progress) ** 2;
        render({ enabled: progress < 1, opacity });
        fadeFrame = progress < 1 ? requestAnimationFrame(fade) : undefined;
      };
      fadeFrame = requestAnimationFrame(fade);
    }, IDLE_DELAY_MS);
  };

  return {
    show,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
