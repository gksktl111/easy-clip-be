/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteClipsUseCase } from './delete-clips.usecase';
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
  softDeleteClips: jest.fn(),
  softDeleteAllClipsForUser: jest.fn(),
});

describe('DeleteClipsUseCase', () => {
  it('여러 클립을 소프트 삭제한다', async () => {
    const repo = createRepository();
    repo.findClipsByIdsForUser.mockResolvedValue([
      { id: 'clip-1' },
      { id: 'clip-2' },
    ] as never);
    repo.softDeleteClips.mockResolvedValue(2);

    const usecase = new DeleteClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      clipIds: ['clip-1', 'clip-2'],
    });

    expect(repo.findClipsByIdsForUser).toHaveBeenCalledWith('user-id', [
      'clip-1',
      'clip-2',
    ]);
    expect(repo.softDeleteClips).toHaveBeenCalledWith(['clip-1', 'clip-2']);
    expect(result).toEqual({ deletedCount: 2 });
  });

  it('clipIds가 비어있으면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: [] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findClipsByIdsForUser).not.toHaveBeenCalled();
    expect(repo.softDeleteClips).not.toHaveBeenCalled();
  });

  it('빈 클립 ID가 포함되면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: ['clip-1', '   '] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findClipsByIdsForUser).not.toHaveBeenCalled();
    expect(repo.softDeleteClips).not.toHaveBeenCalled();
  });

  it('중복 ID가 포함되면 BAD_REQUEST 에러를 던진다', async () => {
    const repo = createRepository();

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: ['clip-1', 'clip-1'] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(repo.findClipsByIdsForUser).not.toHaveBeenCalled();
    expect(repo.softDeleteClips).not.toHaveBeenCalled();
  });

  it('존재하지 않거나 사용자 소유가 아닌 클립이 포함되면 전체 삭제를 실패시킨다', async () => {
    const repo = createRepository();
    repo.findClipsByIdsForUser.mockResolvedValue([{ id: 'clip-1' }] as never);

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: ['clip-1', 'missing-clip'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(repo.softDeleteClips).not.toHaveBeenCalled();
  });

  it('이미 삭제된 클립이 포함되면 전체 삭제를 실패시킨다', async () => {
    const repo = createRepository();
    repo.findClipsByIdsForUser.mockResolvedValue([{ id: 'clip-1' }] as never);

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: ['clip-1', 'deleted-clip'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(repo.softDeleteClips).not.toHaveBeenCalled();
  });
});
