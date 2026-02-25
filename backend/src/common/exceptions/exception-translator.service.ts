import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from './error-codes.enum';
import { IntegrationException } from 'src/appException/integrationException';
import { BusinessException } from 'src/appException/businessException';

@Injectable()
export class ExceptionTranslator {
  translate(error: any): never {
    // Already an AppException
    if (error instanceof Error && 'code' in error) {
      throw error;
    }

    // Example: Axios error
    if (error?.isAxiosError) {
      throw new IntegrationException(
        ERROR_CODES.THIRD_PARTY_FAILURE,
        'External service failed',
        {
          status: error.response?.status,
          url: error.config?.url,
        },
      );
    }

    // Example: Database error
    if (error?.code === '23505') {
      throw new BusinessException(
        ERROR_CODES.INVALID_INPUT,
        'Duplicate record',
      );
    }

    // Fallback
    throw new IntegrationException(
      ERROR_CODES.INTERNAL_ERROR,
      'Unexpected internal error',
    );
  }
}