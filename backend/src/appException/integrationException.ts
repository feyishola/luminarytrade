import { HttpStatus } from '@nestjs/common';
import { AppException } from 'src/common/exceptions/app.exception';
import { ERROR_CODES } from 'src/common/exceptions/error-codes.enum';

export class IntegrationException extends AppException {
  constructor(
    code: ERROR_CODES,
    message: string,
    context?: Record<string, any>,
  ) {
    super(code, message, HttpStatus.BAD_GATEWAY, context);
  }
}