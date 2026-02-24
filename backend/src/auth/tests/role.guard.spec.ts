import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Action } from '../../common/constant/actions.enum';

describe('PermissionGuard', () => {
  it('should throw ForbiddenException if not allowed', async () => {
    const reflector = { get: jest.fn().mockReturnValue({ resource: 'agents', action: Action.READ }) } as unknown as Reflector;
    const authz = { hasPermission: jest.fn().mockResolvedValue(false) };

    const guard = new PermissionGuard(reflector, authz as any);

    const contextMock: any = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'user1' }, body: {} }),
      }),
    };

    await expect(guard.canActivate(contextMock)).rejects.toThrow(ForbiddenException);
  });
});
