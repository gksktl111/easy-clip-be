import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApplicationExceptionFilter } from './shared/presentation/filters/application-exception.filter';
import {
  isHttpLoggingEnabled,
  registerHttpLoggingMiddleware,
} from './shared/presentation/logging/http-logging.helper';

const parseAllowedCorsPorts = (raw?: string) =>
  new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );

const isAllowedCorsOrigin = (origin: string, allowedPorts: Set<string>) => {
  try {
    const url = new URL(origin);
    const isLocalHost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (!isLocalHost) {
      return false;
    }

    return allowedPorts.has(url.port);
  } catch {
    return false;
  }
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedCorsPorts = parseAllowedCorsPorts(
    process.env.CORS_ALLOWED_PORTS,
  );

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      // 브라우저가 아닌 서버 간 요청/헬스체크는 Origin 헤더가 없을 수 있다.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedCorsOrigin(origin, allowedCorsPorts)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  };

  app.enableCors(corsOptions);
  app.useGlobalFilters(new ApplicationExceptionFilter());

  if (isHttpLoggingEnabled(process.env)) {
    app.use(registerHttpLoggingMiddleware);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Easy Clip API')
    .setDescription('개인 MVP 기준 Easy Clip 백엔드 OpenAPI 문서')
    .setVersion('1.0.0')
    .addTag('Auth', 'OAuth 로그인, 계정 전환, 토큰 재발급, 로그아웃 API')
    .addTag('Clips', '클립 생성, 수정, 삭제, 목록, 좋아요, 최근 조회 API')
    .addTag('Folders', '개인 워크스페이스 폴더 관리 API')
    .addTag('Users', '내 프로필 및 사용자 설정 API')
    .addTag('Workspaces', '개인 워크스페이스 API')
    .addTag('Subscriptions', '구독 조회, 자동결제 인증, 자동갱신 API')
    .addTag('Trash', '휴지통 조회, 복구, 영구 삭제 API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token을 입력하세요.',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT refresh token을 입력하세요. 쿠키 인증 환경에서는 easy_clip_refresh_token 쿠키가 우선 사용됩니다.',
      },
      'refresh-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
