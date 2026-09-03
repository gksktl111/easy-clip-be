/* eslint-disable @typescript-eslint/unbound-method */
import { ReplaceClipTagsUseCase } from './replace-clip-tags.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

const clip = {
  id: 'clip-id',
  type: 'TEXT' as const,
  title: '클립',
  textContent: '내용',
  colorHex: null,
  imageUrl: null,
  folderId: 'folder-id',
  workspaceId: 'workspace-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('ReplaceClipTagsUseCase', () => {
  it('태그 이름 목록으로 클립 태그를 전체 교체한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(clip);
    repo.replaceClipTags.mockResolvedValue([
      { id: 'tag-2', name: 'frontend', backgroundColor: 'GRAY' },
      { id: 'tag-1', name: 'backend', backgroundColor: 'PURPLE' },
    ]);
    const usecase = new ReplaceClipTagsUseCase(repo);

    const result = await usecase.execute('user-id', {
      clipId: 'clip-id',
      tags: ['frontend', 'backend'],
    });

    expect(repo.replaceClipTags).toHaveBeenCalledWith({
      clipId: 'clip-id',
      folderId: 'folder-id',
      tagNames: ['frontend', 'backend'],
    });
    expect(result).toEqual({
      tags: [
        { id: 'tag-2', name: 'frontend', backgroundColor: 'GRAY' },
        { id: 'tag-1', name: 'backend', backgroundColor: 'PURPLE' },
      ],
    });
  });

  it('빈 배열이면 모든 태그 연결을 해제한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(clip);
    repo.replaceClipTags.mockResolvedValue([]);
    const usecase = new ReplaceClipTagsUseCase(repo);

    const result = await usecase.execute('user-id', {
      clipId: 'clip-id',
      tags: [],
    });

    expect(repo.replaceClipTags).toHaveBeenCalledWith({
      clipId: 'clip-id',
      folderId: 'folder-id',
      tagNames: [],
    });
    expect(result).toEqual({ tags: [] });
  });

  it('완전히 같은 태그 이름만 하나로 정규화한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(clip);
    repo.replaceClipTags.mockResolvedValue([
      { id: 'tag-1', name: 'Backend', backgroundColor: 'GRAY' },
      { id: 'tag-2', name: 'backend ', backgroundColor: 'GRAY' },
    ]);
    const usecase = new ReplaceClipTagsUseCase(repo);

    await usecase.execute('user-id', {
      clipId: 'clip-id',
      tags: ['Backend', 'backend ', 'Backend'],
    });

    expect(repo.replaceClipTags).toHaveBeenCalledWith({
      clipId: 'clip-id',
      folderId: 'folder-id',
      tagNames: ['Backend', 'backend '],
    });
  });

  it('공백을 포함해 10자인 태그명을 허용한다', async () => {
    const repo = createRepository();
    const tagName = `${'a'.repeat(9)} `;
    repo.findClipByIdForUser.mockResolvedValue(clip);
    repo.replaceClipTags.mockResolvedValue([
      { id: 'tag-id', name: tagName, backgroundColor: 'GRAY' },
    ]);
    const usecase = new ReplaceClipTagsUseCase(repo);

    await usecase.execute('user-id', {
      clipId: 'clip-id',
      tags: [tagName],
    });

    expect(repo.replaceClipTags).toHaveBeenCalledWith({
      clipId: 'clip-id',
      folderId: 'folder-id',
      tagNames: [tagName],
    });
  });

  it.each(['   ', 'a'.repeat(11)])(
    '공백만이거나 공백을 포함해 10자를 초과한 태그명은 거부한다: %s',
    async (tagName) => {
      const repo = createRepository();
      repo.findClipByIdForUser.mockResolvedValue(clip);
      const usecase = new ReplaceClipTagsUseCase(repo);

      await expect(
        usecase.execute('user-id', {
          clipId: 'clip-id',
          tags: [tagName],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      expect(repo.replaceClipTags).not.toHaveBeenCalled();
    },
  );

  it('소유하거나 활성 상태가 아닌 클립이면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);
    const usecase = new ReplaceClipTagsUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        clipId: 'missing-clip-id',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
