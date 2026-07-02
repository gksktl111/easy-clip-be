/* eslint-disable @typescript-eslint/unbound-method */
import { DeleteAllClipsUseCase } from './delete-all-clips.usecase';
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

describe('DeleteAllClipsUseCase', () => {
  it('사용자 소유 클립을 전체 소프트 삭제한다', async () => {
    const repo = createRepository();
    repo.softDeleteAllClipsForUser.mockResolvedValue(3);

    const usecase = new DeleteAllClipsUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.softDeleteAllClipsForUser).toHaveBeenCalledWith('user-id');
    expect(result).toEqual({ deletedCount: 3 });
  });

  it('삭제할 클립이 없어도 0개 삭제 결과를 반환한다', async () => {
    const repo = createRepository();
    repo.softDeleteAllClipsForUser.mockResolvedValue(0);

    const usecase = new DeleteAllClipsUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(result).toEqual({ deletedCount: 0 });
  });
});
