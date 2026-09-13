import { createCorsOptions } from '../src/shared/presentation/helpers/cors.helper';
import { JwtModule } from '@nestjs/jwt';
import { Writable } from 'node:stream';
import {
  BadRequestException,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ClipsModule } from '../src/clips/clips.module';
import { CLIPS_REPOSITORY } from '../src/clips/domain/clips.repository';
import { CreateClipUseCase } from '../src/clips/application/usecases/create-clip.usecase';
import { UpdateClipUseCase } from '../src/clips/application/usecases/update-clip.usecase';
import { JwtAccessGuard } from '../src/shared/presentation/guards/jwt-access.guard';
import { createPinoHttpOptions } from '../src/shared/infrastructure/pino-logger.config';
import { ApplicationExceptionFilter } from '../src/shared/presentation/filters/application-exception.filter';

@Controller('auth')
class FailedAuthController {
  @Get('callback')
  callback() {
    throw new BadRequestException(
      'OAuth callback failed /auth/callback?code=fake-code-secret&state=fake-state-secret&%63ode=second-code-secret',
    );
  }
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);

describe('Upload boundary and final authentication logs (HTTP)', () => {
  let app: INestApplication<App>;
  let logs: string;
  let userId: string;
  const config: Record<string, string | undefined> = {};
  const execute = jest.fn().mockResolvedValue({ id: 'clip-id' });

  beforeAll(async () => {
    logs = '';
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    config.R2_MAX_IMAGE_BYTES = '128';
    config.CLIP_UPLOAD_REQUESTS_PER_MINUTE = '20';
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({ global: true }),
        ClipsModule,
        LoggerModule.forRoot({
          pinoHttp: [
            createPinoHttpOptions({ ENABLE_HTTP_LOGGING: 'true' }),
            stream,
          ],
        }),
      ],
      controllers: [FailedAuthController],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => config[key] })
      .overrideProvider(CLIPS_REPOSITORY)
      .useValue({})
      .overrideProvider(CreateClipUseCase)
      .useValue({ execute })
      .overrideProvider(UpdateClipUseCase)
      .useValue({ execute })
      .overrideGuard(JwtAccessGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<{ user: { userId: string } }>().user = { userId };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.enableCors(
      createCorsOptions({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://frontend.example.test',
      }),
    );
    app.useLogger(app.get(Logger));
    app.useGlobalFilters(new ApplicationExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    userId = expect.getState().currentTestName!;
    execute.mockClear();
    config.CLIP_UPLOAD_REQUESTS_PER_MINUTE = '20';
  });
  afterAll(async () => {
    await app?.close();
  });

  it('accepts a real PNG on create and update', async () => {
    await request(app.getHttpServer())
      .post('/clips')
      .field('folderId', 'folder')
      .attach('file', png, 'image.png')
      .expect(201);
    await request(app.getHttpServer())
      .patch('/clips/id')
      .attach('file', png, 'image.png')
      .expect(200);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized files, duplicate files, extra fields and oversized fields before the use case', async () => {
    await request(app.getHttpServer())
      .post('/clips')
      .field('folderId', 'folder')
      .attach('file', Buffer.alloc(129), 'image.png')
      .expect(413);
    await request(app.getHttpServer())
      .post('/clips')
      .attach('file', png, 'one.png')
      .attach('file', png, 'two.png')
      .expect(400);
    await request(app.getHttpServer())
      .post('/clips')
      .field('folderId', 'folder')
      .field('text', 'text')
      .field('extra', 'value')
      .expect(400);
    await request(app.getHttpServer())
      .post('/clips')
      .field('text', 'a'.repeat(1024 * 1024 + 1))
      .expect(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects MIME spoofing, unsupported MIME and truncated image input', async () => {
    for (const [buffer, filename, contentType] of [
      [Buffer.from('<html>fake</html>'), 'fake.png', 'image/png'],
      [png, 'fake.jpg', 'image/jpeg'],
      [png, 'fake.svg', 'image/svg+xml'],
      [png.subarray(0, 8), 'short.png', 'image/png'],
    ] as const) {
      await request(app.getHttpServer())
        .patch('/clips/id')
        .attach('file', buffer, { filename, contentType })
        .expect(400);
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it('limits multipart requests across both endpoints before parsing and resets after expiry', async () => {
    config.CLIP_UPLOAD_REQUESTS_PER_MINUTE = '1';
    const clock = jest.spyOn(Date, 'now').mockReturnValue(100000);
    try {
      await request(app.getHttpServer())
        .post('/clips')
        .field('folderId', 'folder')
        .attach('file', png, 'image.png')
        .expect(201);
      const limited = await request(app.getHttpServer())
        .patch('/clips/id')
        .set('Origin', 'https://frontend.example.test')
        .attach('file', Buffer.alloc(129), 'image.png')
        .expect(429);
      expect(limited.headers['retry-after']).toBe('60');
      expect(limited.headers['access-control-expose-headers']).toBe(
        'Retry-After',
      );
      expect(execute).toHaveBeenCalledTimes(1);
      clock.mockReturnValue(160001);
      await request(app.getHttpServer())
        .patch('/clips/id')
        .attach('file', png, 'image.png')
        .expect(200);
    } finally {
      clock.mockRestore();
    }
  });

  it('requires an explicit upload rate but permits JSON operations without it', async () => {
    delete config.CLIP_UPLOAD_REQUESTS_PER_MINUTE;
    await request(app.getHttpServer())
      .patch('/clips/id')
      .attach('file', png, 'image.png')
      .expect(503);
    await request(app.getHttpServer())
      .patch('/clips/id')
      .send({ title: 'rename' })
      .expect(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('removes code/state and encoded duplicate sensitive keys from final request and exception logs', async () => {
    logs = '';
    await request(app.getHttpServer())
      .get(
        '/auth/callback?code=fake-code-secret&state=fake-state-secret&%63ode=second-code-secret&authKey=toss-auth-secret&billingKey=toss-billing-secret&safe=value',
      )
      .expect(400);
    expect(logs).toContain('요청 처리 중 예외가 발생했습니다.');
    expect(logs).toContain('HTTP 요청 처리 실패');
    for (const secret of [
      'fake-code-secret',
      'fake-state-secret',
      'second-code-secret',
      'toss-auth-secret',
      'toss-billing-secret',
    ])
      expect(logs).not.toContain(secret);
    expect(logs).toContain('safe=value');
  });
  it('sanitizes direct Pino errors and serialized error fields without retaining raw causes', () => {
    logs = '';
    const url =
      '/auth?code=direct-code-secret&state=direct-state-secret&authKey=direct-auth-secret&billingKey=direct-billing-secret';
    const logger = app.get(Logger);
    logger.error({ err: new Error(url) });
    logger.error({
      err: {
        type: 'Error',
        message: url,
        stack: `Error: ${url}`,
        cause: { message: 'raw-cause-secret' },
        extra: 'raw-extra-secret',
      },
    });
    expect(logs).toContain('[REDACTED]');
    expect(logs).toContain('"type":"Error"');
    for (const secret of [
      'direct-code-secret',
      'direct-state-secret',
      'direct-auth-secret',
      'direct-billing-secret',
      'raw-cause-secret',
      'raw-extra-secret',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});
