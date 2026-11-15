type Vector = [number, number, number];
export interface CameraPose { ra: number; dec: number; rotation: number }
const RAD = Math.PI / 180;
const dot = (a: Vector, b: Vector) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vector, s: number): Vector => [a[0] * s, a[1] * s, a[2] * s];
const add = (a: Vector, b: Vector): Vector => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Rotate the complete camera basis from its drag-start pose, without Euler-angle pole singularities. */
export function dragCamera(start: CameraPose, dxDegrees: number, dyDegrees: number): CameraPose {
  if (dxDegrees === 0 && dyDegrees === 0) return { ...start };
  const a = start.ra * RAD, d = start.dec * RAD, roll = start.rotation * RAD;
  const center: Vector = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const east: Vector = [-Math.sin(a), Math.cos(a), 0];
  const north: Vector = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const up = add(scale(north, Math.cos(roll)), scale(east, -Math.sin(roll)));
  const right = cross(center, up);
  const angle = Math.hypot(dxDegrees, dyDegrees) * RAD;
  const axis = scale(add(scale(up, dxDegrees), scale(right, dyDegrees)), RAD / angle);
  const rotate = (v: Vector): Vector => add(add(scale(v, Math.cos(angle)), scale(cross(axis, v), Math.sin(angle))), scale(axis, dot(axis, v) * (1 - Math.cos(angle))));
  const c = rotate(center), u = rotate(up);
  const ra = Math.atan2(c[1], c[0]);
  const dec = Math.atan2(c[2], Math.hypot(c[0], c[1]));
  const newEast: Vector = [-Math.sin(ra), Math.cos(ra), 0];
  const newNorth: Vector = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  return {
    ra: ((ra / RAD) % 360 + 360) % 360,
    dec: dec / RAD,
    rotation: Math.atan2(-dot(u, newEast), dot(u, newNorth)) / RAD,
  };
}

interface DragMap {
  getRaDec(): number[];
  getRotation(): number;
  getFov(): number[];
  gotoRaDec(ra: number, dec: number): void;
  setRotation(rotation: number): void;
}

export function attachSkyDrag(map: DragMap, element: HTMLElement) {
  let drag: { pointer: number; x: number; y: number; degreesPerPixel: number; pose: CameraPose } | null = null;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return;
    e.preventDefault();
    e.stopPropagation();
    const [ra, dec] = map.getRaDec();
    drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, degreesPerPixel: map.getFov()[0] / element.clientWidth, pose: { ra, dec, rotation: map.getRotation() } };
    element.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    e.preventDefault();
    e.stopPropagation();
    const pose = dragCamera(drag.pose, (e.clientX - drag.x) * drag.degreesPerPixel, (e.clientY - drag.y) * drag.degreesPerPixel);
    map.gotoRaDec(pose.ra, pose.dec);
    map.setRotation(pose.rotation);
  };
  const end = (e: PointerEvent) => {
    if (drag?.pointer !== e.pointerId) return;
    drag = null;
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
  };
  element.addEventListener('pointerdown', down, { capture: true });
  element.addEventListener('pointermove', move, { capture: true });
  element.addEventListener('pointerup', end, { capture: true });
  element.addEventListener('pointercancel', end, { capture: true });
  return () => {
    element.removeEventListener('pointerdown', down, true);
    element.removeEventListener('pointermove', move, true);
    element.removeEventListener('pointerup', end, true);
    element.removeEventListener('pointercancel', end, true);
  };
}
