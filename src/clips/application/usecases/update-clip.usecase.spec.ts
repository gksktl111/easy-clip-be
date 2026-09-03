/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { UpdateClipUseCase } from './update-clip.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';
import { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';
import { MulterFile } from 'src/shared/types/multer-file.type';

const createImageStorage = (): jest.Mocked<ClipImageStoragePort> => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
});

describe('UpdateClipUseCase', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('text가 오면 타입을 재판별해 저장한다', async () => {
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

    const imageStorage = createImageStorage();
    const usecase = new UpdateClipUseCase(repo, imageStorage);
    const result = await usecase.execute('user-id', {
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

  it('폴더가 없으면 NOT_FOUND 오류를 반환한다', async () => {
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
    const imageStorage = createImageStorage();

    const usecase = new UpdateClipUseCase(repo, imageStorage);

    await expect(
      usecase.execute('user-id', {
        clipId: 'clip-id',
        folderId: 'missing-folder',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('클립이 없으면 NOT_FOUND 오류를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue(null);
    const imageStorage = createImageStorage();

    const usecase = new UpdateClipUseCase(repo, imageStorage);

    await expect(
      usecase.execute('user-id', {
        clipId: 'missing-clip-id',
        text: 'hi',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('다른 폴더로 이동하면 기존 태그 연결 해제를 요청한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'TEXT',
      folderId: 'old-folder-id',
      workspaceId: 'old-workspace-id',
      title: 'old-text',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repo.findPersonalFolderById.mockResolvedValue({
      id: 'new-folder-id',
      workspaceId: 'new-workspace-id',
    } as never);
    repo.updateClip.mockResolvedValue({ id: 'clip-id' } as never);
    const imageStorage = createImageStorage();

    const usecase = new UpdateClipUseCase(repo, imageStorage);
    await usecase.execute('user-id', {
      clipId: 'clip-id',
      folderId: 'new-folder-id',
    });

    expect(repo.updateClip).toHaveBeenCalledWith('clip-id', {
      type: 'TEXT',
      title: 'old-text',
      folderId: 'new-folder-id',
      workspaceId: 'new-workspace-id',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
      clearTags: true,
    });
  });

  it('text와 file이 모두 없으면 기존 데이터를 유지한다', async () => {
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
    repo.updateClip.mockResolvedValue({ id: 'clip-id' } as never);
    const imageStorage = createImageStorage();

    const usecase = new UpdateClipUseCase(repo, imageStorage);
    await usecase.execute('user-id', {
      clipId: 'clip-id',
    });

    expect(repo.updateClip).toHaveBeenCalledWith('clip-id', {
      type: 'TEXT',
      title: 'old-text',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
    });
  });

  it('file이 오면 업로드 후 IMAGE로 저장한다', async () => {
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
      type: 'IMAGE',
    } as never);

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

    const usecase = new UpdateClipUseCase(repo, imageStorage);
    await usecase.execute(
      'user-id',
      {
        clipId: 'clip-id',
      },
      file,
    );

    expect(imageStorage.uploadImage).toHaveBeenCalledWith({
      userId: 'user-id',
      file,
    });
    expect(repo.updateClip).toHaveBeenCalledWith('clip-id', {
      type: 'IMAGE',
      title: 'image.png',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/file.png',
    });
  });

  it('이미지 클립을 새 이미지로 교체하면 이전 R2 객체를 삭제한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'IMAGE',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/old.png',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repo.updateClip.mockResolvedValue({
      id: 'clip-id',
      type: 'IMAGE',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'new.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/new.png',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const imageStorage = createImageStorage();
    imageStorage.uploadImage.mockResolvedValue({
      key: 'clips/user-id/new.png',
      url: 'https://cdn.example.com/clips/user-id/new.png',
    });

    const file = {
      mimetype: 'image/png',
      originalname: 'new.png',
      size: 100,
    } as MulterFile;

    const usecase = new UpdateClipUseCase(repo, imageStorage);
    const result = await usecase.execute(
      'user-id',
      {
        clipId: 'clip-id',
      },
      file,
    );

    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-id/old.png',
    );
    expect(result.imageUrl).toBe(
      'https://cdn.example.com/clips/user-id/new.png',
    );
  });

  it('이미지 클립을 텍스트/컬러 클립으로 바꾸면 이전 R2 객체를 삭제한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'IMAGE',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/old.png',
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
    const imageStorage = createImageStorage();

    const usecase = new UpdateClipUseCase(repo, imageStorage);
    const result = await usecase.execute('user-id', {
      clipId: 'clip-id',
      text: '#fff',
    });

    expect(imageStorage.deleteImage).toHaveBeenCalledWith(
      'https://cdn.example.com/clips/user-id/old.png',
    );
    expect(result.imageUrl).toBeNull();
  });

  it('이전 R2 객체 삭제가 실패해도 클립 수정 결과를 반환한다', async () => {
    const repo = createRepository();
    repo.findClipByIdForUser.mockResolvedValue({
      id: 'clip-id',
      type: 'IMAGE',
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'https://cdn.example.com/clips/user-id/old.png',
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
    const imageStorage = createImageStorage();
    imageStorage.deleteImage.mockRejectedValue(new Error('r2 failed'));

    const usecase = new UpdateClipUseCase(repo, imageStorage);
    const result = await usecase.execute('user-id', {
      clipId: 'clip-id',
      text: '#fff',
    });

    expect(result.type).toBe('COLOR');
  });

  it('SVG 이미지는 업로드하지 않고 거부한다', async () => {
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
    const imageStorage = createImageStorage();
    const file = {
      mimetype: 'image/svg+xml',
      originalname: 'vector.svg',
      size: 100,
    } as MulterFile;

    const usecase = new UpdateClipUseCase(repo, imageStorage);

    await expect(
      usecase.execute(
        'user-id',
        {
          clipId: 'clip-id',
        },
        file,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(imageStorage.uploadImage).not.toHaveBeenCalled();
  });
});
