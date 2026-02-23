import { applyDecorators, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function Paginated() {
  return applyDecorators(
    ApiQuery({ name: 'page', required: false, example: 1 }),
    ApiQuery({ name: 'limit', required: false, example: 20 }),
    UsePipes(new ValidationPipe({ transform: true, whitelist: true })),
  );
}