/* eslint-disable @typescript-eslint/unbound-method */
import { ClipsRepository } from '../../domain/clips.repository';
import {
  ListRecentViewedClipsUseCase,
  RECENT_VIEWED_CLIPS_LIMIT,
} from './list-recent-viewed-clips.usecase';

const createRepository = (): jest.Mocked<ClipsRepository> => ({
  findPersonalFolderById: jest.fn(),
  findClipByIdForUser: jest.fn(),
  findClips: jest.fn(),
  findRecentClips: jest.fn(),
  findRecentViewedClipIds: jest.fn(),
  findClipsByIdsForUser: jest.fn(),
  hasTitleMatches: jest.fn(),
  hasRecentTitleMatches: jest.fn(),
  isClipMatchingQuery: jest.fn(),
  isRecentCursorMatchingQuery: jest.fn(),
  createClipView: jest.fn(),
  isClipLikedByUser: jest.fn(),
  createClipLike: jest.fn(),
  deleteClipLike: jest.fn(),
  createClip: jest.fn(),
  updateClip: jest.fn(),
  softDeleteClip: jest.fn(),
  softDeleteClips: jest.fn(),
  softDeleteAllClipsInFolder: jest.fn(),
});

const createClipItem = (id: string) => ({
  id,
  type: 'TEXT' as const,
  title: `${id}-title`,
  textContent: `${id}-text`,
  colorHex: null,
  imageUrl: null,
  workspaceId: 'workspace-id',
  folderId: 'folder-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  tags: [],
  likeByMe: false,
});

describe('ListRecentViewedClipsUseCase', () => {
  it('최근 조회 기록이 없으면 빈 배열을 반환한다', async () => {
    const repo = createRepository();
    repo.findRecentViewedClipIds.mockResolvedValue([]);

    const usecase = new ListRecentViewedClipsUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.findRecentViewedClipIds).toHaveBeenCalledWith(
      'user-id',
      RECENT_VIEWED_CLIPS_LIMIT,
    );
    expect(repo.findClipsByIdsForUser).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [] });
  });

  it('clipId별 최신 viewedAt 순서로 클립을 반환한다', async () => {
    const repo = createRepository();
    repo.findRecentViewedClipIds.mockResolvedValue(['clip-2', 'clip-1']);
    repo.findClipsByIdsForUser.mockResolvedValue([
      createClipItem('clip-1'),
      createClipItem('clip-2'),
    ]);

    const usecase = new ListRecentViewedClipsUseCase(repo);
    const result = await usecase.execute('user-id');

    expect(repo.findClipsByIdsForUser).toHaveBeenCalledWith('user-id', [
      'clip-2',
      'clip-1',
    ]);
    expect(result.items.map((item) => item.id)).toEqual(['clip-2', 'clip-1']);
  });
});
