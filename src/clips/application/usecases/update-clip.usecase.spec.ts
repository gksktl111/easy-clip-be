/* eslint-disable @typescript-eslint/unbound-method */
import { UpdateClipUseCase } from './update-clip.usecase';
import { ClipsRepository } from '../../domain/clips.repository';

const createRepository = (): jest.Mocked<ClipsRepository> => ({
  findPersonalFolderById: jest.fn(),
  findClipByIdForUser: jest.fn(),
  findClips: jest.fn(),
  findRecentClips: jest.fn(),
  hasTitleMatches: jest.fn(),
  hasRecentTitleMatches: jest.fn(),
  isClipMatchingQuery: jest.fn(),
  isRecentCursorMatchingQuery: jest.fn(),
  findRecentViewedClipIds: jest.fn(),
  findClipsByIdsForUser: jest.fn(),
  createClipView: jest.fn(),
  isClipLikedByUser: jest.fn(),
  createClipLike: jest.fn(),
  deleteClipLike: jest.fn(),
  createClip: jest.fn(),
  updateClip: jest.fn(),
  softDeleteClip: jest.fn(),
});

describe('UpdateClipUseCase', () => {
  it('text가 오면 타입을 재판별해 저장한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old-text',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repo.updateClip.mockResolvedValue({
      id: 'clip-id',
      type: 'COLOR',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: '#FFFFFF',
      textContent: null,
      colorHex: '#FFFFFF',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const usecase = new UpdateClipUseCase(repo);
    const result = await usecase.execute('user-id', {
      clipId: 'clip-id',
      text: '#fff',
    });

    expect(repo.updateClip).toHaveBeenCalledWith('clip-id', {
      type: 'COLOR',
      title: '#FFFFFF',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: null,
      colorHex: '#FFFFFF',
      imageUrl: null,
    });
    expect(result.type).toBe('COLOR');
  });

  it('폴더가 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old-text',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new UpdateClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        clipId: 'clip-id',
        folderId: 'missing-folder',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('클립이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new UpdateClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        clipId: 'missing-clip-id',
        text: 'hi',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('text와 file이 모두 없으면 기존 데이터를 유지한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old-text',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repo.updateClip.mockResolvedValue({ id: 'clip-id' } as never);

    const usecase = new UpdateClipUseCase(repo);
    await usecase.execute('user-id', {
      clipId: 'clip-id',
    });

    expect(repo.updateClip).toHaveBeenCalledWith('clip-id', {
      type: 'TEXT',
      title: 'old-text',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
    });
  });
});
