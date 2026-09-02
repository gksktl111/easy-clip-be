import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtAccessGuard } from '../src/shared/presentation/guards/jwt-access.guard';
import { ListRecentClipsUseCase } from '../src/clips/application/usecases/list-recent-clips.usecase';

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
});
