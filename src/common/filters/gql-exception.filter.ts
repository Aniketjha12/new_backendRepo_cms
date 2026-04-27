import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Prisma } from '@prisma/client';

@Catch()
export class GqlAllExceptionsFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GqlAllExceptionsFilter.name);

  catch(exception: unknown, _host: ArgumentsHost) {
    // Already a GraphQL error – pass through
    if (exception instanceof GraphQLError) return exception;

    // HTTP exceptions (validation, unauthorized, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as any;
      const message =
        typeof response === 'string'
          ? response
          : response?.message ?? exception.message;

      return new GraphQLError(
        Array.isArray(message) ? message.join('; ') : message,
        {
          extensions: {
            code: this.mapHttpStatusToCode(status),
            status,
          },
        },
      );
    }

    // Prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    // Unknown errors
    this.logger.error('Unhandled exception', exception);
    return new GraphQLError('Internal server error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }

  private handlePrismaError(err: Prisma.PrismaClientKnownRequestError): GraphQLError {
    switch (err.code) {
      case 'P2002': {
        const field = (err.meta?.target as string[])?.join(', ') || 'field';
        return new GraphQLError(`A record with this ${field} already exists.`, {
          extensions: { code: 'CONFLICT', prismaCode: err.code },
        });
      }
      case 'P2025':
        return new GraphQLError('Record not found.', {
          extensions: { code: 'NOT_FOUND', prismaCode: err.code },
        });
      case 'P2003':
        return new GraphQLError('Related record not found.', {
          extensions: { code: 'BAD_REQUEST', prismaCode: err.code },
        });
      default:
        this.logger.error('Prisma error', err);
        return new GraphQLError('Database error', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', prismaCode: err.code },
        });
    }
  }

  private mapHttpStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
