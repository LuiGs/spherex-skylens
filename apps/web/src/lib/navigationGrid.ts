interface SkyMap {
  getRaDec(): number[];
  getFov(): number[];
  getRotation(): number;
  getProjectionName(): string;
  world2pix(ra: number, dec: number): number[] | null;
}

const STEPS = [30, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001, 0.00002];

/** Spacing depends only on zoom, never on pointer motion or camera direction. */
export function gridStep(fov: number): number {
  const stableFov = Number(fov.toPrecision(6));
  return STEPS.find((step) => step <= stableFov / 5) ?? STEPS[STEPS.length - 1];
}

export function gridLabel(value: number, axis: 'AR' | 'Dec', step: number): string {
  const rounded = Number(value.toFixed(Math.max(0, Math.ceil(-Math.log10(step)))));
  return `${axis} ${Object.is(rounded, -0) ? 0 : rounded}°`;
}

export function gridOpacity(idleMs: number): number {
  return Math.max(0, Math.min(1, 1 - (idleMs - 650) / 700));
}

/** Fixed ICRS lines projected by Aladin; crossfade levels only when zoom changes. */
export function createNavigationGrid(map: SkyMap, element: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'coordinate-grid';
  canvas.setAttribute('aria-hidden', 'true');
  element.parentElement!.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let animation: number | undefined;
  let disposed = false;
  let previousStep: number | undefined;
  let step = gridStep(map.getFov()[0]);
  let changedAt = 0;
  let lastMovement = performance.now();
  const draw = () => {
    animation = undefined;
    if (disposed) return;
    const width = element.clientWidth, height = element.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const [ra, dec] = map.getRaDec();
    const sinDec = Math.sin(dec * Math.PI / 180);
    const cosDec = Math.cos(dec * Math.PI / 180);
    const [fovX, fovY] = map.getFov();
    const nextStep = gridStep(fovX);
    if (nextStep !== step) { previousStep = step; step = nextStep; changedAt = performance.now(); }
    canvas.dataset.step = String(step);
    const progress = Math.min(1, (performance.now() - changedAt) / 220);
    const extent = Math.max(fovX, fovY) * 1.15;
    const lowDec = Math.max(-90, dec - extent), highDec = Math.min(90, dec + extent);
    const raExtent = Math.abs(dec) + extent >= 90 ? 180 : Math.min(180, extent / Math.max(0.01, Math.cos(dec * Math.PI / 180)));
    const lowRa = ra - raExtent, highRa = ra + raExtent;
    const poles = [-90, 90].flatMap((latitude) => {
      try {
        const point = map.world2pix(0, latitude);
        return point && point.every(Number.isFinite) ? [point] : [];
      } catch { return []; }
    });
    const occupied: number[][] = [];
    const layer = (spacing: number, alpha: number, labels: boolean) => {
      const color = `rgba(139,188,255,${0.42 * alpha})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.font = '12px system-ui';
      const curve = (points: number[][], text: string) => {
        let last: number[] | null = null;
        let label: { point: number[]; angle: number; score: number } | null = null;
        ctx.beginPath();
        for (const [lon, lat] of points) {
          const latitude = lat * Math.PI / 180;
          const facing = sinDec * Math.sin(latitude) + cosDec * Math.cos(latitude) * Math.cos((lon - ra) * Math.PI / 180);
          if (facing <= 1e-10) { last = null; continue; }
          let point: number[] | null;
          try { point = map.world2pix(((lon % 360) + 360) % 360, lat); } catch { point = null; }
          if (!point || !point.every(Number.isFinite)) { last = null; continue; }
          const [x, y] = point;
          if (last && Math.hypot(x - last[0], y - last[1]) < Math.max(width, height) / 3) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          if (last && x > 70 && x < width - 100 && y > 25 && y < height - 25 &&
              poles.every(([px, py]) => Math.hypot(x - px, y - py) > 80) &&
              occupied.every(([ox, oy]) => Math.abs(x - ox) > 105 || Math.abs(y - oy) > 28)) {
            const score = Math.hypot(x - width / 2, y - height / 2);
            if (!label || score < label.score) {
              let angle = Math.atan2(y - last[1], x - last[0]);
              if (angle > Math.PI / 2) angle -= Math.PI;
              if (angle < -Math.PI / 2) angle += Math.PI;
              label = { point, angle, score };
            }
          }
          last = point;
        }
        ctx.stroke();
        if (labels && label) {
          occupied.push(label.point);
          ctx.save();
          ctx.translate(label.point[0], label.point[1]);
          ctx.rotate(label.angle);
          ctx.strokeStyle = `rgba(5,6,10,${0.9 * alpha})`;
          ctx.lineWidth = 3;
          ctx.strokeText(text, 4, -5);
          ctx.fillStyle = `rgba(182,210,255,${0.9 * alpha})`;
          ctx.fillText(text, 4, -5);
          ctx.restore();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
        }
      };
      for (let n = Math.ceil(lowDec / spacing); n <= Math.floor(highDec / spacing); n++) {
        const latitude = n * spacing;
        if (Math.abs(latitude) >= 90) continue;
        curve(Array.from({ length: 241 }, (_, i) => [lowRa + (highRa - lowRa) * i / 240, latitude]), gridLabel(latitude, 'Dec', spacing));
      }
      // Limit overlap of meridians converging at a pole; keep declination circles fixed.
      const stride = Math.max(1, Math.ceil((highRa - lowRa) / spacing / 120));
      const seenMeridians = new Set<string>();
      for (let n = Math.ceil(lowRa / spacing / stride) * stride; n <= Math.floor(highRa / spacing); n += stride) {
        const longitude = ((n * spacing % 360) + 360) % 360;
        const key = longitude.toFixed(8);
        if (seenMeridians.has(key)) continue;
        seenMeridians.add(key);
        curve(Array.from({ length: 161 }, (_, i) => [longitude, lowDec + (highDec - lowDec) * i / 160]), gridLabel(longitude, 'AR', spacing));
      }
    };
    if (previousStep !== undefined && progress < 1) layer(previousStep, 1 - progress, false);
    layer(step, previousStep === undefined ? 1 : progress, true);
    if (previousStep !== undefined && progress < 1) animation = requestAnimationFrame(draw);
    else previousStep = undefined;
  };
  const update = () => { if (!disposed && animation === undefined) animation = requestAnimationFrame(draw); };
  const resize = new ResizeObserver(update);
  resize.observe(element);
  // Aladin's public movement callbacks are throttled; follow the actual pose each frame.
  let signature = '';
  let watcher: number;
  const watch = () => {
    const next = [...map.getRaDec(), ...map.getFov(), map.getRotation(), map.getProjectionName()].join(',');
    if (next !== signature) {
      signature = next;
      lastMovement = performance.now();
      update();
    }
    canvas.style.opacity = String(gridOpacity(performance.now() - lastMovement));
    watcher = requestAnimationFrame(watch);
  };
  watcher = requestAnimationFrame(watch);
  update();
  return {
    update,
    dispose() {
      disposed = true;
      resize.disconnect();
      cancelAnimationFrame(watcher);
      if (animation !== undefined) cancelAnimationFrame(animation);
      canvas.remove();
    },
  };
}
