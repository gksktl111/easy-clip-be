/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';
import { TrashRepository } from '../../domain/trash.repository';
import { DeleteAllTrashItemsUseCase } from './delete-all-trash-items.usecase';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedItems: jest.fn(),
  findDeletedClipsByIds: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreItems: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFoldersByIds: jest.fn(),
  findDeletedFolderById: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
  hardDeleteExpiredFoldersWithClips: jest.fn(),
  hardDeleteExpiredClips: jest.fn(),
  hardDeleteAllTrashItemsForUser: jest.fn(),
});

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
});

describe('DeleteAllTrashItemsUseCase', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('휴지통 클립과 폴더를 전체 영구 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.hardDeleteAllTrashItemsForUser.mockResolvedValue({
      clipsDeleted: 3,
      foldersDeleted: 2,
      totalDeleted: 5,
      imageUrls: [],
    });

    const usecase = new DeleteAllTrashItemsUseCase(repo, imageStorage);
    const result = await usecase.execute('user-id');

    expect(repo.hardDeleteAllTrashItemsForUser).toHaveBeenCalledWith('user-id');
    expect(result).toEqual({
      clipsDeleted: 3,
      foldersDeleted: 2,
      totalDeleted: 5,
    });
  });

  it('삭제된 이미지 클립이 있으면 R2 객체를 함께 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.hardDeleteAllTrashItemsForUser.mockResolvedValue({
      clipsDeleted: 2,
      foldersDeleted: 0,
      totalDeleted: 2,
      imageUrls: [
        'https://cdn.example.com/clips/user-id/a.png',
        'https://cdn.example.com/clips/user-id/b.png',
      ],
    });

    const usecase = new DeleteAllTrashItemsUseCase(repo, imageStorage);
    await usecase.execute('user-id');

    expect(imageStorage.deleteImage).toHaveBeenCalledTimes(2);
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-id/a.png',
    );
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-id/b.png',
    );
  });

  it('R2 이미지 삭제가 실패해도 휴지통 전체 삭제 결과를 반환한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.hardDeleteAllTrashItemsForUser.mockResolvedValue({
      clipsDeleted: 1,
      foldersDeleted: 0,
      totalDeleted: 1,
      imageUrls: ['https://cdn.example.com/clips/user-id/a.png'],
    });
    imageStorage.deleteImage.mockRejectedValue(new Error('r2 failed'));

    const usecase = new DeleteAllTrashItemsUseCase(repo, imageStorage);
    const result = await usecase.execute('user-id');

    expect(result).toEqual({
      clipsDeleted: 1,
      foldersDeleted: 0,
      totalDeleted: 1,
    });
    expect(warnSpy).toHaveBeenCalled();
  });
});
