export type ClipsErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL';

export class ClipsError extends Error {
  constructor(
    public readonly code: ClipsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClipsError';
  }
}
