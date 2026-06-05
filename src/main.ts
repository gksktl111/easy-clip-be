import 'dotenv/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
    .addTag('Workspaces', '개인 워크스페이스 구독 정보 API')
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
