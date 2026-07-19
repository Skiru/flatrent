import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import * as crypto from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = crypto.randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred on the server.';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let invalidParams: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resContent = exception.getResponse() as Record<string, unknown>;
      title = exception.name || 'HTTP Exception';
      detail =
        typeof resContent === 'string'
          ? resContent
          : (resContent.message as string) || exception.message;
      errorCode = (resContent.errorCode as string) || 'HTTP_ERROR';
    } else if (exception instanceof Error) {
      const msg = exception.message;
      detail = msg;

      if (
        msg.includes('already exists') ||
        msg.includes('unique constraint') ||
        msg.includes('conflict')
      ) {
        status = HttpStatus.CONFLICT;
        title = 'Conflict';
        errorCode = 'RESOURCE_ALREADY_EXISTS';
      } else if (msg.includes('not found') || msg.includes('NotFound')) {
        status = HttpStatus.NOT_FOUND;
        title = 'Not Found';
        errorCode = 'RESOURCE_NOT_FOUND';
      } else if (
        msg.includes('Invalid email or password') ||
        msg.includes('credentials') ||
        msg.includes('Password does not meet')
      ) {
        status = HttpStatus.UNAUTHORIZED;
        title = 'Unauthorized';
        errorCode = 'INVALID_CREDENTIALS';
      } else if (msg.includes('blocked')) {
        status = HttpStatus.FORBIDDEN;
        title = 'Forbidden';
        errorCode = 'ACCOUNT_BLOCKED';
      } else if (
        msg.includes('validation') ||
        msg.includes('Invalid') ||
        msg.includes('ZodError') ||
        msg.includes('Token reuse detected') ||
        msg.includes('revoked') ||
        msg.includes('expired')
      ) {
        status = HttpStatus.BAD_REQUEST;
        title = 'Bad Request';
        errorCode = 'VALIDATION_FAILED';
        // Parse Zod errors if available
        const errorWithIssues = exception as {
          issues?: Array<{ path: string[]; message: string }>;
        };
        if (errorWithIssues.issues && Array.isArray(errorWithIssues.issues)) {
          invalidParams = errorWithIssues.issues.map((issue) => ({
            name: issue.path.join('.'),
            reason: issue.message,
          }));
        }
      }
    }

    // Structured logging of the error (redacted)
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        correlationId,
        path: request.url,
        method: request.method,
        status,
        errorCode,
        error: exception instanceof Error ? exception.message : String(exception),
      }),
    );

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: `https://flatren.example/problems/${errorCode.toLowerCase().replace(/_/g, '-')}`,
        title,
        status,
        detail,
        instance: request.url,
        errorCode,
        correlationId,
        invalidParams,
      });
  }
}
