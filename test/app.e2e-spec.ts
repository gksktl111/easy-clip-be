import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtAccessGuard } from '../src/shared/presentation/guards/jwt-access.guard';
import { ListRecentClipsUseCase } from '../src/clips/application/usecases/list-recent-clips.usecase';
import { ReplaceClipTagsUseCase } from '../src/clips/application/usecases/replace-clip-tags.usecase';
import { CreateFolderTagUseCase } from '../src/folders/application/usecases/create-folder-tag.usecase';
import { UpdateFolderTagUseCase } from '../src/folders/application/usecases/update-folder-tag.usecase';

type AuthenticatedRequest = {
  user?: {
    userId: string;
  };
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const listRecentClipsUseCase = {
    execute: jest.fn(),
  };
  const replaceClipTagsUseCase = {
    execute: jest.fn(),
  };
  const createFolderTagUseCase = {
    execute: jest.fn(),
  };
  const updateFolderTagUseCase = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
      })
      .overrideGuard(JwtAccessGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
          request.user = { userId: 'user-id' };
          return true;
        },
      })
      .overrideProvider(ListRecentClipsUseCase)
      .useValue(listRecentClipsUseCase)
      .overrideProvider(ReplaceClipTagsUseCase)
      .useValue(replaceClipTagsUseCase)
      .overrideProvider(CreateFolderTagUseCase)
      .useValue(createFolderTagUseCase)
      .overrideProvider(UpdateFolderTagUseCase)
      .useValue(updateFolderTagUseCase)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    const instance = app.getHttpAdapter().getInstance() as unknown as App;

    return request(instance).get('/').expect(200).expect('Hello World!');
  });

  it('/metrics (GET)', async () => {
    const instance = app.getHttpAdapter().getInstance() as unknown as App;

    await request(instance).get('/').expect(200);

    const response = await request(instance)
      .get('/metrics')
      .expect(200)
      .expect('Content-Type', /text\/plain/);

    expect(response.text).toContain(
      'easy_clip_http_requests_total{method="GET",route="/",status_code="200"} 1',
    );
    expect(response.text).toContain(
      'easy_clip_http_request_duration_seconds_bucket',
    );
    expect(response.text).toContain('easy_clip_db_query_duration_seconds');
    expect(response.text).toContain('easy_clip_process_cpu_user_seconds_total');
  });

  it('/clips (GET)은 favorite를 생략하면 최근 클립 목록을 반환한다', async () => {
    listRecentClipsUseCase.execute.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
    const instance = app.getHttpAdapter().getInstance() as unknown as App;

    await request(instance)
      .get('/clips')
      .query({ type: 'ALL' })
      .expect(200)
      .expect({ items: [], hasMore: false, nextCursor: null });

    expect(listRecentClipsUseCase.execute).toHaveBeenCalledWith('user-id', {
      cursor: undefined,
      type: 'ALL',
      q: undefined,
    });
  });

  it('/clips/:clipId/tags (PUT)는 태그 이름 목록으로 전체 교체 유스케이스를 호출한다', async () => {
    replaceClipTagsUseCase.execute.mockResolvedValue({
      tags: [
        { id: 'tag-id', name: 'backend', backgroundColor: 'GRAY' },
        { id: 'new-tag-id', name: 'New tag', backgroundColor: 'GRAY' },
      ],
    });
    const instance = app.getHttpAdapter().getInstance() as unknown as App;

    await request(instance)
      .put('/clips/clip-id/tags')
      .send({ tags: ['backend', 'New tag'] })
      .expect(200)
      .expect({
        tags: [
          { id: 'tag-id', name: 'backend', backgroundColor: 'GRAY' },
          { id: 'new-tag-id', name: 'New tag', backgroundColor: 'GRAY' },
        ],
      });

    expect(replaceClipTagsUseCase.execute).toHaveBeenCalledWith('user-id', {
      clipId: 'clip-id',
      tags: ['backend', 'New tag'],
    });
  });

  it('/folders/:folderId/tags (POST)는 배경색을 포함해 태그를 생성한다', async () => {
    createFolderTagUseCase.execute.mockResolvedValue({
      id: 'tag-id',
      folderId: 'folder-id',
      name: 'backend',
      backgroundColor: 'ORANGE',
    });
    const instance = app.getHttpAdapter().getInstance() as unknown as App;

    await request(instance)
      .post('/folders/folder-id/tags')
      .send({ name: 'backend', backgroundColor: 'ORANGE' })
      .expect(201)
      .expect({
        id: 'tag-id',
        folderId: 'folder-id',
        name: 'backend',
        backgroundColor: 'ORANGE',
      });

    expect(createFolderTagUseCase.execute).toHaveBeenCalledWith('user-id', {
      folderId: 'folder-id',
      name: 'backend',
      backgroundColor: 'ORANGE',
    });
  });

  it('/folders/:folderId/tags/:tagId (PATCH)는 배경색만 수정할 수 있다', async () => {
    updateFolderTagUseCase.execute.mockResolvedValue({
      id: 'tag-id',
      folderId: 'folder-id',
      name: 'backend',
      backgroundColor: 'PURPLE',
    });
    const instance = app.getHttpAdapter().getInstance() as unknown as App;

    await request(instance)
      .patch('/folders/folder-id/tags/tag-id')
      .send({ backgroundColor: 'PURPLE' })
      .expect(200)
      .expect({
        id: 'tag-id',
        folderId: 'folder-id',
        name: 'backend',
        backgroundColor: 'PURPLE',
      });

    expect(updateFolderTagUseCase.execute).toHaveBeenCalledWith('user-id', {
      folderId: 'folder-id',
      tagId: 'tag-id',
      name: undefined,
      backgroundColor: 'PURPLE',
    });
  });
});
