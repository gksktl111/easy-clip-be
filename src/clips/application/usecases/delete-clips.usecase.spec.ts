/* eslint-disable @typescript-eslint/unbound-method */
import { ClipsError } from '../errors/clips.error';
import { DeleteClipsUseCase } from './delete-clips.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';

describe('DeleteClipsUseCase', () => {
  it('여러 클립을 소프트 삭제한다', async () => {
    const repo = createRepository();
    repo.softDeleteClips.mockResolvedValue(2);

    const usecase = new DeleteClipsUseCase(repo);
    const result = await usecase.execute('user-id', {
      clipIds: ['clip-1', 'clip-2'],
    });

    expect(repo.softDeleteClips).toHaveBeenCalledWith('user-id', [
      'clip-1',
      'clip-2',
    ]);
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
    repo.softDeleteClips.mockRejectedValue(
      new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.'),
    );

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: ['clip-1', 'missing-clip'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(repo.softDeleteClips).toHaveBeenCalledWith(
      'user-id',
      expect.any(Array),
    );
  });

  it('이미 삭제된 클립이 포함되면 전체 삭제를 실패시킨다', async () => {
    const repo = createRepository();
    repo.softDeleteClips.mockRejectedValue(
      new ClipsError('NOT_FOUND', '클립을 찾을 수 없습니다.'),
    );

    const usecase = new DeleteClipsUseCase(repo);

    await expect(
      usecase.execute('user-id', { clipIds: ['clip-1', 'deleted-clip'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(repo.softDeleteClips).toHaveBeenCalledWith(
      'user-id',
      expect.any(Array),
    );
  });
});
