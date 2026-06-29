import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export type SwaggerEnvironment = Record<string, string | undefined> & {
  NODE_ENV?: string;
  ENABLE_SWAGGER?: string;
};

export function isSwaggerEnabled(env: SwaggerEnvironment): boolean {
  if (env.NODE_ENV === 'production') {
    return env.ENABLE_SWAGGER === 'true';
  }

  return env.ENABLE_SWAGGER !== 'false';
}

export function setupSwagger(
  app: INestApplication,
  env: SwaggerEnvironment,
): void {
  if (!isSwaggerEnabled(env)) {
    return;
  }

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
}
