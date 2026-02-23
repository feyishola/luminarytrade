import { AppException } from "src/common/exceptions/app.exception";
import { ERROR_CODES } from "src/common/exceptions/error-codes.enum";

export class ValidationException extends AppException {
  constructor(message: string, context?: Record<string, any>) {
    super(ERROR_CODES.INVALID_INPUT, message, 400, context);
  }
}