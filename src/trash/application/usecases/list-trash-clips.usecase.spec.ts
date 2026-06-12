/* eslint-disable @typescript-eslint/unbound-method */
import { ListTrashClipsUseCase } from './list-trash-clips.usecase';
import { TrashRepository } from '../../domain/trash.repository';

const createRepository = (): jest.Mocked<TrashRepository> => ({
  findDeletedClips: jest.fn(),
  findDeletedClipById: jest.fn(),
  restoreClip: jest.fn(),
  hardDeleteClip: jest.fn(),
  findDeletedFolders: jest.fn(),
  findDeletedFolderById: jest.fn(),
  restoreFolderWithClips: jest.fn(),
  hardDeleteFolderWithClips: jest.fn(),
});

describe('ListTrashClipsUseCase', () => {
  it('휴지통 클립 목록을 반환한다', async () => {
    const repo = createRepository();
    repo.findDeletedClips.mockResolvedValue([
      {
        id: 'clip-1',
        title: '삭제된 클립',
        type: 'TEXT',
        folderId: 'folder-1',
        deletedAt: new Date(),
      },
    ]);

    const usecase = new ListTrashClipsUseCase(repo);
    const result = await usecase.execute('user-1');

    expect(repo.findDeletedClips).toHaveBeenCalledWith('user-1');
    expect(result.items).toHaveLength(1);
  });
});
