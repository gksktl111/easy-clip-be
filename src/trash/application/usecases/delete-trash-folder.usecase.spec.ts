/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteTrashFolderUseCase } from './delete-trash-folder.usecase';
import { TrashRepository } from '../../domain/trash.repository';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';

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
  hardDeleteAllTrashItemsForUser: jest.fn(),
});

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
});

describe('DeleteTrashFolderUseCase', () => {
  it('휴지통 폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findDeletedFolderById.mockResolvedValue(null);
    const imageStorage = createImageStorage();

    const usecase = new DeleteTrashFolderUseCase(repo, imageStorage);

    await expect(usecase.execute('user-1', 'folder-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('휴지통 폴더와 하위 클립을 함께 영구 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.findDeletedFolderById.mockResolvedValue({
      id: 'folder-1',
      name: '삭제된 폴더',
      deletedAt: new Date(),
    });
    repo.hardDeleteFolderWithClips.mockResolvedValue({
      deletedCount: 1,
      imageUrls: [],
    });

    const usecase = new DeleteTrashFolderUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', 'folder-1');

    expect(repo.hardDeleteFolderWithClips).toHaveBeenCalledWith('folder-1');
    expect(result).toEqual({ success: true });
  });

  it('하위 이미지 클립이 있으면 R2 객체를 함께 삭제한다', async () => {
    const repo = createRepository();
    const imageStorage = createImageStorage();
    repo.findDeletedFolderById.mockResolvedValue({
      id: 'folder-1',
      name: '삭제된 폴더',
      deletedAt: new Date(),
    });
    repo.hardDeleteFolderWithClips.mockResolvedValue({
      deletedCount: 1,
      imageUrls: [
        'https://cdn.example.com/clips/user-1/a.png',
        'https://cdn.example.com/clips/user-1/b.png',
      ],
    });

    const usecase = new DeleteTrashFolderUseCase(repo, imageStorage);
    const result = await usecase.execute('user-1', 'folder-1');

    expect(imageStorage.deleteImage).toHaveBeenCalledTimes(2);
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-1/a.png',
    );
    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-1/b.png',
    );
    expect(result).toEqual({ success: true });
  });
});
