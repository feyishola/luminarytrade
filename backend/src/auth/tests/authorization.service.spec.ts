import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Role } from '../../rbac/entities/role.entity';
import { UserRole } from '../../rbac/entities/user-role.entity';
import { Permission } from '../../rbac/entities/permission.entity';
import { Policy } from '../../rbac/entities/policy.entity';
import { AuthorizationAudit } from '../../rbac/entities/authorization-audit.entity';
import { Action } from '../../common/constant/actions.enum';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let roleRepo: any;
  let userRoleRepo: any;
  let policyRepo: any;
  let auditRepo: any;
  let cache: any;

  beforeEach(async () => {
    roleRepo = {
      find: jest.fn(),
      findBy: jest.fn(),
    };
    userRoleRepo = {
      find: jest.fn(),
    };
    policyRepo = {
      findOne: jest.fn(),
    };
    auditRepo = {
      save: jest.fn(),
    };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepo },
        { provide: getRepositoryToken(Permission), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Policy), useValue: policyRepo },
        { provide: getRepositoryToken(AuthorizationAudit), useValue: auditRepo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(AuthorizationService);
  });

  it('should allow permission if role matches', async () => {
    cache.get.mockResolvedValue(undefined);
    userRoleRepo.find.mockResolvedValue([{ roleId: 'role-1' }]);
    roleRepo.findBy.mockResolvedValue([{ id: 'role-1', name: 'ADMIN' }]);
    roleRepo.find.mockResolvedValue([
      { permissions: [{ resource: 'agents', action: Action.READ }] },
    ]);
    policyRepo.findOne.mockResolvedValue(null);

    const result = await service.hasPermission('user1', 'agents', Action.READ, {});

    expect(result).toBe(true);
    expect(auditRepo.save).toHaveBeenCalled();
  });

  it('should deny permission if no match', async () => {
    cache.get.mockResolvedValue(undefined);
    userRoleRepo.find.mockResolvedValue([{ roleId: 'role-1' }]);
    roleRepo.findBy.mockResolvedValue([{ id: 'role-1', name: 'VIEWER' }]);
    roleRepo.find.mockResolvedValue([]);
    policyRepo.findOne.mockResolvedValue(null);

    const result = await service.hasPermission('user1', 'agents', Action.CREATE, {});

    expect(result).toBe(false);
    expect(auditRepo.save).toHaveBeenCalled();
  });
});
