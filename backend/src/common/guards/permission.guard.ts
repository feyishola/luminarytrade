import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION } from '../decorators/require-permission.decorator';
import { AuthorizationService } from '../../authorization/authorization.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authz: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.get(REQUIRE_PERMISSION, context.getHandler());
    if (!metadata) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const allowed = await this.authz.hasPermission(
      user.id,
      metadata.resource,
      metadata.action,
      { user, resource: request.body }
    );

    if (!allowed) throw new ForbiddenException();

    return true;
  }
}