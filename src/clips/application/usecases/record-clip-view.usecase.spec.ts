/* eslint-disable @typescript-eslint/unbound-method */
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';
import { RecordClipViewUseCase } from './record-clip-view.usecase';

describe('RecordClipViewUseCase', () => {
  it('내 클립이 아니면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new RecordClipViewUseCase(repo);

    await expect(usecase.execute('user-id', 'clip-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(repo.createClipView).not.toHaveBeenCalled();
  });

  it('내 클립이면 조회 이벤트를 기록한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      title: 'title',
      textContent: 'text',
      colorHex: null,
      imageUrl: null,
      workspaceId: 'workspace-id',
      folderId: 'folder-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const usecase = new RecordClipViewUseCase(repo);
    await usecase.execute('user-id', 'clip-id');

    expect(repo.createClipView).toHaveBeenCalledWith('user-id', 'clip-id');
  });
});
