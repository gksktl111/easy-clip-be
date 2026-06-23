import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PurgeExpiredTrashItemsUseCase } from '../application/usecases/purge-expired-trash-items.usecase';

@Injectable()
export class TrashCleanupScheduler {
  private readonly logger = new Logger(TrashCleanupScheduler.name);

  constructor(
    private readonly purgeExpiredTrashItemsUseCase: PurgeExpiredTrashItemsUseCase,
  ) {}

  @Cron('* * * * *', {
    name: 'trash-cleanup',
    timeZone: 'Asia/Seoul',
    waitForCompletion: true,
  })
  async handleTrashCleanup() {
    try {
      const result = await this.purgeExpiredTrashItemsUseCase.execute({
        retentionDays: 0,
      });

      this.logger.log(
        `휴지통 자동 정리 완료: folders=${result.foldersDeleted}, clips=${result.clipsDeleted}, expiresBefore=${result.expiresBefore.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('휴지통 자동 정리 중 오류가 발생했습니다.', error);
    }
  }
}
