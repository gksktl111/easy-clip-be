import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApplicationError } from '../../application/application.error';

@Catch()
export class ApplicationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApplicationExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const httpException = this.toHttpException(exception);
    const status = httpException.getStatus();
    const payload = httpException.getResponse();

    this.logger.error({
      err: exception instanceof Error ? exception : undefined,
      method: request.method,
      msg: '요청 처리 중 예외가 발생했습니다.',
      path: request.originalUrl || request.url,
      statusCode: status,
      userId: this.extractUserId(request),
    });

    response.status(status).json(payload);
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (!(error instanceof ApplicationError)) {
      return new InternalServerErrorException('Internal server error');
    }

    switch (error.code) {
      case 'BAD_REQUEST':
        return new BadRequestException(error.message);
      case 'UNAUTHORIZED':
        return new UnauthorizedException(error.message);
      case 'FORBIDDEN':
        return new ForbiddenException(error.message);
      case 'NOT_FOUND':
        return new NotFoundException(error.message);
      case 'CONFLICT':
        return new ConflictException(error.message);
      default:
        return new InternalServerErrorException(error.message);
    }
  }

  private extractUserId(request: Request): string | undefined {
    const user = request.user as { userId?: string } | undefined;
    return user?.userId;
  }
}
