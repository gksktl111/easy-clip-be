/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrashRepository } from '../../domain/trash.repository';
import { PurgeExpiredTrashItemsUseCase } from './purge-expired-trash-items.usecase';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedItems: jest.fn(),
  findDeletedClipsByIds: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreItems: jest.fn(),
  hardDeleteItems: jest.fn(),
  findDeletedFoldersByIds: jest.fn(),
  findDeletedFolderById: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
  hardDeleteAllTrashItemsForUser: jest.fn(),
});

const createConfigService = (
  values: Record<string, string | undefined> = {},
): Pick<ConfigService, 'get'> => ({
  get: jest.fn((key: string) => values[key]),
});

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
});

describe('PurgeExpiredTrashItemsUseCase', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('보관 기간이 지난 폴더를 먼저 삭제하고 남은 limit으로 클립을 삭제한다', async () => {
    const repo = createRepository();
    const configService = createConfigService();
    const imageStorage = createImageStorage();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue({
      deletedCount: 2,
      imageUrls: ['https://cdn.example.com/clips/user-1/folder.png'],
    });
    repo.hardDeleteExpiredClips.mockResolvedValue({
      deletedCount: 3,
      imageUrls: ['https://cdn.example.com/clips/user-1/clip.png'],
    });

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      imageStorage,
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
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-1/folder.png',
    );
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-1/clip.png',
    );
  });

  it('폴더 삭제가 limit을 모두 사용하면 클립 삭제를 호출하지 않는다', async () => {
    const repo = createRepository();
    const configService = createConfigService();
    const imageStorage = createImageStorage();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue({
      deletedCount: 10,
      imageUrls: [],
    });

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      imageStorage,
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
    const imageStorage = createImageStorage();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue({
      deletedCount: 0,
      imageUrls: [],
    });
    repo.hardDeleteExpiredClips.mockResolvedValue({
      deletedCount: 4,
      imageUrls: [],
    });

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      imageStorage,
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

  it('명시적으로 보관 기간 0일을 전달하면 현재 시각까지 삭제 대상으로 본다', async () => {
    const repo = createRepository();
    const configService = createConfigService();
    const imageStorage = createImageStorage();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue({
      deletedCount: 0,
      imageUrls: [],
    });
    repo.hardDeleteExpiredClips.mockResolvedValue({
      deletedCount: 1,
      imageUrls: [],
    });

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      imageStorage,
      configService as ConfigService,
    );
    const now = new Date('2026-02-01T00:00:00.000Z');
    const result = await usecase.execute({
      now,
      retentionDays: 0,
      limit: 10,
    });

    expect(repo.hardDeleteExpiredFoldersWithClips).toHaveBeenCalledWith(
      now,
      10,
    );
    expect(repo.hardDeleteExpiredClips).toHaveBeenCalledWith(now, 10);
    expect(result.retentionDays).toBe(0);
    expect(result.totalDeleted).toBe(1);
  });

  it('환경변수가 유효하지 않으면 기본 보관 기간 30일과 기본 limit 100을 사용한다', async () => {
    const repo = createRepository();
    const configService = createConfigService({
      TRASH_RETENTION_DAYS: 'invalid',
      TRASH_PURGE_LIMIT: '0',
    });
    const imageStorage = createImageStorage();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue({
      deletedCount: 0,
      imageUrls: [],
    });
    repo.hardDeleteExpiredClips.mockResolvedValue({
      deletedCount: 0,
      imageUrls: [],
    });

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      imageStorage,
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

  it('만료 이미지 삭제가 실패해도 purge 결과는 성공으로 반환한다', async () => {
    const repo = createRepository();
    const configService = createConfigService();
    const imageStorage = createImageStorage();
    repo.hardDeleteExpiredFoldersWithClips.mockResolvedValue({
      deletedCount: 0,
      imageUrls: [],
    });
    repo.hardDeleteExpiredClips.mockResolvedValue({
      deletedCount: 1,
      imageUrls: ['https://cdn.example.com/clips/user-1/clip.png'],
    });
    imageStorage.deleteImage.mockRejectedValue(new Error('r2 failed'));

    const usecase = new PurgeExpiredTrashItemsUseCase(
      repo,
      imageStorage,
      configService as ConfigService,
    );
    const result = await usecase.execute({
      now: new Date('2026-02-01T00:00:00.000Z'),
      retentionDays: 30,
      limit: 10,
    });

    expect(result.totalDeleted).toBe(1);
  });
});
