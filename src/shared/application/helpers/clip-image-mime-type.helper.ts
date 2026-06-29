export const ALLOWED_CLIP_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export function isAllowedClipImageMimeType(mimetype: string): boolean {
  return ALLOWED_CLIP_IMAGE_MIME_TYPES.some((allowed) => allowed === mimetype);
}
