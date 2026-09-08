import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

interface ErrorResponse {
  status(statusCode: number): ErrorResponse;
  json(body: unknown): void;
}

interface ErrorRequest {
  url?: string;
  requestId?: string;
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<ErrorResponse>();
    const request = http.getRequest<ErrorRequest>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.message(exception, statusCode);

    response.status(statusCode).json({
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message,
      path: request.url ?? null,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  private message(exception: unknown, statusCode: number): string | string[] {
    if (!(exception instanceof HttpException)) return 'Internal server error';
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string' || (Array.isArray(message) && message.every((item) => typeof item === 'string'))) {
        return message;
      }
    }
    return statusCode >= 500 ? 'Internal server error' : exception.message;
  }
}
