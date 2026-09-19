// Scientific Colormaps (cmocean & scientific standards) for Oceanography
export type ColormapName = 'thermal' | 'haline' | 'balance' | 'algae' | 'dense' | 'turbo' | 'viridis';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Color stops [position 0..1, [r, g, b]]
const COLORMAP_STOPS: Record<ColormapName, Array<[number, [number, number, number]]>> = {
  thermal: [
    [0.0, [4, 20, 60]],
    [0.2, [28, 70, 160]],
    [0.4, [40, 150, 210]],
    [0.6, [240, 200, 50]],
    [0.8, [230, 90, 20]],
    [1.0, [190, 10, 10]]
  ],
  haline: [
    [0.0, [10, 25, 60]],
    [0.25, [20, 100, 140]],
    [0.5, [30, 170, 130]],
    [0.75, [160, 210, 60]],
    [1.0, [245, 235, 70]]
  ],
  balance: [
    [0.0, [30, 80, 180]],
    [0.35, [140, 190, 230]],
    [0.5, [240, 240, 245]],
    [0.65, [235, 150, 120]],
    [1.0, [180, 30, 30]]
  ],
  algae: [
    [0.0, [10, 30, 60]],
    [0.2, [20, 90, 90]],
    [0.45, [40, 165, 80]],
    [0.75, [140, 215, 60]],
    [1.0, [235, 245, 100]]
  ],
  dense: [
    [0.0, [15, 5, 25]],
    [0.3, [60, 30, 110]],
    [0.6, [40, 125, 150]],
    [0.85, [120, 200, 120]],
    [1.0, [245, 240, 130]]
  ],
  turbo: [
    [0.0, [48, 18, 59]],
    [0.2, [70, 134, 251]],
    [0.4, [27, 229, 181]],
    [0.6, [164, 252, 60]],
    [0.8, [251, 155, 38]],
    [1.0, [122, 4, 3]]
  ],
  viridis: [
    [0.0, [68, 1, 84]],
    [0.25, [59, 82, 139]],
    [0.5, [33, 145, 140]],
    [0.75, [94, 201, 98]],
    [1.0, [253, 231, 37]]
  ]
};

export function sampleColormap(
  name: ColormapName = 'thermal',
  normalizedVal: number,
  alpha: number = 255
): [number, number, number, number] {
  const t = Math.max(0, Math.min(1, isNaN(normalizedVal) ? 0 : normalizedVal));
  const stops = COLORMAP_STOPS[name] || COLORMAP_STOPS.thermal;

  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];

    if (t >= p0 && t <= p1) {
      const span = p1 - p0;
      const f = span > 0 ? (t - p0) / span : 0;
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return [r, g, b, alpha];
    }
  }

  const last = stops[stops.length - 1][1];
  return [last[0], last[1], last[2], alpha];
}

export function createColormapTexture(
  data: Float32Array,
  rows: number,
  cols: number,
  minVal: number,
  maxVal: number,
  colormapName: ColormapName = 'thermal',
  alpha: number = 200
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imgData = ctx.createImageData(cols, rows);
  const buf = imgData.data;
  const range = maxVal - minVal > 0 ? maxVal - minVal : 1.0;

  for (let r = 0; r < rows; r++) {
    // Invert row index for correct geospatial north-to-south image mapping
    const srcRow = rows - 1 - r;
    for (let c = 0; c < cols; c++) {
      const srcIdx = srcRow * cols + c;
      const val = data[srcIdx];
      const dstIdx = (r * cols + c) * 4;

      if (val === -999.0 || isNaN(val)) {
        buf[dstIdx] = 0;
        buf[dstIdx + 1] = 0;
        buf[dstIdx + 2] = 0;
        buf[dstIdx + 3] = 0; // Fully transparent for land / nodata
      } else {
        const norm = (val - minVal) / range;
        const [red, green, blue, a] = sampleColormap(colormapName, norm, alpha);
        buf[dstIdx] = red;
        buf[dstIdx + 1] = green;
        buf[dstIdx + 2] = blue;
        buf[dstIdx + 3] = a;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
