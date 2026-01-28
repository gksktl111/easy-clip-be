import colorString from 'color-string';

export type DetectedClip =
  | { type: 'TEXT'; text: string }
  | { type: 'COLOR'; hex: string }
  | { type: 'IMAGE'; imageUrl: string };

// text 입력을 순서대로 판별하여 DetectedClip을 반드시 하나 반환한다.
export function detectClipType(raw: string): DetectedClip {
  const detectors = [detectColor];

  for (const detector of detectors) {
    const detected = detector(raw);
    if (detected) {
      return detected;
    }
  }

  return {
    type: 'TEXT',
    text: raw.trim(),
  };
}

// color-string으로 파싱 가능한 경우 HEX로 정규화해 반환한다.
export function detectColor(raw: string): DetectedClip | null {
  const trimmed = raw.trim();
  const parsed = colorString.get(trimmed);

  if (!parsed) {
    return null;
  }

  const [r, g, b, a] = toRgba(parsed.model, parsed.value);
  const hex = colorString.to.hex(r, g, b, a);

  if (!hex) {
    return null;
  }

  return {
    type: 'COLOR',
    hex: hex.toUpperCase(),
  };
}

function toRgba(model: 'rgb' | 'hsl' | 'hwb', value: number[]) {
  if (model === 'rgb') {
    return toRgbTuple(value);
  }

  if (model === 'hsl') {
    const [h, s, l, a] = value;
    const [r, g, b] = hslToRgb(h, s, l);
    return [r, g, b, a] as const;
  }

  const [h, w, b, a] = value;
  const [r, g, blue] = hwbToRgb(h, w, b);
  return [r, g, blue, a] as const;
}

function toRgbTuple(value: number[]) {
  const [r, g, b, a] = value;
  return [
    clampByte(r),
    clampByte(g),
    clampByte(b),
    typeof a === 'number' ? clampAlpha(a) : undefined,
  ] as const;
}

function hslToRgb(h: number, s: number, l: number) {
  const hue = normalizeHue(h);
  const saturation = clampUnit(s / 100);
  const lightness = clampUnit(l / 100);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = lightness - chroma / 2;
  const [r1, g1, b1] = pickHueSegment(segment, chroma, x);

  return [
    clampByte((r1 + m) * 255),
    clampByte((g1 + m) * 255),
    clampByte((b1 + m) * 255),
  ] as const;
}

function hwbToRgb(h: number, w: number, b: number) {
  const hue = normalizeHue(h);
  const whiteness = clampUnit(w / 100);
  const blackness = clampUnit(b / 100);
  const ratio = whiteness + blackness;

  if (ratio >= 1) {
    const gray = clampByte((whiteness / ratio) * 255);
    return [gray, gray, gray] as const;
  }

  const [baseR, baseG, baseB] = hslToRgbFloat(hue, 1, 0.5);
  const factor = 1 - whiteness - blackness;

  return [
    clampByte((baseR * factor + whiteness) * 255),
    clampByte((baseG * factor + whiteness) * 255),
    clampByte((baseB * factor + whiteness) * 255),
  ] as const;
}

function hslToRgbFloat(h: number, s: number, l: number) {
  const hue = normalizeHue(h);
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = l - chroma / 2;
  const [r1, g1, b1] = pickHueSegment(segment, chroma, x);

  return [r1 + m, g1 + m, b1 + m] as const;
}

function pickHueSegment(segment: number, chroma: number, x: number) {
  if (segment < 1) return [chroma, x, 0] as const;
  if (segment < 2) return [x, chroma, 0] as const;
  if (segment < 3) return [0, chroma, x] as const;
  if (segment < 4) return [0, x, chroma] as const;
  if (segment < 5) return [x, 0, chroma] as const;
  return [chroma, 0, x] as const;
}

function normalizeHue(hue: number) {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function clampUnit(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampByte(value: number) {
  if (Number.isNaN(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 255) return 255;
  return rounded;
}

function clampAlpha(value: number) {
  if (Number.isNaN(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
