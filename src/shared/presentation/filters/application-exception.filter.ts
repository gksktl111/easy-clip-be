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

    this.logger.error(
      this.formatErrorLog(request, status, exception),
      exception instanceof Error ? exception.stack : undefined,
    );

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

  private formatErrorLog(
    request: Request,
    status: number,
    exception: unknown,
  ): string {
    const base = `${request.method} ${request.originalUrl || request.url} ${status}`;
    const userId = this.extractUserId(request);
    const message = this.extractErrorMessage(exception);

    return [base, userId ? `user=${userId}` : undefined, `message=${message}`]
      .filter(Boolean)
      .join(' ');
  }

  private extractUserId(request: Request): string | undefined {
    const user = request.user as { userId?: string } | undefined;
    return user?.userId;
  }

  private extractErrorMessage(exception: unknown): string {
    if (exception instanceof ApplicationError || exception instanceof Error) {
      return exception.message;
    }

    return 'Unknown error';
  }
}
