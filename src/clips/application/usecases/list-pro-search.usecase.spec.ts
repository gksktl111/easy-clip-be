/* eslint-disable @typescript-eslint/unbound-method */
import { ListFolderClipsUseCase } from './list-folder-clips.usecase';
import { ListFavoriteClipsUseCase } from './list-favorite-clips.usecase';
import { ListRecentClipsUseCase } from './list-recent-clips.usecase';
import { createClipsRepositoryMock } from '../../test-support/create-clips-repository-mock';
import { FolderAccessError } from 'src/shared/application/folder-access';

const usecases = [
  ListFolderClipsUseCase,
  ListFavoriteClipsUseCase,
  ListRecentClipsUseCase,
];

describe.each(usecases)('%p search entitlement', (UseCase) => {
  const setup = () => {
    const repo = createClipsRepositoryMock();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder',
      workspaceId: 'workspace',
    });
    repo.findClips.mockResolvedValue([]);
    repo.findRecentClips.mockResolvedValue([]);
    return { repo, usecase: new UseCase(repo) };
  };

  it('rejects search before title/tag lookups or cursor reads', async () => {
    const { repo, usecase } = setup();
    repo.assertSearchAvailable.mockRejectedValue(
      new FolderAccessError('FEATURE_NOT_AVAILABLE', 'Pro required'),
    );
    await expect(
      usecase.execute('user', {
        folderId: 'folder',
        q: '  needle  ',
        cursor: 'previous-pro-cursor',
        type: 'ALL',
      }),
    ).rejects.toMatchObject({ policyCode: 'FEATURE_NOT_AVAILABLE' });
    expect(repo.assertSearchAvailable).toHaveBeenCalledWith('user');
    expect(repo.hasTitleMatches).not.toHaveBeenCalled();
    expect(repo.hasRecentTitleMatches).not.toHaveBeenCalled();
    expect(repo.findClipByIdForUser).not.toHaveBeenCalled();
    expect(repo.isClipMatchingQuery).not.toHaveBeenCalled();
    expect(repo.isRecentCursorMatchingQuery).not.toHaveBeenCalled();
    expect(repo.findClips).not.toHaveBeenCalled();
    expect(repo.findRecentClips).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'allows a normal list with q=%p without requiring Pro',
    async (q) => {
      const { repo, usecase } = setup();
      await expect(
        usecase.execute('user', { folderId: 'folder', q, type: 'TEXT' }),
      ).resolves.toMatchObject({ items: [] });
      expect(repo.assertSearchAvailable).not.toHaveBeenCalled();
      expect(repo.hasTitleMatches).not.toHaveBeenCalled();
      expect(repo.hasRecentTitleMatches).not.toHaveBeenCalled();
    },
  );
});
