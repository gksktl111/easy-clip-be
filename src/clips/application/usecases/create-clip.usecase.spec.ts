/* eslint-disable @typescript-eslint/unbound-method */
import { CreateClipUseCase } from './create-clip.usecase';
import { ClipsRepository } from '../../domain/clips.repository';
import { MulterFile } from 'src/shared/types/multer-file.type';

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

describe('CreateClipUseCase', () => {
  it('text로 클립을 생성하면 TEXT로 저장한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    repo.createClip.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const usecase = new CreateClipUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      text: 'hello',
    });

    expect(repo.findPersonalFolderById).toHaveBeenCalledWith(
      'user-id',
      'folder-id',
    );
    expect(repo.createClip).toHaveBeenCalledWith({
      type: 'TEXT',
      title: 'hello',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
    });
    expect(result.id).toBe('clip-id');
  });

  it('폴더가 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new CreateClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'missing-folder-id',
        text: 'hello',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('색상 문자열을 보내면 COLOR로 저장한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    repo.createClip.mockResolvedValue({
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

    const usecase = new CreateClipUseCase(repo);
    const result = await usecase.execute('user-id', {
      folderId: 'folder-id',
      text: '#fff',
    });

    expect(repo.createClip).toHaveBeenCalledWith({
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

  it('file이 있으면 IMAGE로 저장하고 text는 무시한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    repo.createClip.mockResolvedValue({
      id: 'clip-id',
      type: 'IMAGE',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'image.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'image.png',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const file = {
      mimetype: 'image/png',
      originalname: 'image.png',
    } as MulterFile;

    const usecase = new CreateClipUseCase(repo);
    const result = await usecase.execute(
      'user-id',
      {
        folderId: 'folder-id',
        text: '#fff',
      },
      file,
    );

    expect(repo.createClip).toHaveBeenCalledWith({
      type: 'IMAGE',
      title: 'image.png',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: null,
      colorHex: null,
      imageUrl: 'image.png',
    });
    expect(result.type).toBe('IMAGE');
  });

  it('file이 있지만 image/*가 아니면 실패한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    const file = {
      mimetype: 'application/pdf',
      originalname: 'a.pdf',
    } as MulterFile;

    const usecase = new CreateClipUseCase(repo);

    await expect(
      usecase.execute(
        'user-id',
        {
          folderId: 'folder-id',
        },
        file,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('text와 file이 모두 없으면 실패한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    const usecase = new CreateClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
