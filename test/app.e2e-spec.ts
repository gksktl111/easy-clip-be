import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: () => Promise.resolve(),
        onModuleDestroy: () => Promise.resolve(),
      })
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
});
