export type UsersErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL';

export class UsersError extends Error {
  constructor(
    public readonly code: UsersErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'UsersError';
  }
}
