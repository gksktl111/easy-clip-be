/* eslint-disable @typescript-eslint/unbound-method */
import { CreateClipUseCase } from './create-clip.usecase';
import { ClipsRepository } from '../../domain/clips.repository';
import { MulterFile } from 'src/shared/types/multer-file.type';
import { ClipImageStoragePort } from '../ports/clip-image-storage.port';

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

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
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

    const imageStorage = createImageStorage();
    const usecase = new CreateClipUseCase(repo, imageStorage);
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
    const imageStorage = createImageStorage();

    const usecase = new CreateClipUseCase(repo, imageStorage);

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

    const imageStorage = createImageStorage();
    const usecase = new CreateClipUseCase(repo, imageStorage);
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
      imageUrl: 'https://cdn.example.com/clips/user-id/file.png',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const imageStorage = createImageStorage();
    imageStorage.uploadImage.mockResolvedValue({
      key: 'clips/user-id/file.png',
      url: 'https://cdn.example.com/clips/user-id/file.png',
    });

    const file = {
      mimetype: 'image/png',
      originalname: 'image.png',
      size: 100,
    } as MulterFile;

    const usecase = new CreateClipUseCase(repo, imageStorage);
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
      imageUrl: 'https://cdn.example.com/clips/user-id/file.png',
    });
    expect(imageStorage.uploadImage).toHaveBeenCalledWith({
      userId: 'user-id',
      file,
    });
    expect(result.type).toBe('IMAGE');
  });

  it('한글 파일명은 깨지지 않도록 title에 정규화해서 저장한다', async () => {
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
      title: '다운로드.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/file.png',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const imageStorage = createImageStorage();
    imageStorage.uploadImage.mockResolvedValue({
      key: 'clips/user-id/file.png',
      url: 'https://cdn.example.com/clips/user-id/file.png',
    });

    const file = {
      mimetype: 'image/png',
      originalname: 'ë¤ì´ë¡ë.png',
      size: 100,
    } as MulterFile;

    const usecase = new CreateClipUseCase(repo, imageStorage);

    await usecase.execute(
      'user-id',
      {
        folderId: 'folder-id',
      },
      file,
    );

    expect(repo.createClip).toHaveBeenCalledWith({
      type: 'IMAGE',
      title: '다운로드.png',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/file.png',
    });
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
      size: 100,
    } as MulterFile;
    const imageStorage = createImageStorage();

    const usecase = new CreateClipUseCase(repo, imageStorage);

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

  it('SVG 이미지는 업로드하지 않고 거부한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    const file = {
      mimetype: 'image/svg+xml',
      originalname: 'vector.svg',
      size: 100,
    } as MulterFile;
    const imageStorage = createImageStorage();

    const usecase = new CreateClipUseCase(repo, imageStorage);

    await expect(
      usecase.execute(
        'user-id',
        {
          folderId: 'folder-id',
        },
        file,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(imageStorage.uploadImage).not.toHaveBeenCalled();
  });

  it('text와 file이 모두 없으면 실패한다', async () => {
    const repo = createRepository();
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    const imageStorage = createImageStorage();

    const usecase = new CreateClipUseCase(repo, imageStorage);

    await expect(
      usecase.execute('user-id', {
        folderId: 'folder-id',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
