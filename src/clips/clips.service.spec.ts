import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClipType, Prisma, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClipsService } from './clips.service';

// ClipsService는 폴더 소유권과 multipart 기반 타입 판별 흐름을 검증한다.
describe('ClipsService', () => {
  let service: ClipsService;

  type FolderResult = {
    id: string;
    workspaceId: string;
    deletedAt?: Date | null;
  };
  type ClipResult = {
    id: string;
    type: ClipType;
    folderId: string;
    workspaceId: string;
    title: string;
    textContent?: string | null;
    colorHex?: string | null;
    imageUrl?: string | null;
    deletedAt?: Date | null;
  };

  const prisma = {
    folder: {
      findFirst: jest.fn<
        Promise<FolderResult | null>,
        [Prisma.FolderFindFirstArgs]
      >(),
    },
    clip: {
      create: jest.fn<Promise<ClipResult>, [Prisma.ClipCreateArgs]>(),
      findFirst: jest.fn<
        Promise<ClipResult | null>,
        [Prisma.ClipFindFirstArgs]
      >(),
      update: jest.fn<Promise<ClipResult>, [Prisma.ClipUpdateArgs]>(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClipsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ClipsService>(ClipsService);
    jest.clearAllMocks();
  });

  it('text로 클립을 생성하면 TEXT로 저장한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    prisma.clip.create.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.TEXT,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
    });

    const result = await service.createClip('user-id', {
      folderId: 'folder-id',
      text: 'hello',
    });

    expect(prisma.folder.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'folder-id',
        deletedAt: null,
        workspace: {
          ownerUserId: 'user-id',
          type: WorkspaceType.PERSONAL,
        },
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });
    expect(prisma.clip.create).toHaveBeenCalledWith({
      data: {
        type: ClipType.TEXT,
        title: 'hello',
        folderId: 'folder-id',
        workspaceId: 'workspace-id',
        textContent: 'hello',
        colorHex: null,
        imageUrl: null,
      },
    });
    expect(result.id).toBe('clip-id');
  });

  it('폴더를 찾을 수 없으면 생성에 실패한다', async () => {
    prisma.folder.findFirst.mockResolvedValue(null);

    await expect(
      service.createClip('user-id', {
        folderId: 'missing-folder-id',
        text: 'hello',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('색상 문자열을 보내면 COLOR로 저장한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    prisma.clip.create.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.COLOR,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: '#FFFFFF',
      textContent: null,
      colorHex: '#FFFFFF',
      imageUrl: null,
    });

    const result = await service.createClip('user-id', {
      folderId: 'folder-id',
      text: '#fff',
    });

    expect(prisma.clip.create).toHaveBeenCalledWith({
      data: {
        type: ClipType.COLOR,
        title: '#FFFFFF',
        folderId: 'folder-id',
        workspaceId: 'workspace-id',
        textContent: null,
        colorHex: '#FFFFFF',
        imageUrl: null,
      },
    });
    expect(result.type).toBe(ClipType.COLOR);
  });

  it('update에서 text가 오면 타입을 재판별해 저장한다', async () => {
    prisma.clip.findFirst.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.TEXT,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'old-text',
      textContent: 'old-text',
      colorHex: null,
      imageUrl: null,
    });
    prisma.clip.update.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.COLOR,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: '#FFFFFF',
      textContent: null,
      colorHex: '#FFFFFF',
      imageUrl: null,
    });

    const result = await service.updateClip('user-id', 'clip-id', {
      text: '#fff',
    });

    expect(prisma.clip.update).toHaveBeenCalledWith({
      where: { id: 'clip-id' },
      data: {
        type: ClipType.COLOR,
        title: '#FFFFFF',
        folderId: 'folder-id',
        workspaceId: 'workspace-id',
        textContent: null,
        colorHex: '#FFFFFF',
        imageUrl: null,
      },
    });
    expect(result.type).toBe(ClipType.COLOR);
  });

  it('file이 있으면 IMAGE로 저장하고 text는 무시한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    prisma.clip.create.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.IMAGE,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'image.png',
      textContent: null,
      colorHex: null,
      imageUrl: 'image.png',
    });

    const file = {
      mimetype: 'image/png',
      originalname: 'image.png',
    } as Express.Multer.File;

    const result = await service.createClip(
      'user-id',
      {
        folderId: 'folder-id',
        text: '#fff',
      },
      file,
    );

    expect(prisma.clip.create).toHaveBeenCalledWith({
      data: {
        type: ClipType.IMAGE,
        title: 'image.png',
        folderId: 'folder-id',
        workspaceId: 'workspace-id',
        textContent: null,
        colorHex: null,
        imageUrl: 'image.png',
      },
    });
    expect(result.type).toBe(ClipType.IMAGE);
  });

  it('file이 있지만 image/*가 아니면 실패한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    const file = {
      mimetype: 'application/pdf',
      originalname: 'a.pdf',
    } as Express.Multer.File;

    await expect(
      service.createClip(
        'user-id',
        {
          folderId: 'folder-id',
        },
        file,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('text와 file이 모두 없으면 실패한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });

    await expect(
      service.createClip('user-id', {
        folderId: 'folder-id',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('클립 삭제는 deletedAt을 기록하는 소프트 삭제로 처리한다', async () => {
    prisma.clip.findFirst.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.TEXT,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
    });
    prisma.clip.update.mockResolvedValue({
      id: 'clip-id',
      type: ClipType.TEXT,
      folderId: 'folder-id',
      workspaceId: 'workspace-id',
      title: 'hello',
      textContent: 'hello',
      colorHex: null,
      imageUrl: null,
      deletedAt: new Date(),
    });

    const result = await service.deleteClip('user-id', 'clip-id');

    expect(prisma.clip.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.clip.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'clip-id' });
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
    expect(result.id).toBe('clip-id');
  });
});
