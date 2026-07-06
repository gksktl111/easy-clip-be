import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CLIP_IMAGE_STORAGE_PORT,
  type ClipImageStoragePort,
} from 'src/shared/application/ports/clip-image-storage.port';
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
  private readonly logger = new Logger(PurgeExpiredTrashItemsUseCase.name);

  constructor(
    @Inject(TRASH_REPOSITORY)
    private readonly trashRepository: TrashRepository,
    @Inject(CLIP_IMAGE_STORAGE_PORT)
    private readonly clipImageStoragePort: ClipImageStoragePort,
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

    const folderDeletion =
      await this.trashRepository.hardDeleteExpiredFoldersWithClips(
        expiresBefore,
        limit,
      );
    await this.deleteImagesBestEffort(folderDeletion.imageUrls);

    const remainingLimit = Math.max(limit - folderDeletion.deletedCount, 0);
    const clipDeletion =
      remainingLimit > 0
        ? await this.trashRepository.hardDeleteExpiredClips(
            expiresBefore,
            remainingLimit,
          )
        : { deletedCount: 0, imageUrls: [] };
    await this.deleteImagesBestEffort(clipDeletion.imageUrls);

    return {
      expiresBefore,
      retentionDays,
      foldersDeleted: folderDeletion.deletedCount,
      clipsDeleted: clipDeletion.deletedCount,
      totalDeleted: folderDeletion.deletedCount + clipDeletion.deletedCount,
    };
  }

  private resolvePositiveInteger(
    overrideValue: number | undefined,
    configValue: string | undefined,
    defaultValue: number,
  ): number {
    if (
      overrideValue !== undefined &&
      Number.isInteger(overrideValue) &&
      overrideValue >= 0
    ) {
      return overrideValue;
    }

    const value = configValue ? Number(configValue) : NaN;

    if (Number.isInteger(value) && value > 0) {
      return value;
    }

    return defaultValue;
  }

  private async deleteImagesBestEffort(imageUrls: string[]): Promise<void> {
    await Promise.all(
      imageUrls.map(async (imageUrl) => {
        try {
          await this.clipImageStoragePort.deleteImage(imageUrl);
        } catch (error) {
          this.logger.warn(
            `만료 휴지통 이미지 삭제에 실패했습니다. imageUrl=${imageUrl}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }),
    );
  }
}
