import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  let service: FoldersService;
  type FolderResult = {
    id: string;
    name?: string;
    order?: number;
    workspaceId?: string;
    deletedAt?: Date | null;
  };
  type ClipResult = {
    id: string;
    folderId?: string;
    workspaceId?: string;
    updatedAt?: Date;
    createdAt?: Date;
    deletedAt?: Date | null;
  };
  // Prisma는 DB와 분리된 단위 테스트를 위해 목 처리한다.
  const prisma = {
    workspace: {
      findUnique: jest.fn<
        Promise<{ id: string } | null>,
        [Prisma.WorkspaceFindUniqueArgs]
      >(),
      upsert: jest.fn<Promise<{ id: string }>, [Prisma.WorkspaceUpsertArgs]>(),
    },
    folder: {
      findFirst: jest.fn<
        Promise<FolderResult | null>,
        [Prisma.FolderFindFirstArgs]
      >(),
      findMany: jest.fn<Promise<FolderResult[]>, [Prisma.FolderFindManyArgs]>(),
      findUnique: jest.fn<
        Promise<FolderResult | null>,
        [Prisma.FolderFindUniqueArgs]
      >(),
      create: jest.fn<Promise<FolderResult>, [Prisma.FolderCreateArgs]>(),
      update: jest.fn<Promise<FolderResult>, [Prisma.FolderUpdateArgs]>(),
    },
    clip: {
      findFirst: jest.fn<
        Promise<ClipResult | null>,
        [Prisma.ClipFindFirstArgs]
      >(),
      findMany: jest.fn<Promise<ClipResult[]>, [Prisma.ClipFindManyArgs]>(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FoldersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
    jest.clearAllMocks();
  });

  it('개인 워크스페이스가 없으면 빈 목록을 반환한다', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);

    const result = await service.getFolders('user-id');

    expect(result).toEqual([]);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        ownerUserId_type: {
          ownerUserId: 'user-id',
          type: WorkspaceType.PERSONAL,
        },
      },
      select: { id: true },
    });
    expect(prisma.folder.findMany).not.toHaveBeenCalled();
  });

  it('개인 워크스페이스의 폴더를 정렬해서 반환한다', async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: 'workspace-id' });
    prisma.folder.findMany.mockResolvedValue([{ id: 'folder-1' }]);

    const result = await service.getFolders('user-id');

    expect(prisma.folder.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-id', deletedAt: null },
      orderBy: { order: 'asc' },
    });
    expect(result).toEqual([{ id: 'folder-1' }]);
  });

  it('폴더가 없으면 예외를 던진다', async () => {
    prisma.folder.findFirst.mockResolvedValue(null);

    await expect(service.getFolderById('user-id', 'folder-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('폴더 클립을 커서 없이 조회하고 nextCursor를 반환한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    prisma.clip.findMany.mockResolvedValue([
      { id: 'clip-3' },
      { id: 'clip-2' },
      { id: 'clip-1' },
    ]);

    const result = await service.getFolderClips('user-id', 'folder-id', {
      limit: 2,
    });

    expect(prisma.clip.findMany).toHaveBeenCalledWith({
      where: {
        folderId: 'folder-id',
        workspaceId: 'workspace-id',
        deletedAt: null,
      },
      take: 3,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    expect(result).toEqual({
      items: [{ id: 'clip-3' }, { id: 'clip-2' }],
      nextCursor: 'clip-2',
    });
  });

  it('커서가 같은 폴더에 없으면 예외를 던진다', async () => {
    prisma.folder.findFirst.mockResolvedValue({
      id: 'folder-id',
      workspaceId: 'workspace-id',
    });
    prisma.clip.findFirst.mockResolvedValue(null);

    await expect(
      service.getFolderClips('user-id', 'folder-id', {
        cursor: 'missing-clip-id',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('이름이 주어지면 폴더명을 수정한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({ id: 'folder-id', name: 'Old' });
    prisma.folder.update.mockResolvedValue({ id: 'folder-id', name: 'New' });

    const result = await service.updateFolder('user-id', 'folder-id', {
      name: 'New',
    });

    expect(prisma.folder.update).toHaveBeenCalledWith({
      where: { id: 'folder-id' },
      data: { name: 'New' },
    });
    expect(result).toEqual({ id: 'folder-id', name: 'New' });
  });

  it('워크스페이스를 upsert로 확보하고 폴더를 생성한다', async () => {
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-id' });
    prisma.folder.findFirst.mockResolvedValue({
      id: 'last-folder-id',
      order: 3,
    });
    prisma.folder.create.mockResolvedValue({ id: 'folder-id' });

    const result = await service.createFolder('user-id', { name: 'Inbox' });

    expect(prisma.workspace.upsert).toHaveBeenCalledWith({
      where: {
        ownerUserId_type: {
          ownerUserId: 'user-id',
          type: WorkspaceType.PERSONAL,
        },
      },
      update: {},
      create: {
        name: 'Personal Workspace',
        type: WorkspaceType.PERSONAL,
        ownerUserId: 'user-id',
        users: {
          create: {
            userId: 'user-id',
            role: WorkspaceRole.OWNER,
          },
        },
      },
      select: { id: true },
    });
    expect(prisma.folder.create).toHaveBeenCalledWith({
      data: {
        name: 'Inbox',
        order: 4,
        workspaceId: 'workspace-id',
      },
    });
    expect(result).toEqual({ id: 'folder-id' });
  });

  it('폴더가 없으면 order 1로 생성한다', async () => {
    prisma.workspace.upsert.mockResolvedValue({ id: 'workspace-id' });
    prisma.folder.findFirst.mockResolvedValue(null);
    prisma.folder.create.mockResolvedValue({ id: 'folder-id' });

    await service.createFolder('user-id', { name: 'Inbox' });

    expect(prisma.folder.create).toHaveBeenCalledWith({
      data: {
        name: 'Inbox',
        order: 1,
        workspaceId: 'workspace-id',
      },
    });
  });

  it('beforeId와 afterId가 모두 없으면 순서 변경을 거부한다', async () => {
    // 검증 실패 시 Prisma 호출 전에 종료되어야 한다.
    await expect(
      service.reorderFolder('user-id', { targetId: 'folder-id' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('다음 폴더가 없을 때 기준 폴더 뒤로 순서를 변경한다', async () => {
    prisma.folder.findFirst
      .mockResolvedValueOnce({
        id: 'target-id',
        order: 1,
        workspaceId: 'workspace-id',
      })
      .mockResolvedValueOnce({ id: 'ref-id', order: 10 })
      .mockResolvedValueOnce(null);
    prisma.folder.update.mockResolvedValue({ id: 'target-id', order: 11 });

    const result = await service.reorderFolder('user-id', {
      targetId: 'target-id',
      afterId: 'ref-id',
    });

    expect(prisma.folder.update).toHaveBeenCalledWith({
      where: { id: 'target-id' },
      data: { order: 11 },
    });
    expect(result).toEqual({ id: 'target-id', order: 11 });
  });

  it('폴더를 소프트 삭제 처리한다', async () => {
    prisma.folder.findFirst.mockResolvedValue({ id: 'folder-id' });
    prisma.folder.update.mockResolvedValue({
      id: 'folder-id',
      deletedAt: new Date(),
    });

    const result = await service.deleteFolder('user-id', 'folder-id');

    expect(prisma.folder.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.folder.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'folder-id' });
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
    expect(result.id).toBe('folder-id');
  });
});
