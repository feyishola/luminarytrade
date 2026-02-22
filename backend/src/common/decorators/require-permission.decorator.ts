import { SetMetadata } from '@nestjs/common';
import { Action } from '../constants/actions.enum';

export const REQUIRE_PERMISSION = 'require_permission';

export const RequirePermission = (resource: string, action: Action) =>
  SetMetadata(REQUIRE_PERMISSION, { resource, action });