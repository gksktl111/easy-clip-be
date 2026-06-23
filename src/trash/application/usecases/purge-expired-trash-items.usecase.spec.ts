/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { TrashRepository } from '../../domain/trash.repository';
import { PurgeExpiredTrashItemsUseCase } from './purge-expired-trash-items.usecase';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedClips: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreClip: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFolders: jest.fn(),
  findDeletedFolderById: jest.fn(),
  restoreFolderWithClips: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
});

const createConfigService = (
  values: Record<string, string | undefined> = {},
): Pick<ConfigService, 'get'> => ({
  get: jest.fn((key: string) => values[key]),
});

describe('PurgeExpiredTrashItemsUseCase', () => {
  it('보관 기간이 지난 폴더를 먼저 삭제하고 남은 limit으로 클립을 삭제한다', async () => {
    const repo = createRepository();
    const configService = createConfigService();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue(2);
    repo.hardDeleteExpiredClips.mockResolvedValue(3);

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      configService as ConfigService,
    );
    const now = new Date('2026-02-01T00:00:00.000Z');
    const result = await usecase.execute({
      now,
      retentionDays: 30,
      limit: 10,
    });

    const expiresBefore = new Date('2026-01-02T00:00:00.000Z');
    expect(repo.hardDeleteExpiredFoldersWithClips).toHaveBeenCalledWith(
      expiresBefore,
      10,
    );
    expect(repo.hardDeleteExpiredClips).toHaveBeenCalledWith(expiresBefore, 8);
    expect(result).toEqual({
      expiresBefore,
      retentionDays: 30,
      foldersDeleted: 2,
      clipsDeleted: 3,
      totalDeleted: 5,
    });
  });

  it('폴더 삭제가 limit을 모두 사용하면 클립 삭제를 호출하지 않는다', async () => {
    const repo = createRepository();
    const configService = createConfigService();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue(10);

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      configService as ConfigService,
    );
    const result = await usecase.execute({
      now: new Date('2026-02-01T00:00:00.000Z'),
      retentionDays: 30,
      limit: 10,
    });

    expect(repo.hardDeleteExpiredClips).not.toHaveBeenCalled();
    expect(result.clipsDeleted).toBe(0);
    expect(result.totalDeleted).toBe(10);
  });

  it('환경변수의 보관 기간과 삭제 limit을 사용한다', async () => {
    const repo = createRepository();
    const configService = createConfigService({
      TRASH_RETENTION_DAYS: '7',
      TRASH_PURGE_LIMIT: '20',
    });
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue(0);
    repo.hardDeleteExpiredClips.mockResolvedValue(4);

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      configService as ConfigService,
    );
    const result = await usecase.execute({
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    const expiresBefore = new Date('2026-01-25T00:00:00.000Z');
    expect(repo.hardDeleteExpiredFoldersWithClips).toHaveBeenCalledWith(
      expiresBefore,
      20,
    );
    expect(repo.hardDeleteExpiredClips).toHaveBeenCalledWith(expiresBefore, 20);
    expect(result.retentionDays).toBe(7);
  });

  it('환경변수가 유효하지 않으면 기본 보관 기간 30일과 기본 limit 100을 사용한다', async () => {
    const repo = createRepository();
    const configService = createConfigService({
      TRASH_RETENTION_DAYS: 'invalid',
      TRASH_PURGE_LIMIT: '0',
    });
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue(0);
    repo.hardDeleteExpiredClips.mockResolvedValue(0);

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      configService as ConfigService,
    );
    const result = await usecase.execute({
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    const expiresBefore = new Date('2026-01-02T00:00:00.000Z');
    expect(repo.hardDeleteExpiredFoldersWithClips).toHaveBeenCalledWith(
      expiresBefore,
      100,
    );
    expect(repo.hardDeleteExpiredClips).toHaveBeenCalledWith(
      expiresBefore,
      100,
    );
    expect(result.retentionDays).toBe(30);
  });
});
