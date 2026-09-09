import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantContextStorage } from '@autonomous-enterprise/shared';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const httpResponse = isHttpException ? exception.getResponse() : undefined;

    const message = isHttpException
      ? typeof httpResponse === 'string'
        ? httpResponse
        : ((httpResponse as { message?: string | string[] })?.message ?? exception.message)
      : 'Internal server error';

    const tenantId = TenantContextStorage.getTenantId();
    const requestId = TenantContextStorage.getContext()?.requestId;

    if (!isHttpException || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url} [tenant=${tenantId ?? 'unknown'}] [requestId=${requestId ?? 'unknown'}]`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code: isHttpException ? exception.constructor.name : 'INTERNAL_SERVER_ERROR',
        message
      },
      metadata: {
        tenantId,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }
}
