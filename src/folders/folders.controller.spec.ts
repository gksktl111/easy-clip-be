import { Test, TestingModule } from '@nestjs/testing';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { JwtPayload } from 'src/auth/auth';

describe('FoldersController', () => {
  let controller: FoldersController;
  // 요청-서비스 연결만 검증하며 가드는 테스트하지 않는다.
  const foldersService = {
    getFolders: jest.fn(),
    getFolderById: jest.fn(),
    createFolder: jest.fn(),
    reorderFolder: jest.fn(),
    updateFolder: jest.fn(),
    deleteFolder: jest.fn(),
  };
  const authGuard = {
    canActivate: jest.fn(() => true),
  };

  const req = {
    user: {
      sub: 'user-id',
      accountId: 'account-id',
      platform: 'WEB',
    } as JwtPayload,
  };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [FoldersController],
      providers: [{ provide: FoldersService, useValue: foldersService }],
    });

    const module: TestingModule = await moduleBuilder
      // 인증 가드는 단위 테스트에서 항상 통과시키도록 대체한다.
      .overrideGuard(JwtAccessGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<FoldersController>(FoldersController);
    jest.clearAllMocks();
  });

  it('getFolders가 서비스에 위임한다', async () => {
    const folders = [{ id: 'folder-1' }];
    foldersService.getFolders.mockResolvedValue(folders);

    const result = await controller.getFolders(req);

    expect(foldersService.getFolders).toHaveBeenCalledWith('user-id');
    expect(result).toBe(folders);
  });

  it('getFolder가 서비스에 위임한다', async () => {
    const folder = { id: 'folder-1' };
    foldersService.getFolderById.mockResolvedValue(folder);

    const result = await controller.getFolder(req, 'folder-1');

    expect(foldersService.getFolderById).toHaveBeenCalledWith(
      'user-id',
      'folder-1',
    );
    expect(result).toBe(folder);
  });

  it('createFolder가 서비스에 위임한다', async () => {
    const folder = { id: 'folder-1', name: 'Inbox' };
    foldersService.createFolder.mockResolvedValue(folder);

    const result = await controller.createFolder(req, { name: 'Inbox' });

    expect(foldersService.createFolder).toHaveBeenCalledWith('user-id', {
      name: 'Inbox',
    });
    expect(result).toBe(folder);
  });

  it('reorderFolder가 서비스에 위임한다', async () => {
    const reordered = { id: 'folder-1', order: 10 };
    foldersService.reorderFolder.mockResolvedValue(reordered);

    const result = await controller.reorderFolder(req, {
      targetId: 'folder-1',
      afterId: 'folder-2',
    });

    expect(foldersService.reorderFolder).toHaveBeenCalledWith('user-id', {
      targetId: 'folder-1',
      afterId: 'folder-2',
    });
    expect(result).toBe(reordered);
  });

  it('updateFolder가 서비스에 위임한다', async () => {
    const updated = { id: 'folder-1', name: 'Renamed' };
    foldersService.updateFolder.mockResolvedValue(updated);

    const result = await controller.updateFolder(req, 'folder-1', {
      name: 'Renamed',
    });

    expect(foldersService.updateFolder).toHaveBeenCalledWith(
      'user-id',
      'folder-1',
      {
        name: 'Renamed',
      },
    );
    expect(result).toBe(updated);
  });

  it('deleteFolder가 서비스에 위임한다', async () => {
    const deleted = { id: 'folder-1', deletedAt: new Date() };
    foldersService.deleteFolder.mockResolvedValue(deleted);

    const result = await controller.deleteFolder(req, 'folder-1');

    expect(foldersService.deleteFolder).toHaveBeenCalledWith(
      'user-id',
      'folder-1',
    );
    expect(result).toBe(deleted);
  });
});
