import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApplicationError } from '../../application/application.error';

@Catch(ApplicationError)
export class ApplicationExceptionFilter implements ExceptionFilter {
  catch(exception: ApplicationError, host: ArgumentsHost) {
    void host;
    throw this.toHttpException(exception);
  }

  private toHttpException(error: ApplicationError) {
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
}
