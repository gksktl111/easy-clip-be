/* eslint-disable @typescript-eslint/unbound-method */
import { GetClipUseCase } from './get-clip.usecase';
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

describe('GetClipUseCase', () => {
  it('클립이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new GetClipUseCase(repo);

    await expect(
      usecase.execute('user-id', 'missing-clip-id'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('클립이 있으면 그대로 반환한다', async () => {
    const repo = createRepository();
    const clip = {
      id: 'clip-id',
      type: 'TEXT' as const,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    repo.findClipByIdForUser.mockResolvedValue(clip);

    const usecase = new GetClipUseCase(repo);
    const result = await usecase.execute('user-id', 'clip-id');

    expect(repo.findClipByIdForUser).toHaveBeenCalledWith('user-id', 'clip-id');
    expect(result).toBe(clip);
  });
});
