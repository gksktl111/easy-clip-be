/* eslint-disable @typescript-eslint/unbound-method */
import { ListClipsUseCase } from './list-clips.usecase';
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

describe('ListClipsUseCase', () => {
  it('폴더가 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new ListClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { folderId: 'folder-id' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('커서 클립이 없으면 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new ListClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { cursor: 'clip-id' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('타입이 다르면 커서 에러를 던진다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
    } as never);

    const usecase = new ListClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { cursor: 'clip-id', type: 'COLOR' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('타이틀 검색을 우선 적용한다', async () => {
    const repo = createRepository();
    repo.hasTitleMatches.mockResolvedValue(true);
    repo.findClips.mockResolvedValue([
      { id: 'clip-1' },
      { id: 'clip-2' },
      { id: 'clip-3' },
    ] as never);

    const usecase = new ListClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      limit: 2,
      q: 'hello',
    });

    expect(repo.hasTitleMatches).toHaveBeenCalledWith({
      userId: 'user-id',
      folderId: undefined,
      workspaceId: undefined,
      type: undefined,
      q: 'hello',
      searchTarget: 'title',
      likedOnly: undefined,
    });
    expect(repo.findClips).toHaveBeenCalledWith({
      userId: 'user-id',
      cursor: undefined,
      limit: 2,
      type: undefined,
      q: 'hello',
      searchTarget: 'title',
      likedOnly: true,
      folderId: undefined,
      workspaceId: undefined,
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('clip-2');
  });
});
