/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteClipUseCase } from './delete-clip.usecase';
import { ClipsRepository } from '../../domain/clips.repository';

const createRepository = (): jest.Mocked<ClipsRepository> => ({
  findPersonalFolderById: jest.fn(),
  findClipByIdForUser: jest.fn(),
  findClips: jest.fn(),
  hasTitleMatches: jest.fn(),
  isClipMatchingQuery: jest.fn(),
  isClipLikedByUser: jest.fn(),
  createClip: jest.fn(),
  updateClip: jest.fn(),
  softDeleteClip: jest.fn(),
});

describe('DeleteClipUseCase', () => {
  it('클립이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new DeleteClipUseCase(repo);

    await expect(
      usecase.execute('user-id', 'missing-clip-id'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('클립 삭제는 deletedAt을 기록하는 소프트 삭제로 처리한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repo.softDeleteClip.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    });

    const usecase = new DeleteClipUseCase(repo);
    const result = await usecase.execute('user-id', 'clip-id');

    expect(repo.softDeleteClip).toHaveBeenCalledWith('clip-id');
    expect(result.id).toBe('clip-id');
  });
});
