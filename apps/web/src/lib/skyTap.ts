const MAX_MOVE_PX = 6;
const MAX_DURATION_MS = 600;

/**
 * Calls `onTap` with element-relative pixel coordinates when a pointer goes down and up in place.
 * Listens in the capture phase so it still works when a drag handler swallows the events.
 */
export function attachSkyTap(element: HTMLElement, onTap: (x: number, y: number) => void) {
  let start: { pointer: number; x: number; y: number; time: number } | null = null;
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    start = { pointer: e.pointerId, x: e.clientX, y: e.clientY, time: Date.now() };
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.pointer) return;
    const { x, y, time } = start;
    start = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) > MAX_MOVE_PX || Date.now() - time > MAX_DURATION_MS) return;
    const rect = element.getBoundingClientRect();
    onTap(e.clientX - rect.left, e.clientY - rect.top);
  };
  const cancel = () => {
    start = null;
  };
  element.addEventListener('pointerdown', down, { capture: true });
  element.addEventListener('pointerup', up, { capture: true });
  element.addEventListener('pointercancel', cancel, { capture: true });
  return () => {
    element.removeEventListener('pointerdown', down, { capture: true });
    element.removeEventListener('pointerup', up, { capture: true });
    element.removeEventListener('pointercancel', cancel, { capture: true });
  };
}
