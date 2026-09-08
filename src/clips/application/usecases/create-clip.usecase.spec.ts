/* eslint-disable @typescript-eslint/unbound-method */
import { CreateClipUseCase } from './create-clip.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';
import { MulterFile } from 'src/shared/types/multer-file.type';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
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
    expect(repo.createClip).toHaveBeenCalledWith('user-id', {
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

    expect(repo.createClip).toHaveBeenCalledWith('user-id', {
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

    expect(repo.createClip).toHaveBeenCalledWith('user-id', {
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

    expect(repo.createClip).toHaveBeenCalledWith('user-id', {
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
  it.each([false, true])(
    '생성 실패 후 DB 이미지 참조=%s에 따라 업로드를 정리한다',
    async (referenced) => {
      const repo = createRepository();
      repo.findPersonalFolderById.mockResolvedValue({
        id: 'folder-id',
        workspaceId: 'workspace-id',
      });
      const error = new Error('create failed or response lost');
      repo.createClip.mockRejectedValue(error);
      repo.isCreatedImageReferenced.mockResolvedValue(referenced);
      const storage = createImageStorage();
      storage.uploadImage.mockResolvedValue({
        key: 'new.png',
        url: 'https://test.invalid/new.png',
      });
      await expect(
        new CreateClipUseCase(repo, storage).execute(
          'user-id',
          { folderId: 'folder-id' },
          {
            mimetype: 'image/png',
            originalname: 'new.png',
            size: 1,
          } as MulterFile,
        ),
      ).rejects.toBe(error);
      expect(repo.isCreatedImageReferenced).toHaveBeenCalledWith(
        'user-id',
        'https://test.invalid/new.png',
      );
      if (referenced) expect(storage.deleteImage).not.toHaveBeenCalled();
      else
        expect(storage.deleteImage).toHaveBeenCalledWith(
          'https://test.invalid/new.png',
        );
    },
  );
});
