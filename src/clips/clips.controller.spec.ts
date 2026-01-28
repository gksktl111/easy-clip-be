import { Test, TestingModule } from '@nestjs/testing';
import { AuthContext } from 'src/auth/application/auth-context';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { ClipsController } from './presentation/clips.controller';
import { CreateClipUseCase } from './application/usecases/create-clip.usecase';
import { GetClipUseCase } from './application/usecases/get-clip.usecase';
import { UpdateClipUseCase } from './application/usecases/update-clip.usecase';
import { DeleteClipUseCase } from './application/usecases/delete-clip.usecase';

// 컨트롤러는 요청을 유스케이스로 정확히 위임하는지만 검증한다.
describe('ClipsController', () => {
  let controller: ClipsController;

  const createClipUseCase = { execute: jest.fn() };
  const getClipUseCase = { execute: jest.fn() };
  const updateClipUseCase = { execute: jest.fn() };
  const deleteClipUseCase = { execute: jest.fn() };

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
      controllers: [ClipsController],
      providers: [
        { provide: CreateClipUseCase, useValue: createClipUseCase },
        { provide: GetClipUseCase, useValue: getClipUseCase },
        { provide: UpdateClipUseCase, useValue: updateClipUseCase },
        { provide: DeleteClipUseCase, useValue: deleteClipUseCase },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(JwtAccessGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<ClipsController>(ClipsController);
    jest.clearAllMocks();
  });

  it('createClip이 유스케이스에 위임한다', async () => {
    const clip = { id: 'clip-id' };
    createClipUseCase.execute.mockResolvedValue(clip);

    const result = await controller.createClip(req, {
      folderId: 'folder-id',
      text: 'hello',
    });

    expect(createClipUseCase.execute).toHaveBeenCalledWith(
      'user-id',
      {
        folderId: 'folder-id',
        text: 'hello',
      },
      undefined,
    );
    expect(result).toBe(clip);
  });

  it('getClip이 유스케이스에 위임한다', async () => {
    const clip = { id: 'clip-id' };
    getClipUseCase.execute.mockResolvedValue(clip);

    const result = await controller.getClip(req, 'clip-id');

    expect(getClipUseCase.execute).toHaveBeenCalledWith('user-id', 'clip-id');
    expect(result).toBe(clip);
  });

  it('updateClip이 유스케이스에 위임한다', async () => {
    const clip = { id: 'clip-id', textContent: 'updated' };
    updateClipUseCase.execute.mockResolvedValue(clip);

    const result = await controller.updateClip(req, 'clip-id', {
      text: 'updated',
    });

    expect(updateClipUseCase.execute).toHaveBeenCalledWith(
      'user-id',
      'clip-id',
      {
        text: 'updated',
      },
      undefined,
    );
    expect(result).toBe(clip);
  });

  it('deleteClip이 유스케이스에 위임한다', async () => {
    const clip = { id: 'clip-id', deletedAt: new Date() };
    deleteClipUseCase.execute.mockResolvedValue(clip);

    const result = await controller.deleteClip(req, 'clip-id');

    expect(deleteClipUseCase.execute).toHaveBeenCalledWith('user-id', 'clip-id');
    expect(result).toBe(clip);
  });
});
