/* eslint-disable @typescript-eslint/unbound-method */
import { SaveClipUseCase } from './save-clip.usecase';
import { ClipsRepository } from '../../domain/clips.repository';

const createRepository = (): jest.Mocked<ClipsRepository> => ({
  findPersonalFolderById: jest.fn(),
  findClipByIdForUser: jest.fn(),
  createClip: jest.fn(),
  updateClip: jest.fn(),
  softDeleteClip: jest.fn(),
});

describe('SaveClipUseCase', () => {
  it('create 모드에서 text로 클립을 생성하면 TEXT로 저장한다', async () => {
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

    const usecase = new SaveClipUseCase(repo);
    const result = await usecase.execute('user-id', {
      mode: 'create',
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

  it('create 모드에서 폴더가 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue(null);

    const usecase = new SaveClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        mode: 'create',
        folderId: 'missing-folder-id',
        text: 'hello',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('create 모드에서 색상 문자열을 보내면 COLOR로 저장한다', async () => {
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

    const usecase = new SaveClipUseCase(repo);
    const result = await usecase.execute('user-id', {
      mode: 'create',
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

  it('create 모드에서 file이 있으면 IMAGE로 저장하고 text는 무시한다', async () => {
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
    } as Express.Multer.File;

    const usecase = new SaveClipUseCase(repo);
    const result = await usecase.execute(
      'user-id',
      {
        mode: 'create',
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

  it('create 모드에서 file이 있지만 image/*가 아니면 실패한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    const file = {
      mimetype: 'application/pdf',
      originalname: 'a.pdf',
    } as Express.Multer.File;

    const usecase = new SaveClipUseCase(repo);

    await expect(
      usecase.execute(
        'user-id',
        {
          mode: 'create',
          folderId: 'folder-id',
        },
        file,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('create 모드에서 text와 file이 모두 없으면 실패한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    const usecase = new SaveClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        mode: 'create',
        folderId: 'folder-id',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('update 모드에서 text가 오면 타입을 재판별해 저장한다', async () => {
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

    const usecase = new SaveClipUseCase(repo);
    const result = await usecase.execute('user-id', {
      mode: 'update',
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

  it('update 모드에서 폴더가 없으면 NOT_FOUND 오류를 반환한다', async () => {
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

    const usecase = new SaveClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        mode: 'update',
        clipId: 'clip-id',
        folderId: 'missing-folder',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('update 모드에서 클립이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);

    const usecase = new SaveClipUseCase(repo);

    await expect(
      usecase.execute('user-id', {
        mode: 'update',
        clipId: 'missing-clip-id',
        text: 'hi',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
