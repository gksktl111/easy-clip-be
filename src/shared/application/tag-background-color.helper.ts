export const TAG_BACKGROUND_COLORS = [
  'GRAY',
  'BROWN',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'BLUE',
  'PURPLE',
  'PINK',
  'RED',
] as const;

export const DEFAULT_TAG_BACKGROUND_COLOR = 'GRAY';

export type TagBackgroundColor = (typeof TAG_BACKGROUND_COLORS)[number];

export function isTagBackgroundColor(
  value: unknown,
): value is TagBackgroundColor {
  return (
    typeof value === 'string' &&
    (TAG_BACKGROUND_COLORS as readonly string[]).includes(value)
  );
}
