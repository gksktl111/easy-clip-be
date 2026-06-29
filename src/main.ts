import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApplicationExceptionFilter } from './shared/presentation/filters/application-exception.filter';
import {
  isHttpLoggingEnabled,
  registerHttpLoggingMiddleware,
} from './shared/presentation/logging/http-logging.helper';
import { setupSwagger } from './shared/presentation/swagger/swagger.helper';

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

  setupSwagger(app, process.env);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
