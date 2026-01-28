import { Test, TestingModule } from '@nestjs/testing';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { AuthContext } from 'src/auth/application/auth-context';
import { FoldersController } from './presentation/folders.controller';
import { GetFoldersUseCase } from './application/usecases/get-folders.usecase';
import { GetFolderUseCase } from './application/usecases/get-folder.usecase';
import { GetFolderClipsUseCase } from './application/usecases/get-folder-clips.usecase';
import { CreateFolderUseCase } from './application/usecases/create-folder.usecase';
import { ReorderFolderUseCase } from './application/usecases/reorder-folder.usecase';
import { UpdateFolderUseCase } from './application/usecases/update-folder.usecase';
import { DeleteFolderUseCase } from './application/usecases/delete-folder.usecase';

describe('FoldersController', () => {
  let controller: FoldersController;

  const getFoldersUseCase = { execute: jest.fn() };
  const getFolderUseCase = { execute: jest.fn() };
  const getFolderClipsUseCase = { execute: jest.fn() };
  const createFolderUseCase = { execute: jest.fn() };
  const reorderFolderUseCase = { execute: jest.fn() };
  const updateFolderUseCase = { execute: jest.fn() };
  const deleteFolderUseCase = { execute: jest.fn() };

  const authGuard = {
    canActivate: jest.fn(() => true),
  };

  const req = {
    user: {
      userId: 'user-id',
      accountId: 'account-id',
      platform: 'WEB',
    } as AuthContext,
  };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [FoldersController],
      providers: [
        { provide: GetFoldersUseCase, useValue: getFoldersUseCase },
        { provide: GetFolderUseCase, useValue: getFolderUseCase },
        { provide: GetFolderClipsUseCase, useValue: getFolderClipsUseCase },
        { provide: CreateFolderUseCase, useValue: createFolderUseCase },
        { provide: ReorderFolderUseCase, useValue: reorderFolderUseCase },
        { provide: UpdateFolderUseCase, useValue: updateFolderUseCase },
        { provide: DeleteFolderUseCase, useValue: deleteFolderUseCase },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(JwtAccessGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<FoldersController>(FoldersController);
    jest.clearAllMocks();
  });

  it('getFolders가 유스케이스에 위임한다', async () => {
    const folders = [{ id: 'folder-1' }];
    getFoldersUseCase.execute.mockResolvedValue(folders);

    const result = await controller.getFolders(req);

    expect(getFoldersUseCase.execute).toHaveBeenCalledWith('user-id');
    expect(result).toBe(folders);
  });

  it('getFolder가 유스케이스에 위임한다', async () => {
    const folder = { id: 'folder-1' };
    getFolderUseCase.execute.mockResolvedValue(folder);

    const result = await controller.getFolder(req, 'folder-1');

    expect(getFolderUseCase.execute).toHaveBeenCalledWith('user-id', 'folder-1');
    expect(result).toBe(folder);
  });

  it('createFolder가 유스케이스에 위임한다', async () => {
    const folder = { id: 'folder-1', name: 'Inbox' };
    createFolderUseCase.execute.mockResolvedValue(folder);

    const result = await controller.createFolder(req, { name: 'Inbox' });

    expect(createFolderUseCase.execute).toHaveBeenCalledWith('user-id', {
      name: 'Inbox',
    });
    expect(result).toBe(folder);
  });

  it('reorderFolder가 유스케이스에 위임한다', async () => {
    const reordered = { id: 'folder-1', order: 10 };
    reorderFolderUseCase.execute.mockResolvedValue(reordered);

    const result = await controller.reorderFolder(req, {
      targetId: 'folder-1',
      afterId: 'folder-2',
    });

    expect(reorderFolderUseCase.execute).toHaveBeenCalledWith('user-id', {
      targetId: 'folder-1',
      afterId: 'folder-2',
    });
    expect(result).toBe(reordered);
  });

  it('updateFolder가 유스케이스에 위임한다', async () => {
    const updated = { id: 'folder-1', name: 'Renamed' };
    updateFolderUseCase.execute.mockResolvedValue(updated);

    const result = await controller.updateFolder(req, 'folder-1', {
      name: 'Renamed',
    });

    expect(updateFolderUseCase.execute).toHaveBeenCalledWith(
      'user-id',
      'folder-1',
      {
        name: 'Renamed',
      },
    );
    expect(result).toBe(updated);
  });

  it('deleteFolder가 유스케이스에 위임한다', async () => {
    const deleted = { id: 'folder-1', deletedAt: new Date() };
    deleteFolderUseCase.execute.mockResolvedValue(deleted);

    const result = await controller.deleteFolder(req, 'folder-1');

    expect(deleteFolderUseCase.execute).toHaveBeenCalledWith(
      'user-id',
      'folder-1',
    );
    expect(result).toBe(deleted);
  });
});
