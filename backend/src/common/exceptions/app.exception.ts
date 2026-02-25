import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from './error-codes.enum';

export class AppException extends HttpException {
  constructor(
    public readonly code: ERROR_CODES,
    message: string,
    status: HttpStatus,
    public readonly context?: Record<string, any>,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      status,
    );
  }
}