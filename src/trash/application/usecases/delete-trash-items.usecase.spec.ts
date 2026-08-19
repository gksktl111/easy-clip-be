/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';
import { createTrashRepositoryMock as createRepository } from '../../test-support/create-trash-repository-mock';
import { DeleteTrashItemsUseCase } from './delete-trash-items.usecase';

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
});

describe('DeleteTrashItemsUseCase', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('휴지통 클립 단건을 영구 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);
    repo.hardDeleteItems.mockResolvedValue({
      clipsDeleted: 1,
      foldersDeleted: 0,
      totalDeleted: 1,
      imageUrls: [],
    });

    const usecase = new DeleteTrashItemsUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', {
      items: [{ itemType: 'CLIP', id: 'clip-1' }],
    });

    expect(repo.hardDeleteItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: ['clip-1'],
      folderIds: [],
    });
    expect(result).toEqual({
      clipsDeleted: 1,
      foldersDeleted: 0,
      totalDeleted: 1,
    });
  });

  it('휴지통 폴더와 클립을 함께 영구 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'IMAGE',
        folderId: 'folder-2',
        deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([
      {
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt,
      },
    ]);
    repo.hardDeleteItems.mockResolvedValue({
      clipsDeleted: 3,
      foldersDeleted: 1,
      totalDeleted: 4,
      imageUrls: ['https://image.example/clip.png'],
    });

    const usecase = new DeleteTrashItemsUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', {
      items: [
        { itemType: 'FOLDER', id: 'folder-1' },
        { itemType: 'CLIP', id: 'clip-1' },
      ],
    });

    expect(repo.hardDeleteItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: ['clip-1'],
      folderIds: ['folder-1'],
    });
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://image.example/clip.png',
    );
    expect(result).toEqual({
      clipsDeleted: 3,
      foldersDeleted: 1,
      totalDeleted: 4,
    });
  });

  it('같은 요청의 폴더에 속한 클립은 폴더 삭제로 함께 처리한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
        folderDeletedAt: deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([
      {
        id: 'folder-1',
        name: '삭제된 폴더',
        deletedAt,
      },
    ]);
    repo.hardDeleteItems.mockResolvedValue({
      clipsDeleted: 2,
      foldersDeleted: 1,
      totalDeleted: 3,
      imageUrls: [],
    });

    const usecase = new DeleteTrashItemsUseCase(repo, imageStorage);
    await usecase.execute('user-1', {
      items: [
        { itemType: 'FOLDER', id: 'folder-1' },
        { itemType: 'CLIP', id: 'clip-1' },
      ],
    });

    expect(repo.hardDeleteItems).toHaveBeenCalledWith({
      userId: 'user-1',
      clipIds: [],
      folderIds: ['folder-1'],
    });
  });

  it('삭제된 폴더 하위 클립만 단독 영구 삭제하면 에러를 던진다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt,
        folderDeletedAt: deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);

    const usecase = new DeleteTrashItemsUseCase(repo, imageStorage);

    await expect(
      usecase.execute('user-1', {
        items: [{ itemType: 'CLIP', id: 'clip-1' }],
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(repo.hardDeleteItems).not.toHaveBeenCalled();
  });

  it('요청한 휴지통 항목이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.findDeletedClipsByIds.mockResolvedValue([]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);

    const usecase = new DeleteTrashItemsUseCase(repo, imageStorage);

    await expect(
      usecase.execute('user-1', {
        items: [{ itemType: 'CLIP', id: 'clip-1' }],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(repo.hardDeleteItems).not.toHaveBeenCalled();
  });

  it('이미지 객체 삭제가 실패해도 영구 삭제 결과를 반환한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    const deletedAt = new Date();
    repo.findDeletedClipsByIds.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'IMAGE',
        folderId: 'folder-1',
        deletedAt,
      },
    ]);
    repo.findDeletedFoldersByIds.mockResolvedValue([]);
    repo.hardDeleteItems.mockResolvedValue({
      clipsDeleted: 1,
      foldersDeleted: 0,
      totalDeleted: 1,
      imageUrls: ['https://image.example/clip.png'],
    });
    imageStorage.deleteImage.mockRejectedValue(new Error('R2 failed'));

    const usecase = new DeleteTrashItemsUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', {
      items: [{ itemType: 'CLIP', id: 'clip-1' }],
    });

    expect(result).toEqual({
      clipsDeleted: 1,
      foldersDeleted: 0,
      totalDeleted: 1,
    });
    expect(warnSpy).toHaveBeenCalled();
  });
});
