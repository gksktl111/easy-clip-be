export const TAG_NAME_MAX_LENGTH = 10;

export function isValidTagName(value: string): boolean {
  return (
    value.trim().length > 0 && Array.from(value).length <= TAG_NAME_MAX_LENGTH
  );
}
