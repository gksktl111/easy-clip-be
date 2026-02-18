export type WorkspacesErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

export class WorkspacesError extends Error {
  constructor(
    public readonly code: WorkspacesErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspacesError';
  }
}
