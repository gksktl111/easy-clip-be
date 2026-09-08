/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { UpdateClipUseCase } from './update-clip.usecase';
import { createClipsRepositoryMock as createRepository } from '../../test-support/create-clips-repository-mock';
import type { Clip } from '../../domain/clip.types';
import type { ClipData } from '../helpers/clip-data.helper';
import type { ClipImageStoragePort } from 'src/shared/application/ports/clip-image-storage.port';
import type { MulterFile } from 'src/shared/types/multer-file.type';

const oldImageUrl = 'https://cdn.example.com/clips/user-id/old.png';
const newImageUrl = 'https://cdn.example.com/clips/user-id/new.png';
const file = {
  mimetype: 'image/png',
  originalname: 'new.png',
  size: 100,
} as MulterFile;

const createClip = (overrides: Partial<Clip> = {}): Clip => ({
  id: 'clip-id',
  type: 'TEXT',
  folderId: 'folder-id',
  workspaceId: 'workspace-id',
  title: 'old-text',
  textContent: 'old-text',
  colorHex: null,
  imageUrl: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

function setup(previousImageUrl: string | null = null) {
  const repo = createRepository();
  repo.findClipByIdForUser.mockResolvedValue(
    createClip({
      ...(previousImageUrl ? { type: 'IMAGE', textContent: null } : {}),
      imageUrl: previousImageUrl,
    }),
  );
  repo.updateClip.mockImplementation((_userId, _clipId, content) =>
    Promise.resolve({ clip: createClip(content), previousImageUrl }),
  );
  const storage: jest.Mocked<ClipImageStoragePort> = {
    uploadImage: jest.fn().mockResolvedValue({
      key: 'clips/user-id/new.png',
      url: newImageUrl,
    }),
    deleteImage: jest.fn().mockResolvedValue(undefined),
  };
  return { repo, storage, usecase: new UpdateClipUseCase(repo, storage) };
}

describe('UpdateClipUseCase', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it.each<[string, ClipData]>([
    [
      'hello',
      {
        type: 'TEXT',
        title: 'hello',
        textContent: 'hello',
        colorHex: null,
        imageUrl: null,
      },
    ],
    [
      '#fff',
      {
        type: 'COLOR',
        title: '#FFFFFF',
        textContent: null,
        colorHex: '#FFFFFF',
        imageUrl: null,
      },
    ],
  ])(
    'classifies %s and updates only content for the authenticated user',
    async (text, content) => {
      const { repo, storage, usecase } = setup();
      const result = await usecase.execute('user-id', {
        clipId: 'clip-id',
        text,
      });

      expect(repo.updateClip).toHaveBeenCalledWith(
        'user-id',
        'clip-id',
        content,
      );
      expect(result).toMatchObject(content);
      expect(storage.uploadImage).not.toHaveBeenCalled();
      expect(storage.deleteImage).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, '', '   '])(
    'rejects empty content %p without writing',
    async (text) => {
      const { repo, storage, usecase } = setup();
      await expect(
        usecase.execute('user-id', { clipId: 'clip-id', text }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(repo.updateClip).not.toHaveBeenCalled();
      expect(storage.uploadImage).not.toHaveBeenCalled();
      expect(storage.deleteImage).not.toHaveBeenCalled();
    },
  );

  it.each(['folderId', 'workspaceId'])(
    'rejects runtime %s even with valid content and a file',
    async (field) => {
      const { repo, storage, usecase } = setup();
      const input = { clipId: 'clip-id', text: 'hello', [field]: 'another-id' };
      await expect(
        usecase.execute('user-id', input, file),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(repo.findClipByIdForUser).not.toHaveBeenCalled();
      expect(repo.updateClip).not.toHaveBeenCalled();
      expect(storage.uploadImage).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing clip before uploading', async () => {
    const { repo, storage, usecase } = setup();
    repo.findClipByIdForUser.mockResolvedValue(null);
    await expect(
      usecase.execute('user-id', { clipId: 'missing-clip' }, file),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repo.updateClip).not.toHaveBeenCalled();
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });

  it('uploads a file and stores image content', async () => {
    const { repo, storage, usecase } = setup();
    const result = await usecase.execute(
      'user-id',
      { clipId: 'clip-id' },
      file,
    );
    expect(storage.uploadImage).toHaveBeenCalledWith({
      userId: 'user-id',
      file,
    });
    expect(repo.updateClip).toHaveBeenCalledWith('user-id', 'clip-id', {
      type: 'IMAGE',
      title: 'new.png',
      textContent: null,
      colorHex: null,
      imageUrl: newImageUrl,
    });
    expect(result.imageUrl).toBe(newImageUrl);
  });

  it('rejects SVG without uploading or writing', async () => {
    const { repo, storage, usecase } = setup();
    await expect(
      usecase.execute(
        'user-id',
        { clipId: 'clip-id' },
        {
          ...file,
          mimetype: 'image/svg+xml',
          originalname: 'vector.svg',
        },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(storage.uploadImage).not.toHaveBeenCalled();
    expect(repo.updateClip).not.toHaveBeenCalled();
  });

  it('cleans up the actual replaced image returned by the write instead of the stale pre-read image', async () => {
    const { repo, storage, usecase } = setup(oldImageUrl);
    const actualPreviousImage =
      'https://cdn.example.com/clips/user-id/intervening.png';
    repo.updateClip.mockResolvedValue({
      clip: createClip({
        type: 'IMAGE',
        textContent: null,
        imageUrl: newImageUrl,
      }),
      previousImageUrl: actualPreviousImage,
    });
    expect(
      (await usecase.execute('user-id', { clipId: 'clip-id' }, file)).imageUrl,
    ).toBe(newImageUrl);
    expect(storage.deleteImage).toHaveBeenCalledTimes(1);
    expect(storage.deleteImage).toHaveBeenCalledWith(actualPreviousImage);
  });

  it.each(['hello', '#fff'])(
    'deletes the replaced image when switching to %s',
    async (text) => {
      const { storage, usecase } = setup(oldImageUrl);
      expect(
        (await usecase.execute('user-id', { clipId: 'clip-id', text }))
          .imageUrl,
      ).toBeNull();
      expect(storage.deleteImage).toHaveBeenCalledWith(oldImageUrl);
    },
  );

  it('preserves an unchanged image URL', async () => {
    const { storage, usecase } = setup(newImageUrl);
    await usecase.execute('user-id', { clipId: 'clip-id' }, file);
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });

  it('returns the saved clip even when deleting its previous image fails', async () => {
    const { storage, usecase } = setup(oldImageUrl);
    storage.deleteImage.mockRejectedValue(new Error('storage unavailable'));
    expect(
      await usecase.execute('user-id', { clipId: 'clip-id', text: '#fff' }),
    ).toMatchObject({ type: 'COLOR', imageUrl: null });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('deletes an unreferenced upload after rollback and preserves the original write error', async () => {
    const { repo, storage, usecase } = setup(oldImageUrl);
    const writeError = new Error('transaction rolled back');
    repo.updateClip.mockRejectedValue(writeError);
    repo.isClipImageReferenced.mockResolvedValue(false);
    await expect(
      usecase.execute('user-id', { clipId: 'clip-id' }, file),
    ).rejects.toBe(writeError);
    expect(repo.isClipImageReferenced).toHaveBeenCalledWith(
      'clip-id',
      newImageUrl,
    );
    expect(storage.deleteImage).toHaveBeenCalledTimes(1);
    expect(storage.deleteImage).toHaveBeenCalledWith(newImageUrl);
  });

  it('cleans up the upload if the clip disappears before the write', async () => {
    const { repo, storage, usecase } = setup(oldImageUrl);
    repo.updateClip.mockResolvedValue(null);
    await expect(
      usecase.execute('user-id', { clipId: 'clip-id' }, file),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repo.isClipImageReferenced).toHaveBeenCalledWith(
      'clip-id',
      newImageUrl,
    );
    expect(storage.deleteImage).toHaveBeenCalledWith(newImageUrl);
  });

  it('preserves a committed upload when the write response was lost', async () => {
    const { repo, storage, usecase } = setup(oldImageUrl);
    const writeError = new Error('commit response lost');
    repo.updateClip.mockRejectedValue(writeError);
    repo.isClipImageReferenced.mockResolvedValue(true);
    await expect(
      usecase.execute('user-id', { clipId: 'clip-id' }, file),
    ).rejects.toBe(writeError);
    expect(repo.isClipImageReferenced).toHaveBeenCalledWith(
      'clip-id',
      newImageUrl,
    );
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });

  it.each(['reference lookup', 'upload deletion'])(
    'does not mask the write error when %s fails',
    async (failure) => {
      const { repo, storage, usecase } = setup(oldImageUrl);
      const writeError = new Error('write failed');
      repo.updateClip.mockRejectedValue(writeError);
      if (failure === 'reference lookup') {
        repo.isClipImageReferenced.mockRejectedValue(
          new Error('database unavailable'),
        );
      } else {
        storage.deleteImage.mockRejectedValue(new Error('storage unavailable'));
      }
      await expect(
        usecase.execute('user-id', { clipId: 'clip-id' }, file),
      ).rejects.toBe(writeError);
      if (failure === 'reference lookup') {
        expect(storage.deleteImage).not.toHaveBeenCalled();
      } else {
        expect(storage.deleteImage).toHaveBeenCalledWith(newImageUrl);
      }
      expect(warnSpy).toHaveBeenCalled();
    },
  );
});
