const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function resolveMaxImageBytes(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_IMAGE_BYTES;
}

// Binary container identification, not full image decoding or malware scanning.
export function detectClipImageMimeType(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  )
    return 'image/jpeg';
  if (
    buffer.length >= 24 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    buffer.toString('ascii', 12, 16) === 'IHDR'
  )
    return 'image/png';
  if (
    buffer.length >= 13 &&
    ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
  )
    return 'image/gif';
  if (
    buffer.length >= 16 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))
  )
    return 'image/webp';
  if (buffer.length >= 16 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const size = buffer.readUInt32BE(0);
    if (size >= 16 && size <= buffer.length && size % 4 === 0) {
      for (let offset = 8; offset < size; offset += 4) {
        if (offset === 12) continue;
        if (
          ['avif', 'avis'].includes(
            buffer.toString('ascii', offset, offset + 4),
          )
        )
          return 'image/avif';
      }
    }
  }
  return undefined;
}
