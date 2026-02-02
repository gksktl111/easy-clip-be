export type FoldersErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL';

export class FoldersError extends Error {
  constructor(
    public readonly code: FoldersErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FoldersError';
  }
}
