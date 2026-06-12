import type { Request } from 'express';

export type MulterFile = NonNullable<Request['file']>;
