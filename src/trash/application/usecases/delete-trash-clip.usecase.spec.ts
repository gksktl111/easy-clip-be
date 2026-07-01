/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { DeleteTrashClipUseCase } from './delete-trash-clip.usecase';
import { TrashRepository } from '../../domain/trash.repository';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';

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

describe('DeleteTrashClipUseCase', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('휴지통 클립이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedClipById.mockResolvedValue(null);
    const imageStorage = createImageStorage();

    const usecase = new DeleteTrashClipUseCase(repo, imageStorage);

    await expect(usecase.execute('user-1', 'clip-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('휴지통 클립을 영구 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.findDeletedClipById.mockResolvedValue({
      id: 'clip-1',
      title: '삭제된 클립',
      type: 'TEXT',
      folderId: 'folder-1',
      deletedAt: new Date(),
    });
    repo.hardDeleteClip.mockResolvedValue({
      deletedCount: 1,
      imageUrls: [],
    });

    const usecase = new DeleteTrashClipUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', 'clip-1');

    expect(repo.hardDeleteClip).toHaveBeenCalledWith('clip-1');
    expect(result).toEqual({ success: true });
  });

  it('이미지 클립을 영구 삭제하면 R2 객체도 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.findDeletedClipById.mockResolvedValue({
      id: 'clip-1',
      title: '삭제된 클립',
      type: 'IMAGE',
      folderId: 'folder-1',
      deletedAt: new Date(),
    });
    repo.hardDeleteClip.mockResolvedValue({
      deletedCount: 1,
      imageUrls: ['https://cdn.example.com/clips/user-1/file.png'],
    });

    const usecase = new DeleteTrashClipUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', 'clip-1');

    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-1/file.png',
    );
    expect(result).toEqual({ success: true });
  });

  it('R2 객체 삭제가 실패해도 DB 영구 삭제 결과는 성공으로 반환한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.findDeletedClipById.mockResolvedValue({
      id: 'clip-1',
      title: '삭제된 클립',
      type: 'IMAGE',
      folderId: 'folder-1',
      deletedAt: new Date(),
    });
    repo.hardDeleteClip.mockResolvedValue({
      deletedCount: 1,
      imageUrls: ['https://cdn.example.com/clips/user-1/file.png'],
    });
    imageStorage.deleteImage.mockRejectedValue(new Error('r2 failed'));

    const usecase = new DeleteTrashClipUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', 'clip-1');

    expect(result).toEqual({ success: true });
  });
});
