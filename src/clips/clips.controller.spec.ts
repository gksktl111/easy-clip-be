import { Test, TestingModule } from '@nestjs/testing';
import { AuthContext } from 'src/auth/application/auth-context';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';

// 컨트롤러는 요청을 서비스로 정확히 위임하는지만 검증한다.
describe('ClipsController', () => {
  let controller: ClipsController;

  const clipsService = {
    createClip: jest.fn(),
    getClipById: jest.fn(),
    updateClip: jest.fn(),
    deleteClip: jest.fn(),
  };
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
      providers: [{ provide: ClipsService, useValue: clipsService }],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(JwtAccessGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<ClipsController>(ClipsController);
    jest.clearAllMocks();
  });

  it('createClip이 서비스에 위임한다', async () => {
    const clip = { id: 'clip-id' };
    clipsService.createClip.mockResolvedValue(clip);

    const result = await controller.createClip(req, {
      folderId: 'folder-id',
      text: 'hello',
    });

    expect(clipsService.createClip).toHaveBeenCalledWith(
      'user-id',
      {
        folderId: 'folder-id',
        text: 'hello',
      },
      undefined,
    );
    expect(result).toBe(clip);
  });

  it('getClip이 서비스에 위임한다', async () => {
    const clip = { id: 'clip-id' };
    clipsService.getClipById.mockResolvedValue(clip);

    const result = await controller.getClip(req, 'clip-id');

    expect(clipsService.getClipById).toHaveBeenCalledWith('user-id', 'clip-id');
    expect(result).toBe(clip);
  });

  it('updateClip이 서비스에 위임한다', async () => {
    const clip = { id: 'clip-id', textContent: 'updated' };
    clipsService.updateClip.mockResolvedValue(clip);

    const result = await controller.updateClip(req, 'clip-id', {
      text: 'updated',
    });

    expect(clipsService.updateClip).toHaveBeenCalledWith(
      'user-id',
      'clip-id',
      {
        text: 'updated',
      },
      undefined,
    );
    expect(result).toBe(clip);
  });

  it('deleteClip이 서비스에 위임한다', async () => {
    const clip = { id: 'clip-id', deletedAt: new Date() };
    clipsService.deleteClip.mockResolvedValue(clip);

    const result = await controller.deleteClip(req, 'clip-id');

    expect(clipsService.deleteClip).toHaveBeenCalledWith('user-id', 'clip-id');
    expect(result).toBe(clip);
  });
});
