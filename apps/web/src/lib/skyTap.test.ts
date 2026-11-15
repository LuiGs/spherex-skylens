import { describe, expect, it, vi } from 'vitest';
import { attachSkyTap } from './skyTap';

function fakeElement(left = 0, top = 0): HTMLElement {
  const target = new EventTarget() as unknown as HTMLElement;
  target.getBoundingClientRect = () => ({ left, top }) as DOMRect;
  return target;
}

function pointer(type: string, x: number, y: number, time: number, id = 1) {
  vi.spyOn(Date, 'now').mockReturnValue(time);
  const event = new Event(type, { bubbles: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: id },
    button: { value: 0 },
    isPrimary: { value: true },
    clientX: { value: x },
    clientY: { value: y },
  });
  return event;
}

describe('attachSkyTap', () => {
  it('reports a tap relative to the element', () => {
    const element = fakeElement(100, 50);
    const onTap = vi.fn();
    attachSkyTap(element, onTap);
    element.dispatchEvent(pointer('pointerdown', 130, 70, 0));
    element.dispatchEvent(pointer('pointerup', 132, 71, 200));
    expect(onTap).toHaveBeenCalledWith(32, 21);
  });

  it('ignores drags, long presses and detached listeners', () => {
    const element = fakeElement();
    const onTap = vi.fn();
    const detach = attachSkyTap(element, onTap);
    element.dispatchEvent(pointer('pointerdown', 0, 0, 0));
    element.dispatchEvent(pointer('pointerup', 40, 0, 100));
    element.dispatchEvent(pointer('pointerdown', 0, 0, 0));
    element.dispatchEvent(pointer('pointerup', 0, 0, 2000));
    detach();
    element.dispatchEvent(pointer('pointerdown', 0, 0, 0));
    element.dispatchEvent(pointer('pointerup', 0, 0, 10));
    expect(onTap).not.toHaveBeenCalled();
  });
});
