import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApplicationExceptionFilter } from './shared/presentation/filters/application-exception.filter';
import {
  isHttpLoggingEnabled,
  registerHttpLoggingMiddleware,
} from './shared/presentation/logging/http-logging.helper';
import {
  createCorsOptions,
  shouldWarnMissingProductionCorsOrigins,
} from './shared/presentation/helpers/cors.helper';
import { setupSwagger } from './shared/presentation/swagger/swagger.helper';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  if (shouldWarnMissingProductionCorsOrigins(process.env)) {
    logger.warn(
      'production 환경에서 CORS_ALLOWED_ORIGINS가 비어 있습니다. 배포 프론트 origin을 명시하세요.',
    );
  }

  app.enableCors(createCorsOptions(process.env));
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
