import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TRASH_REPOSITORY,
  type TrashRepository,
} from '../../domain/trash.repository';

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_PURGE_LIMIT = 100;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type PurgeExpiredTrashItemsInput = {
  now?: Date;
  retentionDays?: number;
  limit?: number;
};

export type PurgeExpiredTrashItemsOutput = {
  expiresBefore: Date;
  retentionDays: number;
  foldersDeleted: number;
  clipsDeleted: number;
  totalDeleted: number;
};

@Injectable()
export class PurgeExpiredTrashItemsUseCase {
  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: PurgeExpiredTrashItemsInput = {},
  ): Promise<PurgeExpiredTrashItemsOutput> {
    const now = input.now ?? new Date();
    const retentionDays = this.resolvePositiveInteger(
      input.retentionDays,
      this.configService.get<string>('TRASH_RETENTION_DAYS'),
      DEFAULT_RETENTION_DAYS,
    );
    const limit = this.resolvePositiveInteger(
      input.limit,
      this.configService.get<string>('TRASH_PURGE_LIMIT'),
      DEFAULT_PURGE_LIMIT,
    );
    const expiresBefore = new Date(now.getTime() - retentionDays * DAY_IN_MS);

    const foldersDeleted =
      await this.trashRepository.hardDeleteExpiredFoldersWithClips(
        expiresBefore,
        limit,
      );

    const remainingLimit = Math.max(limit - foldersDeleted, 0);
    const clipsDeleted =
      remainingLimit > 0
        ? await this.trashRepository.hardDeleteExpiredClips(
            expiresBefore,
            remainingLimit,
          )
        : 0;

    return {
      expiresBefore,
      retentionDays,
      foldersDeleted,
      clipsDeleted,
      totalDeleted: foldersDeleted + clipsDeleted,
    };
  }

  private resolvePositiveInteger(
    overrideValue: number | undefined,
    configValue: string | undefined,
    defaultValue: number,
  ): number {
    const value = overrideValue ?? (configValue ? Number(configValue) : NaN);

    if (Number.isInteger(value) && value > 0) {
      return value;
    }

    return defaultValue;
  }
}
